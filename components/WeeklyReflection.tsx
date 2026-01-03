"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";


export function WeeklyReflection() {
    const [reflection, setReflection] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const generateReflection = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setReflection("Please sign in to generate reflections.");
                setIsLoading(false);
                return;
            }

            const res = await fetch('/api/reflect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id })
            });

            const data = await res.json();
            if (data.reflection) {
                setReflection(data.reflection);
            } else {
                setReflection("Failed to generate reflection. Please try again.");
            }
        } catch (e) {
            console.error(e);
            setReflection("An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto rounded-3xl bg-zinc-900/40 border border-zinc-800/50 p-6 md:p-8 backdrop-blur-sm min-h-[200px] flex flex-col">
            <div className="flex items-center justify-between mb-8 text-zinc-400">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Weekly Reflection</span>
                </div>
                <button
                    onClick={generateReflection}
                    disabled={isLoading}
                    className={cn("hover:rotate-180 transition-transform duration-500", isLoading && "animate-spin")}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="flex flex-col items-center justify-center py-4 text-center gap-4 flex-1">
                {reflection ? (
                    <p className="text-zinc-200 text-lg font-light leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                        {reflection}
                    </p>
                ) : (
                    <>
                        <p className="text-zinc-500 text-sm">No reflection yet this week</p>
                        <button
                            onClick={generateReflection}
                            disabled={isLoading}
                            className="text-zinc-200 text-sm font-medium hover:text-white hover:underline decoration-zinc-700 underline-offset-4 transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Generating..." : "Generate Reflection"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}


