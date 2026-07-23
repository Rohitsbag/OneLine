import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";
import { supabase } from "@/utils/supabase/client";

import { Storage } from "@/utils/storage";
import { journalStore } from "@/utils/journalStore";

interface CalendarOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDate: (date: Date) => void;
    selectedDate: Date;
    minDate?: Date;
    initialViewDate?: Date;
    onMonthChange?: (date: Date) => void;
    accentColor?: string;
    userId?: string | null; // Optional: if provided, show entry dots
}

export function CalendarOverlay({ isOpen, onClose, onSelectDate, selectedDate, minDate, initialViewDate, onMonthChange, accentColor = "bg-indigo-500", userId }: CalendarOverlayProps) {
    const [viewDate, setViewDate] = useState(initialViewDate || selectedDate);
    const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverTextClass = accentObj.hoverTextClass || "hover:text-white";

    useEffect(() => {
        if (isOpen) {
            setViewDate(initialViewDate || selectedDate);
        }
    }, [isOpen, initialViewDate, selectedDate]);

    // Real-time listener for journal store entry updates
    useEffect(() => {
        const unsubscribe = journalStore.subscribe((dateStr, entry) => {
            if (entry && (entry.content?.trim() || entry.media_items?.length)) {
                setEntryDates(prev => new Set([...prev, dateStr]));
            }
        });
        return unsubscribe;
    }, []);

    // Fetch entry dates for the current month
    useEffect(() => {
        if (!isOpen) return;

        const fetchEntryDates = async () => {
            const monthStart = startOfMonth(viewDate);
            const monthEnd = endOfMonth(viewDate);

            // OFFLINE-FIRST: Load from localStorage cache first
            const cachedDates = new Set<string>();
            try {
                const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
                monthDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const entry = Storage.getEntryCacheSync<any>(userId, dateStr);
                    if (entry && (entry.content?.trim() || entry.media_items?.length)) {
                        cachedDates.add(dateStr);
                    }
                });
                // Set cached dates immediately for instant UI
                if (cachedDates.size > 0) {
                    setEntryDates(new Set(cachedDates));
                }
            } catch (e) {
                console.error("Error loading cached dates:", e);
            }

            // Then try to fetch from Supabase (if online and valid user ID)
            let activeUid = userId;
            if (!activeUid) {
                const cachedUser = Storage.getJSONSync<any>(STORAGE_KEYS.CACHED_USER);
                if (cachedUser?.id) activeUid = cachedUser.id;
            }

            if (!navigator.onLine || !activeUid) return;

            try {
                const { data, error } = await supabase
                    .from('entries')
                    .select('date, content, media_items')
                    .eq('user_id', activeUid)
                    .gte('date', format(monthStart, 'yyyy-MM-dd'))
                    .lte('date', format(monthEnd, 'yyyy-MM-dd'));

                if (!error && data) {
                    const serverDates: string[] = [];
                    for (const e of data) {
                        if (e.content?.trim() || (e.media_items && e.media_items.length > 0)) {
                            serverDates.push(e.date);
                            // Cache to localStorage so JournalEditor & offline modes have entry immediately
                            Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(activeUid, e.date), e);
                        }
                    }
                    setEntryDates(prev => new Set([...prev, ...serverDates]));
                }
            } catch (e) {
                // Network error - keep using cached dates
                console.log("Calendar: Using cached dates (offline)", e);
            }
        };

        fetchEntryDates();
    }, [isOpen, userId, viewDate]);

    if (!isOpen) return null;

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Ensure 6 rows (42 days) to prevent height jumping
    const startPadding = monthStart.getDay();
    const totalSlots = 42;
    const endPadding = totalSlots - (startPadding + daysInMonth.length);

    const isPrevDisabled = !!minDate && endOfMonth(subMonths(viewDate, 1)) < minDate;
    const isNextDisabled = startOfMonth(addMonths(viewDate, 1)) > startOfMonth(new Date());

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-sm touch-manipulation select-none"
            onClick={onClose}
            onTouchEnd={(e) => {
                // Ensure touch events close the modal on mobile
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl transition-colors duration-300 mx-4"
                onClick={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => {
                            if (!isPrevDisabled) {
                                const newDate = subMonths(viewDate, 1);
                                setViewDate(newDate);
                                onMonthChange?.(newDate);
                            }
                        }}
                        className={cn("p-1 transition-opacity", isPrevDisabled ? "text-zinc-600 opacity-30 cursor-not-allowed" : cn("text-zinc-400", hoverTextClass))}
                        disabled={isPrevDisabled}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-medium text-lg text-zinc-900 dark:text-white">
                        {format(viewDate, "MMMM yyyy")}
                    </span>
                    <button
                        onClick={() => {
                            if (!isNextDisabled) {
                                const newDate = addMonths(viewDate, 1);
                                setViewDate(newDate);
                                onMonthChange?.(newDate);
                            }
                        }}
                        disabled={isNextDisabled}
                        className={cn("p-1 text-zinc-400 transition-opacity", isNextDisabled ? "opacity-30 cursor-not-allowed" : hoverTextClass)}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-sm mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                        <div key={day} className="text-zinc-500 font-medium py-2">{day}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: startPadding }).map((_, i) => (
                        <div key={`start-${i}`} className="h-12 w-10" />
                    ))}

                    {daysInMonth.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isToday = isSameDay(day, new Date());
                        const hasEntry = entryDates.has(dateStr);

                        // Disable if in the future (tomorrow and beyond) or before minDate
                        const isFuture = day > new Date(new Date().setHours(23, 59, 59, 999));
                        const isDisabled = isFuture || (minDate ? day < new Date(new Date(minDate).setHours(0, 0, 0, 0)) : false);

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => {
                                    if (!isDisabled) {
                                        onSelectDate(day);
                                        onClose();
                                    }
                                }}
                                disabled={isDisabled}
                                className={cn(
                                    "h-12 w-10 rounded-xl flex flex-col items-center justify-center transition-all gap-0.5",
                                    isSelected ? cn(accentColor, "text-white font-semibold") : "text-zinc-900 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-zinc-800",
                                    !isCurrentMonth && "text-zinc-400 dark:text-zinc-600",
                                    isToday && !isSelected && "border border-zinc-300 dark:border-zinc-700",
                                    isDisabled && "text-zinc-300 dark:text-zinc-600 opacity-50 cursor-not-allowed hover:bg-transparent"
                                )}
                            >
                                <span>{format(day, "d")}</span>
                                {/* Entry indicator dot */}
                                {hasEntry && (
                                    <div className={cn(
                                        "w-1 h-1 rounded-full opacity-50",
                                        isSelected ? "bg-white opacity-60" : accentColor
                                    )} />
                                )}
                            </button>
                        );
                    })}

                    {Array.from({ length: Math.max(0, endPadding) }).map((_, i) => (
                        <div key={`end-${i}`} className="h-12 w-10" />
                    ))}
                </div>
            </div>
        </div>
    );
}

