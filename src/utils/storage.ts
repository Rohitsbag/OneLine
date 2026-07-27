export const STORAGE_KEYS = {
    CACHED_USER: 'cached_user',
    THEME: 'theme',
    SETTINGS_CACHE: (uid: string) => `settings_cache_${uid}`,
    ENTRY_CACHE: (uid: string, date: string) => `entry_cache_${uid}_${date}`,
};

/** Fired when localStorage is full so UI can show a warning. */
export let onStorageQuotaExceeded: (() => void) | null = null;
export function setStorageQuotaHandler(fn: () => void) {
    onStorageQuotaExceeded = fn;
}

export const Storage = {
    async get(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },

    async set(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (e: any) {
            if (e?.name === 'QuotaExceededError' || e?.code === 22) {
                console.error('Storage.set: localStorage quota exceeded');
                onStorageQuotaExceeded?.();
            } else {
                console.warn('Storage.set failed:', e);
            }
        }
    },

    async remove(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Storage.remove failed:', e);
        }
    },

    getSync(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },

    setSync(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch (e: any) {
            if (e?.name === 'QuotaExceededError' || e?.code === 22) {
                console.error('Storage.setSync: localStorage quota exceeded');
                onStorageQuotaExceeded?.();
            } else {
                console.warn('Storage.setSync failed:', e);
            }
        }
    },

    removeSync(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Storage.removeSync failed:', e);
        }
    },

    async getJSON<T>(key: string): Promise<T | null> {
        try {
            const value = await this.get(key);
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
        }
    },

    async setJSON(key: string, value: unknown): Promise<void> {
        await this.set(key, JSON.stringify(value));
    },

    setJSONSync(key: string, value: unknown): void {
        this.setSync(key, JSON.stringify(value));
    },

    getJSONSync<T>(key: string): T | null {
        try {
            const value = this.getSync(key);
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
        }
    },

    /**
     * Direct entry lookup by userId + date.
     * No guest fallbacks — userId is always a real authenticated user ID.
     */
    getEntryCacheSync<T = any>(uid: string | null | undefined, dateStr: string): T | null {
        if (!uid) return null;
        return this.getJSONSync<T>(STORAGE_KEYS.ENTRY_CACHE(uid, dateStr));
    },
};
