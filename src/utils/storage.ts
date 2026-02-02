import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export const STORAGE_KEYS = {
    CACHED_USER: 'cached_user',
    THEME: 'theme',
    SETTINGS_CACHE: (uid: string) => `settings_cache_${uid}`,
    ENTRY_CACHE: (uid: string, date: string) => `entry_cache_${uid}_${date}`,
    PENDING_SYNC: (uid: string) => `pending_sync_${uid}`,
    LAST_SYNC: (uid: string) => `last_sync_${uid}`,
    PENDING_MEDIA: (uid: string) => `pending_media_${uid}`,
};

export const Storage = {
    async get(key: string): Promise<string | null> {
        try {
            if (Capacitor.isNativePlatform()) {
                const { value } = await Preferences.get({ key });
                return value;
            }
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('Storage.get failed:', e);
            return localStorage.getItem(key);
        }
    },

    async set(key: string, value: string): Promise<void> {
        try {
            if (Capacitor.isNativePlatform()) {
                await Preferences.set({ key, value });
            }
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('Storage.set failed:', e);
            try {
                localStorage.setItem(key, value);
            } catch (e2) {
                console.error('Both storage methods failed');
            }
        }
    },

    async remove(key: string): Promise<void> {
        try {
            if (Capacitor.isNativePlatform()) {
                await Preferences.remove({ key });
            }
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Storage.remove failed:', e);
        }
    },

    // Synchronous get for initial render (uses localStorage mirror)
    getSync(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },

    async getJSON<T>(key: string): Promise<T | null> {
        try {
            const value = await this.get(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error(`Failed to parse ${key}:`, e);
            return null;
        }
    },

    async setJSON(key: string, value: unknown): Promise<void> {
        await this.set(key, JSON.stringify(value));
    },

    getJSONSync<T>(key: string): T | null {
        try {
            const value = this.getSync(key);
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
        }
    }
};
