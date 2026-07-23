import { useState } from "react";
import { X, Film, BookOpen, Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
import { BookExporter } from "./BookExporter";

interface StudioOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunchCinematic: () => void;
    onLaunchReflection: () => void;
    userId: string;
    isGuest?: boolean;
}

export function StudioOverlay({
    isOpen,
    onClose,
    onLaunchCinematic,
    onLaunchReflection,
    userId,
    isGuest = false,
}: StudioOverlayProps) {
    const [activeTab, setActiveTab] = useState<"hub" | "book">("hub");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[90] bg-zinc-950/85 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 select-none overflow-y-auto">
            <div className="w-full max-w-4xl bg-[#121215] border border-zinc-800/90 rounded-[28px] p-6 sm:p-8 shadow-2xl relative my-auto">
                {/* Header Navigation */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-5 mb-6">
                    <div className="flex items-center gap-3">
                        {activeTab === "book" ? (
                            <button
                                onClick={() => setActiveTab("hub")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Back to Studio</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/70 text-zinc-300 border border-zinc-700/60 text-xs font-mono font-medium">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Studio & Memories</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                        title="Close Studio"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Main Studio Overview Cards */}
                {activeTab === "hub" ? (
                    <div>
                        <div className="mb-8">
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                                Memory Studio
                            </h2>
                            <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-xl leading-relaxed">
                                Relive, synthesize, and export your journaled thoughts into cinematic motion, AI insights, and print-ready hardcover books.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Card 1: Cinematic Mode */}
                            <div
                                onClick={() => {
                                    onClose();
                                    onLaunchCinematic();
                                }}
                                className="group p-6 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-200 cursor-pointer flex flex-col justify-between h-64 hover:bg-zinc-950 shadow-md"
                            >
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                        <Film className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <h3 className="text-base font-semibold text-white group-hover:text-zinc-200 transition-colors">
                                        Cinematic Slideshow
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-light mt-2 leading-relaxed">
                                        Relive your journal entries in motion with photo pan, voice notes, and ambient sound.
                                    </p>
                                </div>

                                <div className="flex items-center text-xs font-medium text-zinc-300 group-hover:text-white group-hover:translate-x-1 transition-all pt-4 border-t border-zinc-900">
                                    <span>Play Rewind</span>
                                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </div>
                            </div>

                            {/* Card 2: Hardcover Book Exporter */}
                            <div
                                onClick={() => setActiveTab("book")}
                                className="group p-6 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-200 cursor-pointer flex flex-col justify-between h-64 hover:bg-zinc-950 shadow-md"
                            >
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                        <BookOpen className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <h3 className="text-base font-semibold text-white group-hover:text-zinc-200 transition-colors">
                                        Hardcover Book Exporter
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-light mt-2 leading-relaxed">
                                        Format your memories into a publication-grade printable PDF book with 5 design themes.
                                    </p>
                                </div>

                                <div className="flex items-center text-xs font-medium text-zinc-300 group-hover:text-white group-hover:translate-x-1 transition-all pt-4 border-t border-zinc-900">
                                    <span>Configure Book</span>
                                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </div>
                            </div>

                            {/* Card 3: AI Reflection */}
                            <div
                                onClick={() => {
                                    onClose();
                                    onLaunchReflection();
                                }}
                                className="group p-6 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-200 cursor-pointer flex flex-col justify-between h-64 hover:bg-zinc-950 shadow-md"
                            >
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                                        <Sparkles className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <h3 className="text-base font-semibold text-white group-hover:text-zinc-200 transition-colors">
                                        AI Reflection & Insights
                                    </h3>
                                    <p className="text-xs text-zinc-400 font-light mt-2 leading-relaxed">
                                        Synthesize personal growth, emotional trends, and thematic patterns across your entries.
                                    </p>
                                </div>

                                <div className="flex items-center text-xs font-medium text-zinc-300 group-hover:text-white group-hover:translate-x-1 transition-all pt-4 border-t border-zinc-900">
                                    <span>Generate Reflection</span>
                                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
