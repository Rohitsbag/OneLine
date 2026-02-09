import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Settings2, Volume2, Clock, X, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MemoryLaneSettings } from '@/hooks/useMemoryLane';
import { TTSSettings } from '@/hooks/useTTS';

interface MemoryLaneControlsProps {
    isPlaying: boolean;
    onTogglePlay: () => void;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    isInteracting: boolean;
    mlSettings: MemoryLaneSettings;
    updateMlSettings: (settings: Partial<MemoryLaneSettings>) => void;
    ttsSettings: TTSSettings;
    updateTtsSettings: (settings: Partial<TTSSettings>) => void;
    ttsVoices: SpeechSynthesisVoice[];
    isSpeaking: boolean;
    accentColor: string;
}

export function MemoryLaneControls({
    isPlaying,
    onTogglePlay,
    onClose,
    onNext,
    onPrev,
    isInteracting,
    mlSettings,
    updateMlSettings,
    ttsSettings,
    updateTtsSettings,
    ttsVoices,
    isSpeaking,
    accentColor
}: MemoryLaneControlsProps) {
    const [showSettings, setShowSettings] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close settings on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Derived classes for accent color
    const accentText = accentColor.replace('bg-', 'text-');
    const accentBorder = accentColor.replace('bg-', 'border-');

    return (
        <div
            ref={containerRef}
            className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 transition-opacity duration-500",
                isPlaying && !isInteracting && !showSettings ? "opacity-30 hover:opacity-100" : "opacity-100"
            )}
        >
            {/* Status Indicators */}
            <div className="flex gap-2">
                {isPlaying && isInteracting && (
                    <div className="bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium animate-pulse shadow-lg">
                        Paused by interaction
                    </div>
                )}
                {isSpeaking && !isInteracting && (
                    <div className={cn("backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg", accentColor)}>
                        <Volume2 className="w-3 h-3 animate-pulse" />
                        Reading...
                    </div>
                )}
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-2xl w-72 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                            <Settings2 className={cn("w-4 h-4", accentText)} />
                            Memory Lane Settings
                        </h3>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-zinc-500" />
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* Timing Mode */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                                <Clock className="w-3 h-3" /> Timing Logic
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl">
                                <button
                                    onClick={() => updateMlSettings({ timingMode: 'smart' })}
                                    className={cn(
                                        "px-3 py-2 text-xs rounded-lg transition-all duration-200",
                                        mlSettings.timingMode === 'smart'
                                            ? "bg-white dark:bg-zinc-700 font-semibold shadow-sm " + accentText
                                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                    )}
                                >
                                    Smart Read
                                </button>
                                <button
                                    onClick={() => updateMlSettings({ timingMode: 'fixed' })}
                                    className={cn(
                                        "px-3 py-2 text-xs rounded-lg transition-all duration-200",
                                        mlSettings.timingMode === 'fixed'
                                            ? "bg-white dark:bg-zinc-700 font-semibold shadow-sm " + accentText
                                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                    )}
                                >
                                    Fixed Time
                                </button>
                            </div>
                        </div>

                        {/* Timing Slider */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-zinc-500 font-medium">
                                <span>{mlSettings.timingMode === 'fixed' ? 'Duration' : 'Reading Pace'}</span>
                                <span className="text-zinc-900 dark:text-white">
                                    {mlSettings.timingMode === 'fixed'
                                        ? `${mlSettings.fixedInterval}s`
                                        : (mlSettings.smartSpeed > 16 ? "Fast" : mlSettings.smartSpeed < 12 ? "Relaxed" : "Normal")}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={mlSettings.timingMode === 'fixed' ? "3" : "10"}
                                max={mlSettings.timingMode === 'fixed' ? "30" : "20"}
                                step={mlSettings.timingMode === 'fixed' ? "1" : "0.5"}
                                value={mlSettings.timingMode === 'fixed' ? mlSettings.fixedInterval : mlSettings.smartSpeed}
                                onChange={(e) => updateMlSettings(
                                    mlSettings.timingMode === 'fixed'
                                        ? { fixedInterval: parseInt(e.target.value) }
                                        : { smartSpeed: parseFloat(e.target.value) }
                                )}
                                className={cn("w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer appearance-none accent-current", accentText)}
                            />
                        </div>

                        <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full" />

                        {/* TTS Toggle */}
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                                <Volume2 className="w-3 h-3" /> Read Aloud (TTS)
                            </label>
                            <button
                                onClick={() => updateTtsSettings({ enabled: !ttsSettings.enabled })}
                                className={cn(
                                    "w-11 h-6 rounded-full relative transition-colors duration-300 focus:outline-none",
                                    ttsSettings.enabled ? accentColor : "bg-zinc-200 dark:bg-zinc-700"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 transform",
                                    ttsSettings.enabled ? "translate-x-6" : "translate-x-1"
                                )} />
                            </button>
                        </div>

                        {/* TTS Settings */}
                        {ttsSettings.enabled && (
                            <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Voice Selection</label>
                                    <select
                                        value={ttsSettings.voiceURI || ""}
                                        onChange={(e) => updateTtsSettings({ voiceURI: e.target.value || null })}
                                        className="w-full text-xs p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none transition-all"
                                    >
                                        <option value="">Default System Voice</option>
                                        {ttsVoices.map(voice => (
                                            <option key={voice.voiceURI} value={voice.voiceURI}>
                                                {voice.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Controls Bar */}
            <div className="flex items-center gap-2 p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg">
                <button
                    onClick={onClose}
                    className="p-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    title="Exit Memory Lane"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                <button
                    onClick={onPrev}
                    className="p-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    title="Previous Entry"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                    onClick={onTogglePlay}
                    className={cn(
                        "p-4 rounded-full text-white shadow-lg transition-transform active:scale-95",
                        isPlaying ? "bg-zinc-900 dark:bg-white dark:text-zinc-900" : accentColor
                    )}
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                    ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                </button>

                <button
                    onClick={onNext}
                    className="p-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    title="Next Entry"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                        "p-3 rounded-full transition-colors",
                        showSettings
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                    title="Settings"
                >
                    <Settings2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
