import { useEffect, useState } from "react";
import { X, Sparkles, Loader2, BookOpen, Quote, Copy, Check } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { ACCENT_COLORS } from "@/constants/colors";
import { supabase } from "@/utils/supabase/client";
import { callGemini } from "@/utils/ai";

interface ReflectionOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    isGuest?: boolean;
    accentColor?: string;
}

interface ReflectionData {
    summary: string;
    themes: string[];
    question: string;
}

export function ReflectionOverlay({
    isOpen,
    onClose,
    userId,
    isGuest = false,
    accentColor = "bg-indigo-500",
}: ReflectionOverlayProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [entriesCount, setEntriesCount] = useState(0);
    const [reflection, setReflection] = useState<ReflectionData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [loadingStage, setLoadingStage] = useState("Gathering entries...");

    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const effectiveId = userId || "guest";

    useEffect(() => {
        if (!isOpen) return;

        // Reset state on open
        setReflection(null);
        setError(null);
        setCopied(false);
        generateReflection();
    }, [isOpen]);

    const generateReflection = async () => {
        setIsLoading(true);
        setLoadingStage("Reading your journal...");

        try {
            // 1. Scan the last 30 days of entries
            const gatheredEntries: { date: string; content: string }[] = [];
            const now = new Date();
            
            for (let i = 0; i < 30; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = format(d, "yyyy-MM-dd");
                
                // Read from local storage
                const cached = Storage.getEntryCacheSync<any>(effectiveId, dateStr);
                if (cached?.content?.trim()) {
                    gatheredEntries.push({ date: dateStr, content: cached.content.trim() });
                }
            }

            // 2. Fetch from Supabase as fallback/refresh if logged in and online
            if (!isGuest && userId && navigator.onLine) {
                try {
                    const thirtyDaysAgo = subDays(now, 30);
                    const { data, error: sbError } = await supabase
                        .from("entries")
                        .select("date, content")
                        .eq("user_id", userId)
                        .gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
                        .not("content", "is", null)
                        .neq("content", "");

                    if (!sbError && data) {
                        const localDates = new Set(gatheredEntries.map(e => e.date));
                        for (const item of data) {
                            if (!localDates.has(item.date)) {
                                gatheredEntries.push({ date: item.date, content: item.content });
                            }
                        }
                    }
                } catch {
                    // Fail silently, use local entries
                }
            }

            // Set entries count
            setEntriesCount(gatheredEntries.length);

            // 3. Enforce minimum of 3 entries to create reflection
            if (gatheredEntries.length < 3) {
                setIsLoading(false);
                return;
            }

            setLoadingStage("Analyzing emotional themes...");
            // Sort by date (descending)
            gatheredEntries.sort((a, b) => b.date.localeCompare(a.date));

            // Formulate prompt
            const entriesText = gatheredEntries
                .map(e => `[Date: ${e.date}]\n${e.content}`)
                .join("\n\n");

            const prompt = `You are a warm, mindful, and insightful personal growth coach. Analyze the following journal entries from the user's recent days and generate a reflection in valid JSON format.

JSON schema to return:
{
  "summary": "A warm, cohesive, empathetic narrative (3-4 sentences) summarizing their mood, achievements, struggles, and core mindset. Speak directly to them in the first person plural or second person (e.g., 'You seem to have...', 'It's clear that...').",
  "themes": [
    "Theme 1 (a concise, poetic name + 1-sentence explanation)",
    "Theme 2 (a concise, poetic name + 1-sentence explanation)",
    "Theme 3 (a concise, poetic name + 1-sentence explanation)"
  ],
  "question": "One deep, thoughtful coaching question designed to prompt their writing or mindfulness in the coming days."
}

Do NOT include any extra text, markdown wrapping (such as \`\`\`json), or conversational filler outside the JSON. Return only the JSON object.

Journal Entries:
${entriesText}`;

            setLoadingStage("Synthesizing reflection...");
            const aiResponse = await callGemini(prompt);
            
            // Parse JSON with robust cleaning of potential markdown tags
            let cleaned = aiResponse.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(cleaned);
            if (parsed.summary && Array.isArray(parsed.themes) && parsed.question) {
                setReflection(parsed);
            } else {
                throw new Error("Invalid schema fields returned by AI");
            }

        } catch (err) {
            console.error("[Reflection] failed:", err);
            setError("Failed to create reflection. Please write a little more or try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (!reflection) return;
        const text = `OneLine Weekly Reflection\n\nReflection Summary:\n${reflection.summary}\n\nKey Themes:\n${reflection.themes.map(t => `- ${t}`).join("\n")}\n\nCoaching Question:\n${reflection.question}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div 
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className={cn("w-5 h-5", accentObj.class)} />
                        <h2 className="text-base font-bold text-zinc-900 dark:text-white">AI Weekly Insights</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                {/* Content Panel */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading ? (
                        /* Premium Loading State */
                        <div className="flex flex-col items-center justify-center py-20 px-4 space-y-4">
                            <div className="relative flex items-center justify-center">
                                <div className={cn("w-12 h-12 rounded-full border-2 border-t-transparent animate-spin", accentObj.borderClass)} />
                                <Sparkles className={cn("absolute w-4 h-4 animate-pulse", accentObj.class)} />
                            </div>
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 text-center animate-pulse">
                                {loadingStage}
                            </p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
                                Looking back to guide you forward.
                            </p>
                        </div>
                    ) : error ? (
                        /* Error State */
                        <div className="flex flex-col items-center justify-center py-16 px-4 space-y-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-500">
                                <X className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 text-center">
                                {error}
                            </p>
                            <button
                                onClick={generateReflection}
                                className={cn("px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95", accentColor)}
                            >
                                Retry
                            </button>
                        </div>
                    ) : entriesCount < 3 ? (
                        /* Empty State: Not enough entries */
                        <div className="flex flex-col items-center justify-center py-16 px-4 space-y-4 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-600 mb-2">
                                <BookOpen className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">More writing needed</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                                You have written <strong className={accentObj.class}>{entriesCount}</strong> {entriesCount === 1 ? "entry" : "entries"} in the last 30 days. Write at least <strong className="text-zinc-800 dark:text-zinc-100">3 entries</strong> so AI can identify your weekly themes!
                            </p>
                            <button
                                onClick={onClose}
                                className={cn("px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 mt-2", accentColor)}
                            >
                                Let's write today's entry
                            </button>
                        </div>
                    ) : reflection ? (
                        /* Reflection Display */
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Summary Card */}
                            <div className="relative bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                <div className="absolute right-4 top-4 text-zinc-100 dark:text-zinc-800/80 pointer-events-none">
                                    <Quote className="w-12 h-12 rotate-180" />
                                </div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
                                    <span>Weekly Narrative</span>
                                </h3>
                                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-light whitespace-pre-wrap relative z-10">
                                    {reflection.summary}
                                </p>
                            </div>

                            {/* Themes list */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                                    Core Themes
                                </h3>
                                <div className="grid gap-3">
                                    {reflection.themes.map((theme, i) => {
                                        const [title, desc] = theme.split(" (");
                                        const cleanDesc = desc ? desc.replace(/\)$/, "") : "";
                                        return (
                                            <div 
                                                key={i} 
                                                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-3 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                                            >
                                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5", accentColor)}>
                                                    {i + 1}
                                                </div>
                                                <div className="space-y-0.5 text-left">
                                                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                        {title}
                                                    </h4>
                                                    {cleanDesc && (
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light leading-relaxed">
                                                            {cleanDesc}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Coaching Question */}
                            <div className="bg-zinc-900 dark:bg-zinc-900/60 text-white p-6 rounded-3xl space-y-3 relative overflow-hidden border border-zinc-800">
                                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                                    <Sparkles className="w-24 h-24 text-white" />
                                </div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                    Mindful Question
                                </h3>
                                <p className="text-base font-light leading-relaxed italic relative z-10">
                                    "{reflection.question}"
                                </p>
                                
                                <div className="flex justify-end pt-2 relative z-10">
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-zinc-300 transition-all duration-150 active:scale-95"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-green-400" />
                                                <span className="text-green-400">Copied</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3.5 h-3.5" />
                                                <span>Copy Reflection</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
