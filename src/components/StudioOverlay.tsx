import { useState } from "react";
import { X, Film, BookOpen, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookExporter } from "./BookExporter";

interface StudioOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunchCinematic: () => void;
    userId: string;
    isGuest?: boolean;
}

export function StudioOverlay({
    isOpen,
    onClose,
    onLaunchCinematic,
    userId,
    isGuest = false,
}: StudioOverlayProps) {
    const [activeTab, setActiveTab] = useState<"hub" | "book">("hub");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[90] bg-zinc-950/80 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 select-none overflow-y-auto">
            <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Close Studio"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Hub Navigation Tabs */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono font-medium uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Studio & Memories</span>
                    </div>

                    {activeTab === "book" && (
                        <button
                            onClick={() => setActiveTab("hub")}
                            className="text-xs text-zinc-400 hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                        >
                            ← Back to Studio Hub
                        </button>
                    )}
                </div>

                {/* Main Hub Overview Cards */}
                {activeTab === "hub" ? (
                    <div>
                        <div className="mb-8">
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                                Memory Studio
                            </h2>
                            <p className="text-sm text-zinc-400 font-light max-w-xl">
                                Relive, export, and preserve your journaled thoughts into immersive cinema and print-ready hardcover books.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Card 1: Cinematic Mode */}
                            <div
                                onClick={() => {
                                    onClose();
                                    onLaunchCinematic();
                                }}
                                className="group p-6 rounded-3xl bg-zinc-950/60 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between h-56 relative overflow-hidden shadow-lg hover:shadow-indigo-500/10"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />

                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Film className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                                        Cinematic Slideshow
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-light mt-1.5 leading-relaxed">
                                        Watch your journal entries rewind automatically with slow photo pans, auto-playing voice notes, and ambient sound.
                                    </p>
                                </div>

                                <div className="flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                                    <span>Launch Rewind Experience</span>
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>

                            {/* Card 2: Hardcover Book Exporter */}
                            <div
                                onClick={() => setActiveTab("book")}
                                className="group p-6 rounded-3xl bg-zinc-950/60 border border-zinc-800 hover:border-amber-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between h-56 relative overflow-hidden shadow-lg hover:shadow-amber-500/10"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />

                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <BookOpen className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                                        Hardcover Book Exporter
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-light mt-1.5 leading-relaxed">
                                        Format your entire year into a publication-grade print-ready PDF with 5 aesthetic themes and custom titles.
                                    </p>
                                </div>

                                <div className="flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                                    <span>Open Book Exporter</span>
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <BookExporter userId={userId} isGuest={isGuest} />
                )}
            </div>
        </div>
    );
}
