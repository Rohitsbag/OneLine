import { X, FileDown, LogOut, User as UserIcon, Info } from "lucide-react";
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
    /* ... skipping unchanged lines is better handled by concise replacements but context is needed ... */
    /* ... I will replace the top interface and function signature, and the specific toggle section ... */
    /* Actually, I should use TWO chunks for cleaner edits if possible, OR one large one if context overlaps significantly. */
    /* The props change is at the top, the toggle UI is in the middle. I'll use multi_replace for accuracy. */

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

        const { data: entries } = await supabase
            .from('entries')
            .select('*')
            .eq('user_id', user.id);

        if (!entries) return;

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
    const hoverBgClass = accentObj.hoverBgClass || "hover:bg-zinc-200";

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
                            <div className="flex items-center gap-2 mb-6">
                                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">AI Features</h3>
                                <div className="group relative">
                                    <div className="p-1 rounded-full cursor-help hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                                        <Info className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400" />
                                    </div>
                                    {/* Tooltip */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs rounded-xl shadow-xl opacity-0 translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 transition-all pointer-events-none z-50 text-center leading-relaxed">
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px w-2 h-2 bg-white dark:bg-zinc-900 border-l border-t border-zinc-200 dark:border-zinc-800 rotate-45 transform"></div>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-200 block mb-1">Privacy First</span>
                                        AI features are strictly opt-in. Your data is never used for model training.
                                    </div>
                                </div>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 overflow-hidden">
                                <div className="p-6 flex items-center justify-between">
                                    <div>
                                        <div className="text-zinc-900 dark:text-zinc-200 font-medium mb-1">AI Reflections</div>
                                        <div className="text-zinc-500 text-sm">Enable weekly summaries and gentle memory prompts</div>
                                    </div>
                                    <button
                                        onClick={() => onToggleAi(!aiEnabled)}
                                        className={cn("w-12 h-6 rounded-full relative transition-colors duration-200", aiEnabled ? accentColor : "bg-zinc-200 dark:bg-zinc-800")}
                                    >
                                        <div className={cn("w-4 h-4 rounded-full absolute top-1 transition-all duration-200 shadow-sm", aiEnabled ? "bg-white left-7" : "bg-white dark:bg-zinc-500 left-1")}></div>
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Data */}
                        <section>
                            <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">Your Data</h3>
                            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 p-6">
                                <button
                                    onClick={handleExport}
                                    className={cn(
                                        "w-full text-white font-medium h-12 rounded-xl transition-colors flex items-center justify-center gap-2",
                                        accentColor,
                                        hoverBgClass
                                    )}
                                >
                                    <FileDown className="w-4 h-4" />
                                    Export All Data
                                </button>
                                <div className="mt-4 text-center text-zinc-500 dark:text-zinc-600 text-xs">
                                    Download all your journal entries as a JSON file.
                                </div>
                            </div>
                        </section>

                        {/* Account Actions */}
                        <section>
                            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800/50 p-6">
                                <button
                                    onClick={handleSignOut}
                                    className="w-full bg-white dark:bg-zinc-900 text-red-500 dark:text-red-400 font-medium h-12 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800"
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
