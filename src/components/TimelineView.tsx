import { format } from "date-fns";
import { ChevronRight, Image as ImageIcon, Mic, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase/client";

interface TimelineViewProps {
    userId: string;
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    onClose: () => void;
    isOpen: boolean;
    accentColor?: string;
}

interface TimelineEntry {
    date: string;
    content: string;
    hasImage: boolean;
    hasAudio: boolean;
}

const PAGE_SIZE = 30; // Load 30 entries at a time

export function TimelineView({ userId, currentDate, onDateSelect, onClose, isOpen, accentColor = "bg-indigo-500" }: TimelineViewProps) {
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const accentColorPlain = accentColor.replace('bg-', 'text-');

    // Handle animation states
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            // Clear search when panel closes
            setSearchQuery("");
            setDebouncedQuery("");
        }
    }, [isOpen]);

    const handleAnimationEnd = () => {
        if (!isOpen) {
            setIsVisible(false);
        }
    };

    // Debounce search input
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [searchQuery]);

    // Initial fetch (re-runs on search change)
    useEffect(() => {
        if (!userId || !isOpen) return;

        const fetchRecentEntries = async () => {
            setIsLoading(true);
            setOffset(0);
            setHasMore(true);

            let query = supabase
                .from('entries')
                .select('date, content, image_url, audio_url')
                .eq('user_id', userId);

            // Add search filter if query exists
            if (debouncedQuery.trim()) {
                query = query.ilike('content', `%${debouncedQuery.trim()}%`);
            }

            const { data, error } = await query
                .order('date', { ascending: false })
                .range(0, PAGE_SIZE - 1);

            if (!error && data) {
                setEntries(data.map(e => ({
                    date: e.date,
                    content: e.content,
                    hasImage: !!e.image_url,
                    hasAudio: !!e.audio_url
                })));
                setHasMore(data.length === PAGE_SIZE);
                setOffset(PAGE_SIZE);
            }
            setIsLoading(false);
        };

        fetchRecentEntries();
    }, [userId, isOpen, debouncedQuery]);

    // Load more entries with pagination
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore || !userId) return;

        setIsLoadingMore(true);

        let query = supabase
            .from('entries')
            .select('date, content, image_url, audio_url')
            .eq('user_id', userId);

        // Add search filter if query exists
        if (debouncedQuery.trim()) {
            query = query.ilike('content', `%${debouncedQuery.trim()}%`);
        }

        const { data, error } = await query
            .order('date', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

        if (!error && data) {
            setEntries(prev => [...prev, ...data.map(e => ({
                date: e.date,
                content: e.content,
                hasImage: !!e.image_url,
                hasAudio: !!e.audio_url
            }))]);
            setHasMore(data.length === PAGE_SIZE);
            setOffset(prev => prev + PAGE_SIZE);
        }
        setIsLoadingMore(false);
    }, [userId, offset, hasMore, isLoadingMore, debouncedQuery]);

    // Infinite scroll handler
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

        // Load more when within 100px of bottom
        if (scrollBottom < 100 && hasMore && !isLoadingMore) {
            loadMore();
        }
    }, [hasMore, isLoadingMore, loadMore]);

    // Helper function to highlight matching text
    const highlightMatch = (text: string, query: string) => {
        if (!query.trim() || !text) return text;

        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, i) =>
            regex.test(part) ? (
                <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded px-0.5">{part}</mark>
            ) : part
        );
    };

    // Don't render anything if completely hidden
    if (!isVisible && !isOpen) return null;

    return (
        <div className={cn(
            "fixed inset-0 z-[100] flex items-center justify-end transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0"
        )}>
            {/* Backdrop - Opaque on mobile, blurred on desktop */}
            <div
                className="absolute inset-0 bg-black/90 md:bg-black/30 md:dark:bg-black/50 md:backdrop-blur-md pointer-events-auto touch-manipulation transition-opacity duration-300"
                onClick={onClose}
                onTouchEnd={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            />

            {/* Panel with slide animation */}
            <div
                className={cn(
                    "relative w-full max-w-sm h-full bg-white dark:bg-zinc-950 shadow-2xl flex flex-col pointer-events-auto transition-transform duration-300 ease-out",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
                onTransitionEnd={handleAnimationEnd}
            >
                <div className="p-6 pt-safe border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Timeline</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors touch-manipulation">
                        <ChevronRight className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search entries..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-zinc-100 dark:bg-zinc-900 border-0 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4 text-zinc-400" />
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-subtle"
                    onScroll={handleScroll}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className={cn("w-6 h-6 border-2 border-zinc-300 dark:border-zinc-700 rounded-full animate-spin", accentColorPlain.replace('text-', 'border-t-'))} />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                            {debouncedQuery ? (
                                <>
                                    <Search className="w-10 h-10 mb-3 text-zinc-300 dark:text-zinc-700" />
                                    <p className="font-medium">No results found</p>
                                    <p className="text-xs mt-1">Try a different search term</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-10 h-10 mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                        <span className="text-2xl">📝</span>
                                    </div>
                                    <p className="font-medium">No entries yet</p>
                                    <p className="text-xs mt-1">Start writing your first entry!</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {entries.map((entry) => {
                                const isCurrent = format(currentDate, 'yyyy-MM-dd') === entry.date;
                                return (
                                    <button
                                        key={entry.date}
                                        onClick={() => {
                                            onDateSelect(new Date(entry.date));
                                            onClose();
                                        }}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl transition-all border",
                                            isCurrent
                                                ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-800"
                                                : "bg-white dark:bg-zinc-950 border-transparent hover:border-zinc-100 dark:hover:border-zinc-900 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                                {format(new Date(entry.date), "EEEE, MMM d")}
                                            </span>
                                            <div className="flex gap-2">
                                                {entry.hasImage && <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />}
                                                {entry.hasAudio && <Mic className="w-3.5 h-3.5 text-zinc-400" />}
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed italic">
                                            {debouncedQuery ? highlightMatch(entry.content || "No entry", debouncedQuery) : (entry.content || "No entry")}
                                        </p>
                                    </button>
                                );
                            })}

                            {/* Load More Indicator */}
                            {isLoadingMore && (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                                </div>
                            )}

                            {!hasMore && entries.length > 0 && (
                                <div className="text-center py-4 text-xs text-zinc-400">
                                    You've reached the beginning
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
