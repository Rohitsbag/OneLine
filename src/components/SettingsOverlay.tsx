import { X, LogOut, User as UserIcon, FileDown, KeyRound, Loader2, Check, MessageSquare, ExternalLink, Clock, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { useNavigate } from "react-router-dom";
import { ACCENT_COLORS } from "@/constants/colors";
import type { UserSettings } from "@/hooks/useSettings";

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    accentColor?: string;
    onAccentChange?: (color: string) => void;
    userId?: string | null;
    settings?: UserSettings;
    onUpdateSetting?: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

const WHATSAPP_BOT_NUMBER = import.meta.env.VITE_WHATSAPP_BOT_NUMBER || "";

export function SettingsOverlay({
    isOpen,
    onClose,
    accentColor = "bg-indigo-500",
    onAccentChange,
    userId,
    settings,
    onUpdateSetting,
}: SettingsOverlayProps) {
    const [email, setEmail] = useState<string | null>(null);
    const navigate = useNavigate();

    // Change Password state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // WhatsApp Pairing & Settings state
    const [isPairing, setIsPairing] = useState(false);
    const [pairCode, setPairCode] = useState<string | null>(null);
    const [pairLoading, setPairLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const pollIntervalRef = useRef<number | null>(null);

    const isConnectedToWhatsApp = Boolean(settings?.whatsapp_phone);

    // Poll for pairing completion
    const checkPairStatus = useCallback(async () => {
        if (!userId) return;
        try {
            const { data } = await supabase
                .from("user_settings")
                .select("whatsapp_phone, reminder_time, reminder_enabled")
                .eq("user_id", userId)
                .single();

            if (data?.whatsapp_phone) {
                if (onUpdateSetting) {
                    onUpdateSetting("whatsapp_phone", data.whatsapp_phone);
                    onUpdateSetting("reminder_time", data.reminder_time);
                    onUpdateSetting("reminder_enabled", data.reminder_enabled);
                }
                setIsPairing(false);
                setPairCode(null);
                if (pollIntervalRef.current) {
                    window.clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            }
        } catch {
            // Silently continue polling
        }
    }, [userId, onUpdateSetting]);

    // Clean up polling interval on unmount or close
    useEffect(() => {
        if (!isOpen || !isPairing) {
            if (pollIntervalRef.current) {
                window.clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        }
    }, [isOpen, isPairing]);

    const handleStartPairing = async () => {
        if (!userId) return;
        setPairLoading(true);
        try {
            // Generate 6-digit cryptographic pairing code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

            await supabase
                .from("user_settings")
                .upsert({
                    user_id: userId,
                    whatsapp_pair_code: code,
                    whatsapp_pair_expires_at: expiresAt,
                    updated_at: new Date().toISOString(),
                });

            setPairCode(code);
            setIsPairing(true);

            // Start polling every 3 seconds for webhook confirmation
            if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = window.setInterval(checkPairStatus, 3000);
        } catch (err) {
            console.error("Pairing initialization failed:", err);
        } finally {
            setPairLoading(false);
        }
    };

    const handleCancelPairing = async () => {
        if (!userId) return;
        setIsPairing(false);
        setPairCode(null);
        if (pollIntervalRef.current) {
            window.clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        try {
            await supabase
                .from("user_settings")
                .update({ whatsapp_pair_code: null, whatsapp_pair_expires_at: null })
                .eq("user_id", userId);
        } catch {
            // ignore
        }
    };

    const handleDisconnectWhatsApp = async () => {
        if (!userId) return;
        if (!window.confirm("Disconnect your WhatsApp number from OneLine?")) return;
        setIsDisconnecting(true);
        try {
            await supabase
                .from("user_settings")
                .update({ whatsapp_phone: null, updated_at: new Date().toISOString() })
                .eq("user_id", userId);

            if (onUpdateSetting) {
                onUpdateSetting("whatsapp_phone", null);
            }
        } catch (err) {
            console.error("Disconnect error:", err);
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleReminderChange = async (time: string) => {
        if (!userId || !onUpdateSetting) return;
        const isOff = time === "off";
        onUpdateSetting("reminder_enabled", !isOff);
        onUpdateSetting("reminder_time", isOff ? "21:00" : time);

        try {
            await supabase
                .from("user_settings")
                .update({
                    reminder_enabled: !isOff,
                    reminder_time: isOff ? null : time,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);
        } catch {
            // ignore
        }
    };

    const handleCopyCode = () => {
        if (!pairCode) return;
        navigator.clipboard.writeText(`LINK ${pairCode}`);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

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

    // Mask phone number for clean privacy: e.g. +91 ••••• ••421
    const maskedPhone = settings?.whatsapp_phone
        ? settings.whatsapp_phone.length > 5
            ? `+${settings.whatsapp_phone.slice(0, 2)} ••••• ••${settings.whatsapp_phone.slice(-3)}`
            : settings.whatsapp_phone
        : "";

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Settings</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
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

                    {/* WhatsApp Journaling Card */}
                    {!isGuest && (
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                        <MessageSquare className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">WhatsApp Diary</div>
                                        <div className="text-[10px] text-zinc-400">Capture thoughts from your chat</div>
                                    </div>
                                </div>
                                {isConnectedToWhatsApp && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Linked
                                    </span>
                                )}
                            </div>

                            {/* State 1: Unlinked */}
                            {!isConnectedToWhatsApp && !isPairing && (
                                <div className="pt-1">
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">
                                        Text, snap photos, or drop voice notes directly on WhatsApp. They instantly sync into your diary.
                                    </p>
                                    <button
                                        onClick={handleStartPairing}
                                        disabled={pairLoading}
                                        className={cn(
                                            "w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm",
                                            accentColor
                                        )}
                                    >
                                        {pairLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                        Connect WhatsApp
                                    </button>
                                </div>
                            )}

                            {/* State 2: Pairing in Progress */}
                            {!isConnectedToWhatsApp && isPairing && pairCode && (
                                <div className="pt-1 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-3 bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
                                        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">
                                            Your 6-Digit Pairing Code
                                        </div>
                                        <div className="text-2xl font-mono font-bold tracking-widest text-zinc-900 dark:text-zinc-100 my-1">
                                            {pairCode.slice(0, 3)} {pairCode.slice(3)}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5 mt-1">
                                            <Clock className="w-3 h-3 text-zinc-400" />
                                            Expires in 10 minutes
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <a
                                            href={`https://wa.me/${WHATSAPP_BOT_NUMBER}?text=LINK%20${pairCode}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(
                                                "flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center shadow-sm",
                                                accentColor
                                            )}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open WhatsApp
                                        </a>
                                        <button
                                            type="button"
                                            onClick={handleCopyCode}
                                            className="px-3 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1"
                                            title="Copy message text"
                                        >
                                            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            {copiedCode ? "Copied" : "Copy"}
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                            Waiting for message...
                                        </div>
                                        <button
                                            onClick={handleCancelPairing}
                                            className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* State 3: Linked & Active */}
                            {isConnectedToWhatsApp && (
                                <div className="pt-1 space-y-3 text-xs animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                        <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Phone Number</span>
                                        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 text-[11px]">{maskedPhone}</span>
                                    </div>

                                    {/* Daily Reminder Selector */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 text-zinc-400" />
                                            Daily Evening Reminder
                                        </label>
                                        <select
                                            value={settings?.reminder_enabled === false ? "off" : (settings?.reminder_time || "21:00")}
                                            onChange={(e) => handleReminderChange(e.target.value)}
                                            className="w-full bg-white dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                                        >
                                            <option value="20:00">8:00 PM (After Dinner)</option>
                                            <option value="21:00">9:00 PM (Bedtime - Recommended)</option>
                                            <option value="22:00">10:00 PM (Late Night)</option>
                                            <option value="off">Turn Off Reminders</option>
                                        </select>
                                    </div>

                                    {/* Disconnect action */}
                                    <div className="pt-1 flex justify-end">
                                        <button
                                            onClick={handleDisconnectWhatsApp}
                                            disabled={isDisconnecting}
                                            className="text-[11px] text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors"
                                        >
                                            {isDisconnecting ? "Disconnecting..." : "Disconnect WhatsApp"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
