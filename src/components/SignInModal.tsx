import { useNavigate } from "react-router-dom";
import { X, LogIn } from "lucide-react";
import { SpotlightCard } from "@/components/SpotlightCard";

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
                <SpotlightCard className="p-8 bg-zinc-900 border border-zinc-800 shadow-2xl">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-4 text-white">
                            <LogIn size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Sign in to Continue</h2>
                        <p className="text-zinc-400">
                            Create your account to save your entries, track your mood, and sync across devices.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={() => navigate('/auth')}
                            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                        >
                            Sign In / Sign Up
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 bg-transparent text-zinc-400 hover:text-white font-medium transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>
                </SpotlightCard>
            </div>
        </div>
    );
}
