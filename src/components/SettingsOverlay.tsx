import { X, LogOut, User as UserIcon, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useNavigate } from "react-router-dom";
import { ACCENT_COLORS } from "@/constants/colors";

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    accentColor?: string;
    onAccentChange?: (color: string) => void;
}

export function SettingsOverlay({
    isOpen,
    onClose,
    accentColor = "bg-indigo-500",
    onAccentChange,
}: SettingsOverlayProps) {
    const [email, setEmail] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen) return;
        // Read email from localStorage cache (instant, no network)
        try {
            const raw = localStorage.getItem("cached_user");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.email) { setEmail(parsed.email); return; }
            }
        } catch { /* ignore */ }
        setEmail(null);
    }, [isOpen]);

    const handleSignOut = async () => {
        localStorage.removeItem("cached_user");
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        onClose();
        navigate("/auth");
    };

    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { alert("Sign in to export your data."); setIsExporting(false); return; }

            const { data } = await supabase
                .from("entries")
                .select("date, content")
                .eq("user_id", user.id)
                .order("date", { ascending: false });

            if (!data?.length) { alert("No entries to export."); setIsExporting(false); return; }

            const text = data.map(e => `${e.date}\n${e.content || "(no entry)"}`).join("\n\n---\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `oneline-${new Date().toISOString().split("T")[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            alert("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    const isGuest = !email;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Settings</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Account */}
                    <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                            <UserIcon className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mb-0.5">
                                {isGuest ? "Not signed in" : "Account"}
                            </div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {isGuest ? (
                                    <button onClick={() => { onClose(); navigate("/auth"); }} className="text-indigo-500 hover:underline">
                                        Sign in to sync →
                                    </button>
                                ) : email}
                            </div>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div>
                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3 px-1">Theme Color</div>
                        <div className="flex gap-2 flex-wrap">
                            {ACCENT_COLORS.map((color) => (
                                <button
                                    key={color.name}
                                    onClick={() => onAccentChange?.(color.bgClass)}
                                    className={cn(
                                        "w-8 h-8 rounded-full transition-all active:scale-90",
                                        color.bgClass,
                                        accentColor === color.bgClass && "ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-950"
                                    )}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        {!isGuest && (
                            <button
                                onClick={handleExport}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                            >
                                <FileDown className="w-4 h-4 text-zinc-400" />
                                Export Entries
                            </button>
                        )}
                        {!isGuest ? (
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm font-semibold text-red-500"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        ) : (
                            <button
                                onClick={() => { onClose(); navigate("/auth"); }}
                                className={cn("w-full py-3 rounded-2xl text-white text-sm font-bold transition-all active:scale-95", accentColor)}
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
