import { useState, useEffect } from "react";
import { Lock, Delete, LogOut, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import { verifyPin } from "@/utils/security";

interface PinLockProps {
    onUnlock: () => void;
    accentColor?: string;
    storedPin?: string | null;
}

export function PinLock({ onUnlock, accentColor = "bg-indigo-500", storedPin }: PinLockProps) {
    // Current PIN Entry State
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Forgot PIN / Reset Flow State
    const [showForgot, setShowForgot] = useState(false);
    const [otp, setOtp] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [resetStep, setResetStep] = useState<"initial" | "otp" | "new_pin" | "confirm_pin">("initial");
    const [newTempPin, setNewTempPin] = useState("");
    const [newConfirmPin, setNewConfirmPin] = useState("");

    const targetLength = storedPin?.length || 4;

    const handleForgotPin = async () => {
        setIsSendingOtp(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
            const { error } = await supabase.auth.signInWithOtp({
                email: user.email,
                options: { shouldCreateUser: false }
            });
            if (!error) {
                setResetStep("otp");
            } else {
                alert("Failed to send reset code. Please try again.");
            }
        }
        setIsSendingOtp(false);
    };

    const handleVerifyOtp = async () => {
        setIsVerifying(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
            const { error } = await supabase.auth.verifyOtp({
                email: user.email,
                token: otp,
                type: 'signup' // Using signup/magiclink type for simple verification
            });

            if (!error) {
                setResetStep("new_pin");
            } else {
                setError(true);
                setOtp("");
                setTimeout(() => setError(false), 1000);
            }
        }
        setIsVerifying(false);
    };

    const handleKey = async (digit: string) => {
        if (isVerifying || (lockoutUntil && Date.now() < lockoutUntil)) return;

        // Handling PIN Entry during Reset
        if (resetStep === "new_pin" || resetStep === "confirm_pin") {
            const currentVal = resetStep === "new_pin" ? newTempPin : newConfirmPin;
            const setter = resetStep === "new_pin" ? setNewTempPin : setNewConfirmPin;

            if (currentVal.length < targetLength) {
                const updatedVal = currentVal + digit;
                setter(updatedVal);

                if (updatedVal.length === targetLength) {
                    if (resetStep === "new_pin") {
                        setResetStep("confirm_pin");
                    } else {
                        if (updatedVal === newTempPin) {
                            setIsVerifying(true);
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) {
                                const { hashPin, generateDeviceSalt } = await import("@/utils/security");
                                const salt = generateDeviceSalt();
                                const hash = await hashPin(user.id, updatedVal, salt);

                                const { error } = await supabase.from('user_settings').upsert({
                                    user_id: user.id,
                                    pin_code: "*".repeat(targetLength),
                                    lock_enabled: true,
                                    updated_at: new Date().toISOString()
                                });

                                if (!error) {
                                    localStorage.setItem(`pin_hash_${user.id}`, hash);
                                    localStorage.setItem(`device_salt_${user.id}`, salt);
                                    onUnlock();
                                }
                            }
                            setIsVerifying(false);
                        } else {
                            setError(true);
                            setNewConfirmPin("");
                            setResetStep("new_pin");
                            setNewTempPin("");
                            setTimeout(() => setError(false), 1000);
                        }
                    }
                }
            }
            return;
        }

        // Standard PIN Entry
        if (pin.length < targetLength) {
            const newPin = pin + digit;
            setPin(newPin);

            if (newPin.length === targetLength) {
                setIsVerifying(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsVerifying(false);
                    return;
                }

                const deviceSalt = localStorage.getItem(`device_salt_${user.id}`) || "";
                const storedHash = localStorage.getItem(`pin_hash_${user.id}`) || "";

                const isValid = await verifyPin(user.id, newPin, deviceSalt, storedHash);

                if (isValid) {
                    setAttempts(0);
                    onUnlock();
                } else {
                    const newAttempts = attempts + 1;
                    setAttempts(newAttempts);
                    setError(true);

                    if (newAttempts >= 5) {
                        setLockoutUntil(Date.now() + 30000);
                        setPin("");
                    }

                    setTimeout(() => {
                        if (newAttempts < 5) setPin("");
                        setError(false);
                        setIsVerifying(false);
                    }, 1000);
                }
            }
        }
    };

    const handleDelete = () => {
        if (resetStep === "new_pin") setNewTempPin(prev => prev.slice(0, -1));
        else if (resetStep === "confirm_pin") setNewConfirmPin(prev => prev.slice(0, -1));
        else setPin(prev => prev.slice(0, -1));
    };

    const handleSignOut = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            localStorage.removeItem(`pin_hash_${user.id}`);
            localStorage.removeItem(`device_salt_${user.id}`);
        }
        await supabase.auth.signOut();
        window.location.reload();
    };

    if (showForgot) {
        return (
            <div className="fixed inset-0 z-[110] bg-white dark:bg-[#050505] flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 max-w-sm w-full text-center space-y-6 shadow-2xl">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto">
                        <Info className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">
                            {resetStep === "initial" && "Forgot PIN?"}
                            {resetStep === "otp" && "Check Email"}
                            {resetStep === "new_pin" && "Set New PIN"}
                            {resetStep === "confirm_pin" && "Confirm New PIN"}
                        </h2>
                        <p className="text-sm text-zinc-500 leading-relaxed font-medium px-2">
                            {resetStep === "initial" && "We can send a verification code to your email to securely reset your app PIN."}
                            {resetStep === "otp" && "Please enter the verification code we just sent to your account email."}
                            {resetStep === "new_pin" && `Choose a new ${targetLength}-digit PIN for this device.`}
                            {resetStep === "confirm_pin" && "Please re-enter your new PIN to confirm."}
                        </p>
                    </div>

                    {resetStep === "otp" && (
                        <div className="pt-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Verification Code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full h-14 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center text-xl font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                            />
                        </div>
                    )}

                    <div className="space-y-3 pt-4">
                        {resetStep === "initial" && (
                            <button
                                onClick={handleForgotPin}
                                disabled={isSendingOtp}
                                className="w-full h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                            >
                                {isSendingOtp ? "Sending..." : "Send Reset Code"}
                            </button>
                        )}
                        {resetStep === "otp" && (
                            <button
                                onClick={handleVerifyOtp}
                                disabled={otp.length < 6 || isVerifying}
                                className="w-full h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                            >
                                {isVerifying ? "Verifying..." : "Verify & Continue"}
                            </button>
                        )}
                        {(resetStep === "new_pin" || resetStep === "confirm_pin") && (
                            <div className="py-4 flex justify-center gap-4">
                                {Array.from({ length: targetLength }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-3 h-3 rounded-full transition-all duration-300",
                                            (resetStep === "new_pin" ? newTempPin : newConfirmPin).length > i
                                                ? "bg-zinc-900 dark:bg-white scale-125"
                                                : "bg-zinc-200 dark:bg-zinc-800"
                                        )}
                                    />
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => {
                                setShowForgot(false);
                                setResetStep("initial");
                                setOtp("");
                                setPin("");
                            }}
                            className="w-full h-14 rounded-2xl bg-transparent text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-[#09090b] flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="mb-12 flex flex-col items-center">
                <div className={cn("w-20 h-20 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl transition-all duration-500 animate-in zoom-in-50", accentColor)}>
                    <Lock className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Secure Journal</h1>
                <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">OneLine Locked</p>
            </div>

            <div className="flex gap-4 mb-20 h-4">
                {Array.from({ length: targetLength }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-3.5 h-3.5 rounded-full border-2 transition-all duration-300",
                            pin.length > i
                                ? cn(accentColor, "border-transparent scale-125 shadow-[0_0_15px] shadow-current")
                                : "border-zinc-200 dark:border-zinc-800 scale-100",
                            error && "animate-shake bg-red-500 border-red-500 shadow-red-500"
                        )}
                    />
                ))}
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-6 md:gap-x-12 md:gap-y-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleKey(num.toString())}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl font-black text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-90 transition-all border border-zinc-100 dark:border-zinc-800 shadow-sm"
                    >
                        {num}
                    </button>
                ))}
                <button
                    onClick={handleSignOut}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all hover:bg-red-50 dark:hover:bg-red-950/20 group"
                >
                    <LogOut className="w-6 h-6 text-zinc-300 group-hover:text-red-500 transition-colors" />
                </button>
                <button
                    onClick={() => handleKey("0")}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl font-black text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-90 transition-all border border-zinc-100 dark:border-zinc-800 shadow-sm"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 group"
                >
                    <Delete className="w-6 h-6 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
                </button>
            </div>

            {lockoutUntil && Date.now() < lockoutUntil ? (
                <div className="mt-8 text-center animate-pulse">
                    <p className="text-red-500 font-bold text-sm">Too many attempts</p>
                    <p className="text-zinc-500 text-xs mt-1">Try again in {Math.ceil((lockoutUntil - Date.now()) / 1000)}s</p>
                </div>
            ) : (
                <button
                    onClick={() => setShowForgot(true)}
                    className="mt-12 text-[10px] md:text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 uppercase tracking-widest transition-all"
                >
                    Forgot PIN?
                </button>
            )}
        </div>
    );
}
