type JournalChangeListener = (dateStr: string, entry: any) => void;

class JournalStore {
    private listeners: Set<JournalChangeListener> = new Set();

    /** Subscribe to journal entry changes (returns cleanup unsubscribe function) */
    subscribe(listener: JournalChangeListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Broadcast an entry update across all subscribed UI components */
    notifyUpdate(dateStr: string, entry: any): void {
        this.listeners.forEach((listener) => {
            try {
                listener(dateStr, entry);
            } catch (e) {
                console.warn('[JournalStore] Listener error:', e);
            }
        });
    }
}

export const journalStore = new JournalStore();
