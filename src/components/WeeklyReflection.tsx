import { Sparkles, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { generateContextualSummary } from "@/utils/ai";
import { ACCENT_COLORS } from "@/constants/colors";
import { subDays, format } from "date-fns";

interface WeeklyReflectionProps {
    accentColor?: string;
    date?: Date;
}

export function WeeklyReflection({ accentColor = "bg-indigo-500", date = new Date() }: WeeklyReflectionProps) {
    const [reflection, setReflection] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const textAccent = accentObj.class;
    const hoverBgClass = accentObj.hoverBgClass;

    const generate = async () => {
        // OFFLINE-FIRST: Check connectivity before AI call
        if (!navigator.onLine) {
            setReflection("AI features require internet connection. Please try again when online.");
            return;
        }

        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setReflection("Please sign in to generate reflections.");
                setIsLoading(false);
                return;
            }

            // FILTER: Last 7 Days (Text Only)
            const endDateStr = format(date, 'yyyy-MM-dd');
            const startDateStr = format(subDays(date, 7), 'yyyy-MM-dd');

            const { data: entries, error } = await supabase
                .from('entries')
                .select('date, content')
                .eq('user_id', session.user.id)
                .gte('date', startDateStr)
                .lte('date', endDateStr)
                .order('date', { ascending: true });

            if (error) throw error;

            if (!entries || entries.length === 0) {
                setReflection("No journal entries found in the last 7 days.");
                return;
            }

            // Context: Text only, ignore images/audio columns (already select('date, content') does this implicitly)
            // Explicitly filter empty content just in case
            const contextText = entries
                .filter(e => e.content && e.content.trim().length > 0)
                .map(e => `[${e.date}]: ${e.content}`)
                .join('\n');

            if (contextText.length === 0) {
                setReflection("No text entries found to summarize (images/audio ignored).");
                return;
            }

            const response = await generateContextualSummary(contextText);
            setReflection(response);

        } catch (e) {
            console.error(e);
            setReflection("An error occurred. Please check your connection and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto rounded-3xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 p-6 md:p-8 backdrop-blur-sm min-h-[200px] flex flex-col shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-8 text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className={cn("w-4 h-4", textAccent)} />
                    <span className="text-zinc-900 dark:text-zinc-100 uppercase tracking-widest text-xs">
                        Reflection
                    </span>
                </div>
                <button
                    onClick={generate}
                    disabled={isLoading}
                    className={cn("hover:rotate-180 transition-transform duration-500", isLoading && "animate-spin")}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="flex flex-col items-center justify-center py-4 text-center gap-4 flex-1">
                {reflection ? (
                    <p className="text-zinc-700 dark:text-zinc-200 text-lg font-light leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                        {reflection}
                    </p>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mb-2">
                            <Sparkles className={cn("w-6 h-6 opacity-20", textAccent)} />
                        </div>
                        <p className="text-zinc-500 text-sm max-w-[200px]">No weekly summary generated yet.</p>
                        <button
                            onClick={generate}
                            disabled={isLoading}
                            className={cn(
                                "mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all shadow-lg shadow-black/5 active:scale-95 disabled:opacity-50",
                                accentColor,
                                hoverBgClass
                            )}
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Generating...</span>
                                </div>
                            ) : "Generate Insight"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
