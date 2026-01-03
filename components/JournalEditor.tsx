"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Camera } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";


interface JournalEditorProps {
    date: Date;
    onDateChange: (date: Date) => void;
}

export function JournalEditor({ date, onDateChange }: JournalEditorProps) {
    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Use prop date instead of internal state
    const currentDate = date;


    // Auth & Initial Fetch
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
            } else {
                // Auto sign-in anonymously for MVP demo if needed, or prompt auth
                // For now, we'll try to sign in anonymously if that setting is enabled in Supabase,
                // or just wait for explicit sign in (which we haven't built yet).
                // Let's assume we need a user ID. 
                // For 'Zero Config' demo, let's check if we can write without auth or if we should just warn.
                console.log("No user session found");
            }
        };
        checkUser();
    }, []);

    // Fetch Entry
    const fetchEntry = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        const { data, error } = await supabase
            .from('entries')
            .select('content')
            .eq('user_id', userId)
            .eq('date', dateStr)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error('Error fetching entry:', error);
        }

        setContent(data?.content || "");
        setIsLoading(false);
    }, [currentDate, userId]);

    useEffect(() => {
        fetchEntry();
    }, [fetchEntry]);

    // Save Entry (Debounced)
    useEffect(() => {
        if (!userId) return;
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        // Simple debounce timeout
        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            const { error } = await supabase
                .from('entries')
                .upsert({
                    user_id: userId,
                    date: dateStr,
                    content: content,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, date' }); // Assuming unique constraint on user_id + date

            if (error) console.error('Error saving:', error);
            setIsSaving(false);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [content, currentDate, userId]);


    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
        onDateChange(newDate);
    };

    const isToday = isSameDay(currentDate, new Date());

    return (
        <div className="flex flex-col flex-1 max-w-2xl w-full mx-auto mt-12 mb-8 items-center">
            {/* Date Navigation */}
            <div className="flex items-center gap-6 mb-12">
                <button onClick={() => navigateDate('prev')} className="text-zinc-500 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-light text-white select-none">
                    {isToday ? "Today" : format(currentDate, "MMMM d, yyyy")}
                </h2>
                <button onClick={() => navigateDate('next')} className="text-zinc-500 hover:text-white transition-colors" disabled={isToday}>
                    <ChevronRight className={cn("w-5 h-5", isToday ? "opacity-0 cursor-default" : "")} />
                </button>
            </div>

            {/* Editor Area */}
            <div className="w-full relative group">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="One line for today..."
                    className="w-full bg-transparent text-xl md:text-2xl text-zinc-100 placeholder:text-zinc-700 resize-none outline-none min-h-[200px] text-center font-light leading-relaxed scrollbar-hide"
                    spellCheck={false}
                />

                {/* Connection Status Indicator */}
                <div className="absolute bottom-[-30px] right-0 text-xs text-zinc-600 font-mono transition-opacity opacity-0 group-hover:opacity-100">
                    {isSaving ? "Saving..." : "Saved"}
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex w-full justify-start gap-4 mt-8 opacity-40 hover:opacity-100 transition-opacity">
                <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                    <Mic className="w-5 h-5" />
                </button>
                <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                    <Camera className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}


