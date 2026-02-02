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

export function useAuth(isOnline: boolean) {
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
            // 1. Try cached user first (instant)
            const cached = await Storage.getJSON<CachedUser>(STORAGE_KEYS.CACHED_USER);

            if (cached && isValidCachedUser(cached)) {
                if (mounted) {
                    setState({
                        userId: cached.id,
                        userEmail: cached.email,
                        isGuest: false,
                        isLoading: false,
                        createdAt: cached.created_at
                    });
                }
            }

            // 2. Verify with server if online
            if (isOnline) {
                try {
                    const { data: { session }, error } = await supabase.auth.getSession();

                    if (error) {
                        console.error('Session error:', error);
                    }

                    if (session?.user) {
                        const userData: CachedUser = {
                            id: session.user.id,
                            email: session.user.email || '',
                            created_at: session.user.created_at || new Date().toISOString()
                        };
                        await Storage.setJSON(STORAGE_KEYS.CACHED_USER, userData);

                        if (mounted) {
                            setState({
                                userId: userData.id,
                                userEmail: userData.email,
                                isGuest: false,
                                isLoading: false,
                                createdAt: userData.created_at
                            });
                        }
                    } else if (!cached) {
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
                } catch (e) {
                    console.error('Auth init error:', e);
                    if (!cached && mounted) {
                        setState({
                            userId: null,
                            userEmail: null,
                            isGuest: true,
                            isLoading: false,
                            createdAt: null
                        });
                    }
                }
            } else if (!cached) {
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

        // Auth state listener
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
    }, [isOnline]);

    return state;
}
