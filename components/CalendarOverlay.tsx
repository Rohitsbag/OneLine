"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CalendarOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDate: (date: Date) => void;
    selectedDate: Date;
}

export function CalendarOverlay({ isOpen, onClose, onSelectDate, selectedDate }: CalendarOverlayProps) {
    const [viewDate, setViewDate] = useState(selectedDate);

    if (!isOpen) return null;

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Simple grid padding logic could be added here for perfect alignment, 
    // keeping it minimal for now as per "easy as possible".

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 text-zinc-400 hover:text-white">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-medium text-lg text-white">
                        {format(viewDate, "MMMM yyyy")}
                    </span>
                    <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 text-zinc-400 hover:text-white">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-sm mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                        <div key={day} className="text-zinc-500 font-medium py-2">{day}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {/* Empty cells filler logic omitted for MVP speed, just rendering days */}
                    {/* Prerender empty slots if needed for alignment */}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}

                    {daysInMonth.map(day => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => {
                                    onSelectDate(day);
                                    onClose();
                                }}
                                className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center transition-all",
                                    isSelected ? "bg-zinc-100 text-black font-semibold" : "text-zinc-300 hover:bg-zinc-900",
                                    !isCurrentMonth && "text-zinc-700",
                                    isToday && !isSelected && "border border-zinc-700"
                                )}
                            >
                                {format(day, "d")}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
