"use client";

import { X, User, Moon, Sparkles, Mic, FileDown, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur p-6 border-b border-zinc-800 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full transition-colors mr-2">
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                        <h2 className="text-xl font-semibold text-white">Settings</h2>
                    </div>
                </div>

                <div className="p-8 space-y-12">

                    {/* Appearance */}
                    <section>
                        <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">Appearance</h3>
                        <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800/50 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="text-zinc-200 font-medium mb-1">Accent Color</div>
                                </div>
                                <div className="flex gap-2">
                                    {[
                                        "bg-indigo-500", "bg-blue-500", "bg-teal-500",
                                        "bg-green-500", "bg-orange-500", "bg-rose-500",
                                        "bg-purple-500", "bg-zinc-500"
                                    ].map((color, i) => (
                                        <button key={i} className={cn("w-6 h-6 rounded-full transition-transform hover:scale-110", color, i === 0 && "ring-2 ring-white ring-offset-2 ring-offset-black")} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* AI Features */}
                    <section>
                        <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">AI Features</h3>
                        <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800/50 overflow-hidden divide-y divide-zinc-800/50">
                            <div className="p-6 flex items-center justify-between">
                                <div>
                                    <div className="text-zinc-200 font-medium mb-1">AI Reflections</div>
                                    <div className="text-zinc-500 text-sm">Enable weekly summaries and gentle memory prompts</div>
                                </div>
                                <div className="w-12 h-6 bg-zinc-800 rounded-full relative cursor-pointer">
                                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-7 shadow-sm"></div>
                                </div>
                            </div>
                            <div className="p-6 flex items-center justify-between">
                                <div>
                                    <div className="text-zinc-200 font-medium mb-1">Voice Transcription</div>
                                    <div className="text-zinc-500 text-sm">Automatically transcribe voice notes to text</div>
                                </div>
                                <div className="w-12 h-6 bg-green-500/20 rounded-full relative cursor-pointer">
                                    <div className="w-4 h-4 bg-green-500 rounded-full absolute top-1 left-7 shadow-sm"></div>
                                </div>
                            </div>
                            <div className="p-4 bg-zinc-900/50 text-xs text-zinc-500 text-center">
                                AI features are strictly opt-in. Your data is never used for training.
                            </div>
                        </div>
                    </section>

                    {/* Data */}
                    <section>
                        <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">Your Data</h3>
                        <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800/50 p-6">
                            <button className="w-full bg-white text-black font-medium h-12 rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                                <FileDown className="w-4 h-4" />
                                Export All Data
                            </button>
                            <div className="mt-4 text-center text-zinc-600 text-xs">
                                Download all your journal entries as a JSON file.
                            </div>
                        </div>
                    </section>

                    {/* Account */}
                    <section>
                        <h3 className="text-sm font-medium text-zinc-500 mb-6 uppercase tracking-wider">Account</h3>
                        <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800/50 p-6">
                            <button className="w-full bg-zinc-900 text-red-400 font-medium h-12 rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 border border-zinc-800">
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
