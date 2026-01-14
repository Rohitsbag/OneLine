import { X, FileDown, LogOut, User as UserIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { hashPin, generateDeviceSalt } from "@/utils/security";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ACCENT_COLORS } from "@/constants/colors";
import { useToast } from "./Toast";
import { TimePicker } from "./ui/time-picker";
import { parse, format } from "date-fns";
import { requestNotificationPermission, scheduleDailyReminder, cancelDailyReminder } from "@/utils/notifications";

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    aiEnabled: boolean;
    onToggleAi: (enabled: boolean) => void;
    accentColor?: string;
    onAccentChange?: (color: string) => void;
    sttLanguage?: string;
    onLanguageChange?: (lang: string) => void;
    lockEnabled?: boolean;
    onToggleLock?: (enabled: boolean) => void;
    notificationsEnabled?: boolean;
    onToggleNotifications?: (enabled: boolean) => void;
    notificationTime?: string;
    onTimeChange?: (time: string) => void;
    pinCode?: string | null;
    onPinChange?: (pin: string) => void;
    isForcedSetup?: boolean;
}

export function SettingsOverlay({
    isOpen, onClose, aiEnabled: _aiEnabled, onToggleAi: _onToggleAi,
    accentColor = "bg-indigo-500", onAccentChange,
    sttLanguage = "Auto", onLanguageChange,
    lockEnabled = false, onToggleLock,
    notificationsEnabled = false, onToggleNotifications,
    notificationTime = "20:00", onTimeChange,
    pinCode = null, onPinChange,
    isForcedSetup = false
}: SettingsOverlayProps) {
    const [email, setEmail] = useState<string | null>(null);
    const [pinLength, setPinLength] = useState<4 | 6>(pinCode?.length === 6 ? 6 : 4);
    const [tempPin, setTempPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [setupStep, setSetupStep] = useState<"initial" | "confirm">("initial");
    const [isSaving, setIsSaving] = useState(false);

    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            supabase.auth.getUser().then(({ data }) => {
                setEmail(data.user?.email || "User");
            });
        }
    }, [isOpen]);

    const handleSignOut = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            localStorage.removeItem(`pin_hash_${user.id}`);
            localStorage.removeItem(`device_salt_${user.id}`);
            localStorage.removeItem('cached_user_settings');
            localStorage.removeItem('cached_user');
        }
        await supabase.auth.signOut();
        onClose();
        navigate('/auth');
    };

    const handleExport = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const EXPORT_LIMIT = 1000;
        const { data: entries, count } = await supabase
            .from('entries')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(EXPORT_LIMIT);

        if (!entries) return;

        if (count && count > EXPORT_LIMIT) {
            showToast(`Export limited to most recent ${EXPORT_LIMIT} entries.`, "warning");
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


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4 md:p-6" onClick={onClose}>
            <div className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                {/* Header - More Compact */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-zinc-500" />
                        </button>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Settings</h2>
                    </div>
                </div>

                {/* Scrollable Content - Tighter Padding */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div className="p-6 space-y-8">

                        {/* Forced Setup Warning */}
                        {isForcedSetup && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl flex items-start gap-3">
                                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-amber-500 uppercase tracking-tighter">Action Required</div>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed font-medium">
                                        Your account has PIN protection enabled. Please set a new PIN for this device to continue.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* User Summary */}
                        <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800/50">
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                                <UserIcon className="w-5 h-5 text-zinc-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Active Account</div>
                                <div className="text-zinc-900 dark:text-zinc-100 font-bold truncate">{email || "Loading..."}</div>
                            </div>
                        </div>

                        {/* Appearance Section */}
                        <section>
                            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1 block mb-3">Experience</label>
                            <div className="space-y-3">
                                <div className="p-4 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-200">Theme Tone</div>
                                        <div className="flex gap-1.5 p-1 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700">
                                            {ACCENT_COLORS.slice(0, 6).map((color) => (
                                                <button
                                                    key={color.name}
                                                    onClick={() => onAccentChange?.(color.bgClass)}
                                                    className={cn(
                                                        "w-6 h-6 rounded-xl transition-all active:scale-90",
                                                        color.bgClass,
                                                        accentColor === color.bgClass && "ring-2 ring-zinc-900 dark:ring-white ring-offset-2 dark:ring-offset-[#0a0a0a]"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Reminders - Improved Visibility Scroller */}
                        <section>
                            <div className="flex items-center justify-between px-1 mb-3">
                                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Reminders</label>
                                <button
                                    onClick={async () => {
                                        const newValue = !notificationsEnabled;
                                        if (newValue) {
                                            // Request permission first
                                            const granted = await requestNotificationPermission();
                                            if (!granted && Capacitor.isNativePlatform()) {
                                                showToast("Please enable notifications in your device settings", "warning");
                                                return;
                                            }
                                            // Schedule the notification
                                            const [hour, minute] = (notificationTime || "20:00").split(':').map(Number);
                                            await scheduleDailyReminder(hour, minute);
                                        } else {
                                            // Cancel the notification
                                            await cancelDailyReminder();
                                        }
                                        onToggleNotifications?.(newValue);
                                    }}
                                    className={cn(
                                        "w-10 h-5 rounded-full relative transition-all duration-300 p-0.5",
                                        notificationsEnabled ? accentColor : "bg-zinc-200 dark:bg-zinc-800"
                                    )}
                                >
                                    <div className={cn("w-4 h-4 rounded-full bg-white shadow-sm transition-all", notificationsEnabled ? "translate-x-5" : "translate-x-0")} />
                                </button>
                            </div>

                            {notificationsEnabled && (
                                <div className="p-4 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Reminder Time</div>
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter opacity-50">Local Time</div>
                                    </div>
                                    <TimePicker
                                        value={parse(notificationTime || "08:00", "HH:mm", new Date())}
                                        onChange={async (date) => {
                                            if (date && !isNaN(date.getTime())) {
                                                const timeStr = format(date, "HH:mm");
                                                onTimeChange?.(timeStr);
                                                // Reschedule notification with new time
                                                if (notificationsEnabled) {
                                                    const [hour, minute] = timeStr.split(':').map(Number);
                                                    await scheduleDailyReminder(hour, minute);
                                                }
                                            }
                                        }}
                                    />
                                    <div className="mt-2 px-1 text-[10px] text-zinc-500/80 flex items-center gap-2 leading-relaxed font-medium">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400/60" />
                                        <span>The reminder will fire at the selected time daily.</span>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Security Section */}
                        <section>
                            <div className="flex items-center justify-between px-1 mb-3">
                                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Privacy</label>
                                <button
                                    onClick={() => onToggleLock?.(!lockEnabled)}
                                    className={cn(
                                        "w-10 h-5 rounded-full relative transition-all duration-300 p-0.5",
                                        lockEnabled ? accentColor : "bg-zinc-200 dark:bg-zinc-800"
                                    )}
                                >
                                    <div className={cn("w-4 h-4 rounded-full bg-white shadow-sm transition-all", lockEnabled ? "translate-x-5" : "translate-x-0")} />
                                </button>
                            </div>

                            <div className="p-4 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-200">Local PIN Lock</div>
                                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Private Access</div>
                                </div>

                                {lockEnabled && (
                                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/50 space-y-4">
                                        <div className="flex gap-2 p-1 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 w-fit">
                                            {[4, 6].map((len) => (
                                                <button
                                                    key={len}
                                                    onClick={() => {
                                                        setPinLength(len as 4 | 6);
                                                        setTempPin("");
                                                        setConfirmPin("");
                                                        setSetupStep("initial");
                                                    }}
                                                    className={cn(
                                                        "px-4 py-1.5 rounded-xl text-[10px] font-black transition-all",
                                                        pinLength === len
                                                            ? cn(accentColor, "text-white shadow-md")
                                                            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                    )}
                                                >
                                                    {len} DIGITS
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-3">
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                placeholder={setupStep === "initial" ? (pinCode ? "Enter new PIN" : `Enter ${pinLength}-digit PIN`) : "Confirm PIN"}
                                                value={setupStep === "initial" ? tempPin : confirmPin}
                                                onChange={async (e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, pinLength);
                                                    if (setupStep === "initial") {
                                                        setTempPin(val);
                                                        if (val.length === pinLength) {
                                                            setSetupStep("confirm");
                                                        }
                                                    } else {
                                                        setConfirmPin(val);
                                                        if (val.length === pinLength) {
                                                            if (val === tempPin) {
                                                                setIsSaving(true);
                                                                const { data: { user } } = await supabase.auth.getUser();
                                                                if (user) {
                                                                    const salt = generateDeviceSalt();
                                                                    const hash = await hashPin(user.id, val, salt);

                                                                    // Update Server (We store length-only placeholder in pin_code for logic, but real verification is hash)
                                                                    // Actually, let's store the hash on the server too for multi-device sync if we want, 
                                                                    // but the CTO said hash is final.
                                                                    const { error } = await supabase
                                                                        .from('user_settings')
                                                                        .upsert({
                                                                            user_id: user.id,
                                                                            pin_code: "*".repeat(pinLength), // Placeholder for length/presence
                                                                            lock_enabled: true,
                                                                            updated_at: new Date().toISOString()
                                                                        });

                                                                    if (!error) {
                                                                        localStorage.setItem(`pin_hash_${user.id}`, hash);
                                                                        localStorage.setItem(`device_salt_${user.id}`, salt);
                                                                        onPinChange?.("*".repeat(pinLength));
                                                                        showToast("PIN secured successfully", "success");
                                                                        setSetupStep("initial");
                                                                        setTempPin("");
                                                                        setConfirmPin("");
                                                                    } else {
                                                                        showToast("Failed to save PIN", "error");
                                                                    }
                                                                }
                                                                setIsSaving(false);
                                                            } else {
                                                                showToast("PINs do not match", "error");
                                                                setConfirmPin("");
                                                                setSetupStep("initial");
                                                                setTempPin("");
                                                            }
                                                        }
                                                    }
                                                }}
                                                disabled={isSaving}
                                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all outline-none"
                                            />
                                            <p className="px-1 text-[10px] text-zinc-400 font-medium leading-relaxed">
                                                {setupStep === "initial"
                                                    ? `Choose a ${pinLength}-digit PIN to lock your journal.`
                                                    : "Please re-enter your PIN to confirm."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* STT Section */}
                        <section>
                            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1 block mb-3">Transcription</label>
                            <div className="flex flex-wrap gap-2">
                                {["Auto", "English", "Hindi", "Hinglish"].map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => onLanguageChange?.(lang)}
                                        className={cn(
                                            "px-4 py-2 rounded-2xl text-[11px] font-extrabold transition-all border",
                                            sttLanguage === lang
                                                ? cn(accentColor, "text-white border-transparent shadow-lg shadow-black/5")
                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                                        )}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Export & Actions - Side by Side on MD */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={handleExport}
                                className="h-14 rounded-[1.8rem] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-black/5"
                            >
                                <FileDown className="w-4 h-4" />
                                <span>Export Data</span>
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="h-14 rounded-[1.8rem] bg-red-500/10 dark:bg-red-500/15 text-red-500 font-bold flex items-center justify-center gap-2 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sign Out</span>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
