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
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('Storage.get failed:', e);
            return null;
        }
    },

    async set(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('Storage.set failed:', e);
        }
    },

    async remove(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Storage.remove failed:', e);
        }
    },

    // Synchronous get for initial render
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
    },

    // Resilient entry cache lookup that searches fallback UID prefixes & wildcard keys
    getEntryCacheSync<T = any>(uid: string | null | undefined, dateStr: string): T | null {
        try {
            // 1. Primary lookup using specified UID
            if (uid) {
                const primary = this.getJSONSync<T>(STORAGE_KEYS.ENTRY_CACHE(uid, dateStr));
                if (primary) return primary;
            }

            // 2. Fallback lookups for guest and null keys
            const guest = this.getJSONSync<T>(STORAGE_KEYS.ENTRY_CACHE('guest', dateStr));
            if (guest) return guest;
            const nullKey = this.getJSONSync<T>(STORAGE_KEYS.ENTRY_CACHE('null', dateStr));
            if (nullKey) return nullKey;

            // 3. Dynamic wildcard search across all localStorage keys for matching date suffix
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('entry_cache_') && key.endsWith(`_${dateStr}`)) {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && (parsed.content || parsed.media_items)) {
                                return parsed as T;
                            }
                        } catch { /* ignore parse error */ }
                    }
                }
            }
        } catch (e) {
            console.warn('Storage.getEntryCacheSync error:', e);
        }
        return null;
    }
};

