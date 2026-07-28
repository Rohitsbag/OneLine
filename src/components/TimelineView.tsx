import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { ACCENT_COLORS } from "@/constants/colors";
import { resolveMediaUrl } from "@/utils/media";
import { CustomAudioPlayer } from "./JournalEditor";
import { journalStore } from "@/utils/journalStore";

interface Entry {
    date: string;
    content: string;
    media_items?: { type: "image" | "audio"; url: string; duration?: number }[];
}

interface TimelineViewProps {
    userId: string;
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    onClose: () => void;
    isOpen: boolean;
    accentColor?: string;
    isGuest?: boolean;
}

export function TimelineView({
    userId,
    currentDate,
    onDateSelect,
    onClose,
    isOpen,
    accentColor = "bg-indigo-500",
    isGuest = false,
}: TimelineViewProps) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];

    // Helper to resolve media URLs to signed URLs
    const resolveEntriesMedia = async (rawEntries: Entry[]): Promise<Entry[]> => {
        return Promise.all(
            rawEntries.map(async (entry) => {
                if (!entry.media_items || entry.media_items.length === 0) return entry;
                const resolvedItems = await Promise.all(
                    entry.media_items.map(async (item) => ({
                        ...item,
                        url: await resolveMediaUrl(item.url),
                    }))
                );
                return { ...entry, media_items: resolvedItems };
            })
        );
    };

    const loadEntries = useCallback(async () => {
        setIsLoading(true);

        if (isGuest || !userId) {
            setEntries([]);
            setIsLoading(false);
            return;
        }

        // Fast load from localStorage cache without locking main thread
        const localEntries: Entry[] = [];
        const now = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = format(d, "yyyy-MM-dd");
            const cached = Storage.getEntryCacheSync<any>(userId, dateStr);
            if (cached?.content?.trim() || cached?.media_items?.length) {
                localEntries.push({ 
                    date: dateStr, 
                    content: cached.content?.trim() || "",
                    media_items: cached.media_items
                });
            }
        }
        
        const resolvedLocal = await resolveEntriesMedia(localEntries);
        setEntries(resolvedLocal);
        setIsLoading(false);

        // Fetch up to 200 recent entries from Supabase
        if (navigator.onLine) {
            try {
                const { data, error } = await supabase
                    .from("entries")
                    .select("date, content, media_items")
                    .eq("user_id", userId)
                    .not("content", "is", null)
                    .neq("content", "")
                    .order("date", { ascending: false })
                    .limit(200);

                if (!error && data) {
                    for (const e of data) {
                        Storage.setJSONSync(STORAGE_KEYS.ENTRY_CACHE(userId, e.date), e);
                    }
                    const serverDates = new Set(data.map(e => e.date));
                    const merged = [
                        ...data,
                        ...localEntries.filter(e => !serverDates.has(e.date)),
                    ].sort((a, b) => b.date.localeCompare(a.date));
                    
                    const resolvedMerged = await resolveEntriesMedia(merged);
                    setEntries(resolvedMerged);
                }
            } catch (err) {
                console.warn("[TimelineView] Supabase fetch error:", err);
            }
        }
    }, [isGuest, userId]);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery("");
            loadEntries();
        }
    }, [isOpen, loadEntries]);

    useEffect(() => {
        const unsubscribe = journalStore.subscribe(() => {
            if (isOpen) loadEntries();
        });
        return unsubscribe;
    }, [isOpen, loadEntries]);

    const filtered = searchQuery.trim()
        ? entries.filter(e =>
            e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.date.includes(searchQuery)
        )
        : entries;

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Timeline</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search entries…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                        />
                    </div>
                </div>

                {/* Entries */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center gap-2">
                            <p className="text-zinc-400 text-sm">
                                {searchQuery ? "No entries match your search." : "No entries yet. Start writing!"}
                            </p>
                        </div>
                    ) : (
                        <div className="p-3 space-y-1">
                            {filtered.map(entry => {
                                const entryDate = parseISO(entry.date);
                                const isSelected = format(currentDate, "yyyy-MM-dd") === entry.date;
                                return (
                                    <button
                                        key={entry.date}
                                        onClick={() => { onDateSelect(entryDate); onClose(); }}
                                        className={cn(
                                            "w-full text-left px-4 py-3 rounded-2xl transition-all group",
                                            isSelected
                                                ? cn(accentObj.bgClass, "text-white")
                                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                        )}
                                    >
                                        <div className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest mb-1",
                                            isSelected ? "text-white/70" : "text-zinc-400"
                                        )}>
                                            {format(entryDate, "EEEE, MMM d, yyyy")}
                                        </div>
                                        <div className={cn(
                                            "text-sm leading-relaxed line-clamp-2",
                                            isSelected ? "text-white" : "text-zinc-700 dark:text-zinc-300"
                                        )}>
                                            {entry.content}
                                        </div>

                                        {entry.media_items && entry.media_items.length > 0 && (
                                            <div className="mt-3 space-y-2 flex flex-col items-start w-full" onClick={e => e.stopPropagation()}>
                                                {/* Image Thumbnail */}
                                                {entry.media_items.filter(item => item.type === "image").map((item, idx) => (
                                                    <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 w-full max-h-32 aspect-video bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                                                        <img 
                                                            src={item.url} 
                                                            alt="Attachment" 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ))}

                                                {/* Audio player */}
                                                {entry.media_items.filter(item => item.type === "audio").map((item, idx) => (
                                                    <CustomAudioPlayer 
                                                        key={idx}
                                                        url={item.url} 
                                                        accentColor={accentColor}
                                                        knownDuration={item.duration}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer count */}
                {!isLoading && filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                        <p className="text-[10px] text-zinc-400 text-center font-medium">
                            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                            {searchQuery ? " found" : " total"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
