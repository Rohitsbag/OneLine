import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Storage, STORAGE_KEYS } from '@/utils/storage';

interface CachedUser {
    id: string;
    email: string;
    created_at: string;
}

const isValidCachedUser = (data: unknown): data is CachedUser => {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return (
        typeof obj.id === 'string' && obj.id.length > 0 &&
        typeof obj.email === 'string' &&
        typeof obj.created_at === 'string'
    );
};

/** Wraps a promise with a timeout. Rejects with 'timeout' if exceeded. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

export function useAuth(_isOnline?: boolean) {
    const [state, setState] = useState<{
        userId: string | null;
        userEmail: string | null;
        isGuest: boolean;
        isLoading: boolean;
        createdAt: string | null;
    }>({
        userId: null,
        userEmail: null,
        isGuest: false,
        isLoading: true,
        createdAt: null
    });

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            // 1. Try cached user first (instant) - this is the primary path
            const cached = await Storage.getJSON<CachedUser>(STORAGE_KEYS.CACHED_USER);

            if (cached && isValidCachedUser(cached)) {
                // Immediately resolve with cached data - don't wait for network
                if (mounted) {
                    setState({
                        userId: cached.id,
                        userEmail: cached.email,
                        isGuest: false,
                        isLoading: false,
                        createdAt: cached.created_at
                    });
                }

                // Background: Try to verify/refresh session without blocking UI
                // Use a short timeout so a dead backend doesn't stall anything
                try {
                    const { data: { session } } = await withTimeout(
                        supabase.auth.getSession(),
                        5000 // 5 second timeout max
                    );

                    if (session?.user && mounted) {
                        const userData: CachedUser = {
                            id: session.user.id,
                            email: session.user.email || cached.email,
                            created_at: session.user.created_at || cached.created_at
                        };
                        await Storage.setJSON(STORAGE_KEYS.CACHED_USER, userData);
                        setState({
                            userId: userData.id,
                            userEmail: userData.email,
                            isGuest: false,
                            isLoading: false,
                            createdAt: userData.created_at
                        });
                    } else if (!session && mounted) {
                        // Session expired - clear cache, go to guest
                        await Storage.remove(STORAGE_KEYS.CACHED_USER);
                        setState({
                            userId: null,
                            userEmail: null,
                            isGuest: true,
                            isLoading: false,
                            createdAt: null
                        });
                    }
                } catch {
                    // Backend unreachable or timeout - stay with cached user, no UI change needed
                    console.warn('[useAuth] Backend unreachable, using cached session');
                }
                return;
            }

            // 2. No cached user - try to get session with short timeout
            try {
                const { data: { session } } = await withTimeout(
                    supabase.auth.getSession(),
                    5000
                );

                if (session?.user && mounted) {
                    const userData: CachedUser = {
                        id: session.user.id,
                        email: session.user.email || '',
                        created_at: session.user.created_at || new Date().toISOString()
                    };
                    await Storage.setJSON(STORAGE_KEYS.CACHED_USER, userData);
                    setState({
                        userId: userData.id,
                        userEmail: userData.email,
                        isGuest: false,
                        isLoading: false,
                        createdAt: userData.created_at
                    });
                } else if (mounted) {
                    setState({
                        userId: null,
                        userEmail: null,
                        isGuest: true,
                        isLoading: false,
                        createdAt: null
                    });
                }
            } catch {
                // Backend unreachable - go to guest mode immediately
                console.warn('[useAuth] Backend unreachable, entering guest mode');
                if (mounted) {
                    setState({
                        userId: null,
                        userEmail: null,
                        isGuest: true,
                        isLoading: false,
                        createdAt: null
                    });
                }
            }
        };

        init();

        // Auth state listener for sign-in / sign-out events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (event === 'SIGNED_IN' && session?.user) {
                    const userData: CachedUser = {
                        id: session.user.id,
                        email: session.user.email || '',
                        created_at: session.user.created_at || new Date().toISOString()
                    };
                    await Storage.setJSON(STORAGE_KEYS.CACHED_USER, userData);
                    setState({
                        userId: userData.id,
                        userEmail: userData.email,
                        isGuest: false,
                        isLoading: false,
                        createdAt: userData.created_at
                    });
                } else if (event === 'SIGNED_OUT') {
                    await Storage.remove(STORAGE_KEYS.CACHED_USER);
                    setState({
                        userId: null,
                        userEmail: null,
                        isGuest: true,
                        isLoading: false,
                        createdAt: null
                    });
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []); // Run only once on mount - no dependencies that cause re-runs

    return state;
}
