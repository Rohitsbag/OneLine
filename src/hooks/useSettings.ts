import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Storage, STORAGE_KEYS } from '@/utils/storage';

export interface UserSettings {
    accent_color: string;
}

const DEFAULT_SETTINGS: UserSettings = {
    accent_color: 'bg-indigo-500',
};

export function useSettings(userId: string | null, isOnline: boolean) {
    const [settings, setSettings] = useState<UserSettings>(() => {
        if (userId) {
            const cached = Storage.getJSONSync<UserSettings>(STORAGE_KEYS.SETTINGS_CACHE(userId));
            if (cached) return { ...DEFAULT_SETTINGS, ...cached };
        }
        return DEFAULT_SETTINGS;
    });

    // Load from localStorage, refresh from Supabase in background
    const loadSettings = useCallback(async (uid: string) => {
        const cached = Storage.getJSONSync<UserSettings>(STORAGE_KEYS.SETTINGS_CACHE(uid));
        if (cached) setSettings({ ...DEFAULT_SETTINGS, ...cached });

        if (!isOnline) return;
        try {
            const { data } = await supabase
                .from('user_settings')
                .select('accent_color')
                .eq('user_id', uid)
                .single();
            if (data) {
                const fresh = { ...DEFAULT_SETTINGS, ...data };
                await Storage.setJSON(STORAGE_KEYS.SETTINGS_CACHE(uid), fresh);
                setSettings(fresh);
            }
        } catch {
            // Silently fail — localStorage is fine
        }
    }, [isOnline]);

    useEffect(() => {
        if (userId) loadSettings(userId);
        else setSettings(DEFAULT_SETTINGS);
    }, [userId, loadSettings]);

    const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));

        if (userId) {
            const cacheKey = STORAGE_KEYS.SETTINGS_CACHE(userId);
            const current = Storage.getJSONSync<UserSettings>(cacheKey) || DEFAULT_SETTINGS;
            Storage.setJSON(cacheKey, { ...current, [key]: value });

            if (isOnline) {
                supabase.from('user_settings')
                    .upsert({ user_id: userId, [key]: value, updated_at: new Date().toISOString() })
                    .then(({ error }) => { if (error) console.error('[Settings] Sync failed:', error); });
            }
        }
    }, [userId, isOnline]);

    return { settings, updateSetting };
}
