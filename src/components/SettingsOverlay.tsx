import { X, FileDown, LogOut, User as UserIcon, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useNavigate } from "react-router-dom";
import { ACCENT_COLORS } from "@/constants/colors";

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    aiEnabled: boolean;
    onToggleAi: (enabled: boolean) => void;
    accentColor?: string;
    onAccentChange?: (color: string) => void;
}

export function SettingsOverlay({ isOpen, onClose, aiEnabled, onToggleAi, accentColor = "bg-indigo-500", onAccentChange }: SettingsOverlayProps) {
    const [email, setEmail] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            supabase.auth.getUser().then(({ data }) => {
                setEmail(data.user?.email || "User");
            });
        }
    }, [isOpen]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        onClose();
        navigate('/auth');
    };

    const handleExport = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // SCALABILITY: Limit export to prevent memory issues on long-term users
        const EXPORT_LIMIT = 1000;
        const { data: entries, count } = await supabase
            .from('entries')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(EXPORT_LIMIT);

        if (!entries) return;

        // Warn user if data was truncated
        if (count && count > EXPORT_LIMIT) {
            alert(`Note: Export limited to most recent ${EXPORT_LIMIT} entries. You have ${count} total entries.`);
        }

        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oneline-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-white dark:bg-[#0a0a0a] p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors mr-2">
                            <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                        </button>
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Settings</h2>
                    </div>
                </div>

                {/* Scrollable Content Wrapper */}
                <div className="flex-1 overflow-y-auto scrollbar-subtle">
                    <div className="p-8 space-y-12">

                        {/* Account Info Display */}
                        <section>
                            <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">Account</h3>
                            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 p-6 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                                    <UserIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-zinc-900 dark:text-white font-medium">{email || "Loading..."}</div>
                                </div>
                            </div>
                        </section>

                        {/* Appearance */}
                        <section>
                            <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">Appearance</h3>
                            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <div className="text-zinc-900 dark:text-zinc-200 font-medium mb-1">Accent Color</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {ACCENT_COLORS.map((color) => (
                                            <button
                                                key={color.name}
                                                onClick={() => onAccentChange?.(color.bgClass)}
                                                className={cn(
                                                    "w-8 h-8 md:w-6 md:h-6 rounded-full transition-transform hover:scale-110 cursor-pointer",
                                                    color.bgClass,
                                                    accentColor === color.bgClass && "ring-2 ring-zinc-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-black"
                                                )}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* AI Features */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-widest text-[10px]">AI Capabilities</h3>
                                <div className="group relative">
                                    <div className="p-1 rounded-full cursor-help hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                                        <Info className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs rounded-2xl shadow-2xl opacity-0 translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 transition-all pointer-events-none z-50 text-center leading-relaxed">
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px w-2 h-2 bg-white dark:bg-zinc-900 border-l border-t border-zinc-200 dark:border-zinc-800 rotate-45 transform"></div>
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">Encrypted & Private</span>
                                        Your line is only yours. AI features are opt-in and processed locally or via secure inference.
                                    </div>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 p-1.5 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700">
                                <button
                                    onClick={() => onToggleAi(!aiEnabled)}
                                    className="w-full flex items-center gap-5 p-4 rounded-[2.1rem] transition-all focus:outline-none"
                                >
                                    <div className={cn(
                                        "w-14 h-14 rounded-[1.4rem] flex items-center justify-center transition-all duration-500 relative overflow-hidden",
                                        aiEnabled ? cn(accentColor, "bg-opacity-20 shadow-[0_0_20px_rgba(0,0,0,0.1)]") : "bg-zinc-200 dark:bg-zinc-800"
                                    )}>
                                        {aiEnabled && (
                                            <div className={cn("absolute inset-0 opacity-20 blur-xl animate-pulse-slow", accentColor)} />
                                        )}
                                        <Sparkles className={cn("w-7 h-7 relative z-10 transition-colors duration-500", aiEnabled ? accentObj.class : "text-zinc-400")} />
                                    </div>

                                    <div className="text-left flex-1 min-w-0">
                                        <div className="text-zinc-900 dark:text-zinc-100 font-bold text-lg mb-1 tracking-tight">AI Reflections</div>
                                        <div className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-widest opacity-80">Weekly Insights</div>
                                    </div>

                                    <div
                                        className={cn(
                                            "w-12 h-7 rounded-full relative transition-all duration-500 p-1 ring-1 ring-inset shadow-inner",
                                            aiEnabled
                                                ? cn(accentColor, "ring-black/5 dark:ring-white/5")
                                                : "bg-zinc-200 dark:bg-zinc-800 ring-zinc-300 dark:ring-zinc-700"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-500 transform",
                                            aiEnabled ? "translate-x-5" : "translate-x-0"
                                        )}></div>
                                    </div>
                                </button>
                            </div>
                        </section>

                        {/* Data */}
                        <section>
                            <h3 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-widest text-[10px]">Your Data</h3>
                            <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-6 group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                                <div className={cn(
                                    "w-20 h-20 rounded-3xl flex items-center justify-center relative transition-all duration-700",
                                    "bg-white dark:bg-zinc-800 shadow-xl shadow-black/5"
                                )}>
                                    <div className={cn("absolute inset-0 opacity-10 blur-2xl transition-all duration-1000 group-hover:opacity-30", accentColor)} />
                                    <FileDown className={cn("w-10 h-10 relative z-10", accentObj.class)} />
                                </div>

                                <div className="space-y-1">
                                    <h4 className="text-zinc-900 dark:text-zinc-100 font-bold text-xl tracking-tight">Export Journal</h4>
                                    <p className="text-zinc-500 dark:text-zinc-500 text-sm max-w-[260px] leading-relaxed font-medium">
                                        Your line is only yours. Download your entire history as a secure JSON file anytime.
                                    </p>
                                </div>

                                <button
                                    onClick={handleExport}
                                    className={cn(
                                        "w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-white shadow-2xl transition-all active:scale-95",
                                        accentObj.bgClass,
                                        accentObj.hoverBgClass
                                    )}
                                    title="Export All Journal Data"
                                >
                                    <span className="relative z-10">Download History</span>
                                </button>
                            </div>
                        </section>

                        {/* Account Actions */}
                        <section>
                            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-2">
                                <button
                                    onClick={handleSignOut}
                                    className="w-full h-12 rounded-[1.5rem] bg-white dark:bg-zinc-900 text-red-500 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 border border-zinc-200 dark:border-red-500/20 shadow-sm"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </div>
    );
}
