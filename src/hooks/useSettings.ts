import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Storage, STORAGE_KEYS } from '@/utils/storage';
import { OfflineQueue } from '@/utils/offlineQueue';

export interface UserSettings {
    ai_enabled: boolean;
    ai_rewrite_enabled: boolean;
    accent_color: string;
    stt_language: string;
    notifications_enabled: boolean;
    notification_time: string;
    media_display_mode: 'grid' | 'swipe' | 'scroll';
    lock_enabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
    ai_enabled: false,
    ai_rewrite_enabled: false,
    accent_color: 'bg-indigo-500',
    stt_language: 'Auto',
    notifications_enabled: false,
    notification_time: '20:00',
    media_display_mode: 'grid',
    lock_enabled: false
};

/**
 * useSettings - Manages user configuration with local-first persistence and offline queuing.
 */
export function useSettings(userId: string | null, isOnline: boolean) {
    const [settings, setSettings] = useState<UserSettings>(() => {
        if (userId) {
            const cached = Storage.getSync(STORAGE_KEYS.SETTINGS_CACHE(userId));
            if (cached) {
                try {
                    return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
                } catch (e) {
                    console.warn('[useSettings] Failed to parse sync cache', e);
                }
            }
        }
        return DEFAULT_SETTINGS;
    });

    const [isLoading, setIsLoading] = useState(true);
    const pendingUpdatesRef = useRef<Partial<UserSettings>>({});
    const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load settings from persistent storage and then fetch fresh if online
    const loadSettings = useCallback(async (uid: string) => {
        setIsLoading(true);

        // 1. Load from native persistent storage
        const persistent = await Storage.getJSON<UserSettings>(STORAGE_KEYS.SETTINGS_CACHE(uid));
        if (persistent) {
            setSettings(prev => ({ ...prev, ...persistent }));
        }

        // 2. Refresh from Supabase if online
        if (isOnline) {
            try {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', uid)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;

                if (data) {
                    const freshSettings = { ...DEFAULT_SETTINGS, ...data };
                    await Storage.setJSON(STORAGE_KEYS.SETTINGS_CACHE(uid), freshSettings);
                    setSettings(freshSettings);
                }
            } catch (err) {
                console.error('[useSettings] Refresh failed', err);
            }
        }
        setIsLoading(false);
    }, [isOnline]);

    useEffect(() => {
        if (userId) {
            loadSettings(userId);
        } else {
            setSettings(DEFAULT_SETTINGS);
            setIsLoading(false);
        }
    }, [userId, loadSettings]);

    /**
     * flush - Actually sends pending updates to the queue or server
     */
    const flush = useCallback(async () => {
        if (!userId || Object.keys(pendingUpdatesRef.current).length === 0) return;

        const updates = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {};

        // 1. Update persistent cache immediately (local-first)
        const cacheKey = STORAGE_KEYS.SETTINGS_CACHE(userId);
        const current = await Storage.getJSON<UserSettings>(cacheKey) || DEFAULT_SETTINGS;
        const updated = { ...current, ...updates };
        await Storage.setJSON(cacheKey, updated);

        // 2. Add to offline queue
        await OfflineQueue.add(userId, {
            type: 'update_settings',
            table: 'user_settings',
            data: {
                user_id: userId,
                ...updates,
                updated_at: new Date().toISOString()
            }
        });

        // 3. If online, trigger immediate flush of queue
        if (isOnline) {
            OfflineQueue.flush(userId).catch(e => console.error('[useSettings] Auto-flush failed', e));
        }
    }, [userId, isOnline]);

    /**
     * updateSetting - Public API to update a setting (debounced)
     */
    const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
        // UI Update (Optimistic)
        setSettings(prev => ({ ...prev, [key]: value }));

        // Stage update
        pendingUpdatesRef.current[key] = value;

        // Reset debounce timer
        if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = setTimeout(flush, 1500); // 1.5s debounce for mobile
    }, [flush]);

    // Force flush on unmount
    useEffect(() => {
        return () => {
            if (flushTimeoutRef.current) {
                clearTimeout(flushTimeoutRef.current);
                flush();
            }
        };
    }, [flush]);

    return { settings, updateSetting, isLoading, refresh: () => userId && loadSettings(userId) };
}
