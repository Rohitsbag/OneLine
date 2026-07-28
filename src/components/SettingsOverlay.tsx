import { X, LogOut, User as UserIcon, FileDown, KeyRound, Loader2, Check } from "lucide-react";
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

    // Change Password state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        // Reset password form state on open
        setShowPasswordForm(false);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMsg(null);

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

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setPasswordMsg({ text: "Password must be at least 6 characters.", type: "error" });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ text: "Passwords do not match.", type: "error" });
            return;
        }

        setIsChangingPassword(true);
        setPasswordMsg(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setPasswordMsg({ text: "Password updated successfully!", type: "success" });
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordMsg(null);
            }, 2000);
        } catch (err: any) {
            setPasswordMsg({ text: err.message || "Failed to update password.", type: "error" });
        } finally {
            setIsChangingPassword(false);
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

                    {/* Theme Color */}
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

                    {/* Inline Change Password Form */}
                    {!isGuest && showPasswordForm && (
                        <form onSubmit={handleChangePassword} className="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Change Password
                            </div>
                            <input
                                type="password"
                                placeholder="New Password (min. 6 chars)"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-white dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 py-2 px-3 rounded-xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
                                required
                                minLength={6}
                            />
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-white dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 py-2 px-3 rounded-xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
                                required
                                minLength={6}
                            />

                            {passwordMsg && (
                                <div className={cn(
                                    "text-xs p-2 rounded-lg border flex items-center gap-1.5",
                                    passwordMsg.type === "success" 
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                        : "bg-red-500/10 border-red-500/20 text-red-500"
                                )}>
                                    {passwordMsg.type === "success" && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    <span>{passwordMsg.text}</span>
                                </div>
                            )}

                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setShowPasswordForm(false); setPasswordMsg(null); }}
                                    className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isChangingPassword}
                                    className={cn(
                                        "flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5",
                                        accentColor
                                    )}
                                >
                                    {isChangingPassword && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Update
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Actions */}
                    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        {!isGuest && (
                            <>
                                <button
                                    onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordMsg(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                                >
                                    <KeyRound className="w-4 h-4 text-zinc-400" />
                                    Change Password
                                </button>
                                <button
                                    onClick={handleExport}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                                >
                                    <FileDown className="w-4 h-4 text-zinc-400" />
                                    Export Entries
                                </button>
                            </>
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
