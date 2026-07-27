import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Storage, STORAGE_KEYS } from '@/utils/storage';

export interface UserSettings {
    accent_color: string;
    updated_at?: string;
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

    const loadSettings = useCallback(async (uid: string) => {
        const cached = Storage.getJSONSync<UserSettings>(STORAGE_KEYS.SETTINGS_CACHE(uid));
        if (cached) setSettings({ ...DEFAULT_SETTINGS, ...cached });

        if (!isOnline) return;
        try {
            const { data } = await supabase
                .from('user_settings')
                .select('accent_color, updated_at')
                .eq('user_id', uid)
                .single();

            if (data) {
                const localUpdatedAt = cached?.updated_at || '1970-01-01T00:00:00.000Z';
                const serverUpdatedAt = data.updated_at || '1970-01-01T00:00:00.000Z';

                if (serverUpdatedAt > localUpdatedAt) {
                    // Server is newer — apply server settings
                    const fresh = { ...DEFAULT_SETTINGS, ...data };
                    await Storage.setJSON(STORAGE_KEYS.SETTINGS_CACHE(uid), fresh);
                    setSettings(fresh);
                } else if (cached && localUpdatedAt > serverUpdatedAt) {
                    // Local is newer (changed offline) — push local up to server
                    supabase.from('user_settings')
                        .upsert({ user_id: uid, ...cached, updated_at: cached.updated_at })
                        .then(({ error }) => { if (error) console.error('[Settings] Offline sync push failed:', error); });
                }
                // If equal, no action needed
            }
        } catch {
            // Silently fail — localStorage is still good
        }
    }, [isOnline]);

    useEffect(() => {
        if (userId) loadSettings(userId);
        else setSettings(DEFAULT_SETTINGS);
    }, [userId, loadSettings]);

    const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
        const now = new Date().toISOString();
        setSettings(prev => ({ ...prev, [key]: value, updated_at: now }));

        if (userId) {
            const cacheKey = STORAGE_KEYS.SETTINGS_CACHE(userId);
            const current = Storage.getJSONSync<UserSettings>(cacheKey) || DEFAULT_SETTINGS;
            const updated = { ...current, [key]: value, updated_at: now };
            Storage.setJSON(cacheKey, updated);

            if (isOnline) {
                supabase.from('user_settings')
                    .upsert({ user_id: userId, [key]: value, updated_at: now })
                    .then(({ error }) => { if (error) console.error('[Settings] Sync failed:', error); });
            }
        }
    }, [userId, isOnline]);

    return { settings, updateSetting };
}
