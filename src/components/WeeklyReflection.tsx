import { Sparkles, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { generateWeeklyReflection } from "@/utils/ai";

interface WeeklyReflectionProps {
    accentColor?: string;
}

export function WeeklyReflection({ accentColor = "bg-indigo-500" }: WeeklyReflectionProps) {
    const [reflection, setReflection] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Derive text color from bg accent (bg-indigo-500 -> text-indigo-400/500)
    // Simple heuristic: replace bg- with text-
    const textAccent = accentColor.replace('bg-', 'text-');
    // For gradient, we might stick to a solid color for simplicity and consistency,
    // or map the colors. For now, solid accent text is cleaner than trying to guess a gradient.

    const generate = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setReflection("Please sign in to generate reflections.");
                setIsLoading(false);
                return;
            }

            const response = await generateWeeklyReflection(session.user.id);
            setReflection(response);

        } catch (e) {
            console.error(e);
            setReflection("An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto rounded-3xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 p-6 md:p-8 backdrop-blur-sm min-h-[200px] flex flex-col shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-8 text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className={cn("w-4 h-4", textAccent)} />
                    <span className={cn("bg-clip-text text-transparent bg-gradient-to-r", `from-${accentColor.split('-')[1]}-500`, `to-${accentColor.split('-')[1]}-600`)}>
                        Weekly Reflection
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
                        <p className="text-zinc-500 text-sm">No reflection yet this week</p>
                        <button
                            onClick={generate}
                            disabled={isLoading}
                            className="text-zinc-800 dark:text-zinc-200 text-sm font-medium hover:text-black dark:hover:text-white hover:underline decoration-zinc-300 dark:decoration-zinc-700 underline-offset-4 transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Generating..." : "Generate Reflection"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
