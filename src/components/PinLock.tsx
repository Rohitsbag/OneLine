import { useState } from "react";
import { Lock, Delete, LogOut, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";

interface PinLockProps {
    onUnlock: () => void;
    accentColor?: string;
    storedPin?: string | null;
}

export function PinLock({ onUnlock, accentColor = "bg-indigo-500", storedPin }: PinLockProps) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);
    const [showForgot, setShowForgot] = useState(false);

    const activePin = storedPin || "1234";
    const targetLength = activePin.length;

    const handleKey = (digit: string) => {
        if (pin.length < targetLength) {
            const newPin = pin + digit;
            setPin(newPin);

            if (newPin.length === targetLength) {
                if (newPin === activePin) {
                    onUnlock();
                } else {
                    setError(true);
                    setTimeout(() => {
                        setPin("");
                        setError(false);
                    }, 1000);
                }
            }
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSignOutReset = async () => {
        await supabase.auth.signOut();
        window.location.reload(); // Refresh to go back to auth
    };

    if (showForgot) {
        return (
            <div className="fixed inset-0 z-[110] bg-white dark:bg-[#050505] flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 max-w-sm w-full text-center space-y-6 shadow-2xl">
                    <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
                        <Info className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Forgot PIN?</h2>
                        <p className="text-sm text-zinc-500 leading-relaxed font-medium px-2">
                            PINs are stored locally for privacy. To reset it, you must sign out and sign back in. Your journal data is safe in the cloud.
                        </p>
                    </div>
                    <div className="space-y-3 pt-4">
                        <button
                            onClick={handleSignOutReset}
                            className="w-full h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out & Reset
                        </button>
                        <button
                            onClick={() => setShowForgot(false)}
                            className="w-full h-14 rounded-2xl bg-transparent text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-zinc-50 dark:bg-[#050505] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
            <div className="mb-8 flex flex-col items-center text-center">
                <div className={cn("w-16 h-16 md:w-20 md:h-20 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl transition-all duration-500", accentColor)}>
                    <Lock className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Journal Locked</h1>
                <p className="text-zinc-500 font-medium text-xs md:text-sm">Enter your {targetLength}-digit PIN to continue</p>
            </div>

            <div className="flex gap-3 md:gap-4 mb-12">
                {Array.from({ length: targetLength }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-4 h-4 md:w-5 md:h-5 rounded-full border-2 transition-all duration-300",
                            pin.length > i
                                ? cn(accentColor, "border-transparent scale-125 shadow-lg")
                                : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50",
                            error && "bg-red-500 border-transparent animate-bounce"
                        )}
                    />
                ))}
            </div>

            <div className="grid grid-cols-3 gap-6 md:gap-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleKey(num.toString())}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-90 transition-all shadow-sm"
                    >
                        {num}
                    </button>
                ))}
                <div />
                <button
                    onClick={() => handleKey("0")}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-90 transition-all shadow-sm"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 active:scale-90 transition-all"
                >
                    <Delete className="w-8 h-8" />
                </button>
            </div>

            <button
                onClick={() => setShowForgot(true)}
                className="mt-12 text-[10px] md:text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 uppercase tracking-widest transition-all"
            >
                Forgot PIN?
            </button>
        </div>
    );
}
