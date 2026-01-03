import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";

interface CalendarOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDate: (date: Date) => void;
    selectedDate: Date;
    minDate?: Date;
    initialViewDate?: Date;
    onMonthChange?: (date: Date) => void;
    accentColor?: string;
}

export function CalendarOverlay({ isOpen, onClose, onSelectDate, selectedDate, minDate, initialViewDate, onMonthChange, accentColor = "bg-indigo-500" }: CalendarOverlayProps) {
    const [viewDate, setViewDate] = useState(initialViewDate || selectedDate);
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverTextClass = accentObj.hoverTextClass || "hover:text-white";

    useEffect(() => {
        if (isOpen) {
            setViewDate(initialViewDate || selectedDate);
        }
    }, [isOpen, initialViewDate, selectedDate]);

    if (!isOpen) return null;

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Ensure 6 rows (42 days) to prevent height jumping
    const startPadding = monthStart.getDay();
    const totalSlots = 42;
    const endPadding = totalSlots - (startPadding + daysInMonth.length);

    const isPrevDisabled = !!minDate && endOfMonth(subMonths(viewDate, 1)) < minDate;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl transition-colors duration-300" onClick={e => e.stopPropagation()}>
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
                            const newDate = addMonths(viewDate, 1);
                            setViewDate(newDate);
                            onMonthChange?.(newDate);
                        }}
                        className={cn("p-1 text-zinc-400", hoverTextClass)}
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
                        <div key={`start-${i}`} className="h-10 w-10" />
                    ))}

                    {daysInMonth.map(day => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isToday = isSameDay(day, new Date());

                        // Disable if before minDate (compare without time, SAFE COPY)
                        const isDisabled = minDate ? day < new Date(new Date(minDate).setHours(0, 0, 0, 0)) : false;

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
                                    "h-10 w-10 rounded-full flex items-center justify-center transition-all",
                                    isSelected ? cn(accentColor, "text-white font-semibold") : "text-zinc-900 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-zinc-800",
                                    !isCurrentMonth && "text-zinc-400 dark:text-zinc-600",
                                    isToday && !isSelected && "border border-zinc-300 dark:border-zinc-700",
                                    isDisabled && "text-zinc-300 dark:text-zinc-600 opacity-50 cursor-not-allowed hover:bg-transparent"
                                )}
                            >
                                {format(day, "d")}
                            </button>
                        );
                    })}

                    {Array.from({ length: Math.max(0, endPadding) }).map((_, i) => (
                        <div key={`end-${i}`} className="h-10 w-10" />
                    ))}
                </div>
            </div>
        </div>
    );
}
