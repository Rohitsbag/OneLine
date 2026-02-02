import { Storage, STORAGE_KEYS } from './storage';
import { supabase } from './supabase/client';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface PendingOperation {
    id: string;
    type: 'upsert_entry' | 'update_settings' | 'upload_media';
    table: string;
    data: Record<string, unknown>;
    timestamp: number;
    retryCount?: number;
}

interface PendingMedia {
    localPath: string;
    remotePath: string;
    type: 'image' | 'audio' | 'video';
    entryDate: string;
}

export const OfflineQueue = {
    async add(userId: string, operation: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
        const key = STORAGE_KEYS.PENDING_SYNC(userId);
        const existing = await Storage.getJSON<PendingOperation[]>(key) || [];

        // Merge logic: Replace existing operation for same entry date
        const newOp: PendingOperation = {
            ...operation,
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retryCount: 0
        };

        // For entry upserts, replace existing for same date
        if (operation.type === 'upsert_entry' && operation.data.date) {
            const filtered = existing.filter(op =>
                !(op.type === 'upsert_entry' && op.data.date === operation.data.date)
            );
            filtered.push(newOp);
            await Storage.setJSON(key, filtered);
        } else {
            existing.push(newOp);
            await Storage.setJSON(key, existing);
        }
    },

    async addPendingMedia(userId: string, media: PendingMedia): Promise<void> {
        const key = STORAGE_KEYS.PENDING_MEDIA(userId);
        const existing = await Storage.getJSON<PendingMedia[]>(key) || [];
        existing.push(media);
        await Storage.setJSON(key, existing);
    },

    async flush(userId: string): Promise<{ success: number; failed: number }> {
        const key = STORAGE_KEYS.PENDING_SYNC(userId);
        const pending = await Storage.getJSON<PendingOperation[]>(key) || [];

        if (pending.length === 0) return { success: 0, failed: 0 };

        let success = 0;
        let failed = 0;
        const remaining: PendingOperation[] = [];

        for (const op of pending) {
            try {
                if (op.type === 'upsert_entry') {
                    const { error } = await supabase
                        .from('entries')
                        .upsert(op.data, { onConflict: 'user_id,date' });

                    if (error) throw error;
                    success++;
                } else if (op.type === 'update_settings') {
                    const { error } = await supabase
                        .from('user_settings')
                        .upsert(op.data);

                    if (error) throw error;
                    success++;
                }
            } catch (e) {
                console.error('Flush operation failed:', op.id, e);
                op.retryCount = (op.retryCount || 0) + 1;
                if (op.retryCount < 5) {
                    remaining.push(op);
                }
                failed++;
            }
        }

        await Storage.setJSON(key, remaining);

        // Also flush pending media
        await this.flushPendingMedia(userId);

        return { success, failed };
    },

    async flushPendingMedia(userId: string): Promise<void> {
        const key = STORAGE_KEYS.PENDING_MEDIA(userId);
        const pending = await Storage.getJSON<PendingMedia[]>(key) || [];

        if (pending.length === 0) return;

        const remaining: PendingMedia[] = [];

        for (const media of pending) {
            try {
                // Read local file
                const fileData = await Filesystem.readFile({
                    path: media.localPath.replace('local://', ''),
                    directory: Directory.Data
                });

                // Convert base64 to blob
                const base64 = fileData.data as string;
                const mimeType = media.type === 'image' ? 'image/webp' :
                    media.type === 'audio' ? 'audio/webm' : 'video/mp4';

                const byteCharacters = atob(base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });

                // Upload to Supabase
                const { error } = await supabase.storage
                    .from('journal-media-private')
                    .upload(media.remotePath, blob);

                if (error) throw error;

                // Update entry to replace local:// URL with remote path
                const entryKey = STORAGE_KEYS.ENTRY_CACHE(userId, media.entryDate);
                const entry = await Storage.getJSON<any>(entryKey);
                if (entry?.media_items) {
                    entry.media_items = entry.media_items.map((item: any) =>
                        item.url === media.localPath
                            ? { ...item, url: media.remotePath }
                            : item
                    );
                    await Storage.setJSON(entryKey, entry);

                    // Also update in database
                    await supabase
                        .from('entries')
                        .update({ media_items: entry.media_items })
                        .eq('user_id', userId)
                        .eq('date', media.entryDate);
                }

                // Delete local file
                await Filesystem.deleteFile({
                    path: media.localPath.replace('local://', ''),
                    directory: Directory.Data
                }).catch(() => { });

            } catch (e) {
                console.error('Media upload failed:', media.localPath, e);
                remaining.push(media);
            }
        }

        await Storage.setJSON(key, remaining);
    },

    async getPendingCount(userId: string): Promise<number> {
        const opsKey = STORAGE_KEYS.PENDING_SYNC(userId);
        const mediaKey = STORAGE_KEYS.PENDING_MEDIA(userId);
        const ops = await Storage.getJSON<PendingOperation[]>(opsKey) || [];
        const media = await Storage.getJSON<PendingMedia[]>(mediaKey) || [];
        return ops.length + media.length;
    }
};
