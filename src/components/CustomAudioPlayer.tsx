import { useRef, useState, useEffect } from "react";
import { Play, Pause, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";

export function CustomAudioPlayer({
    url,
    onRemove,
    accentColor,
    knownDuration,
}: {
    url: string;
    onRemove?: () => void;
    accentColor: string;
    knownDuration?: number;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState("0:00");
    const [durationStr, setDurationStr] = useState("");
    const [isEnded, setIsEnded] = useState(false);

    const accentObj = ACCENT_COLORS.find((a) => a.bgClass === accentColor) || ACCENT_COLORS[0];

    const formatTime = (secs: number) => {
        if (isNaN(secs) || !isFinite(secs) || secs < 0) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            if (audioRef.current.ended || isEnded) {
                audioRef.current.currentTime = 0;
                setIsEnded(false);
            }
            audioRef.current.play().catch((e) => console.error("Audio play error:", e));
        }
    };

    const [durationHackRunning, setDurationHackRunning] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const handleDurationChange = () => {
            if (audio.duration && isFinite(audio.duration) && !durationStr) {
                setDurationStr(formatTime(audio.duration));
            }
        };
        audio.addEventListener('durationchange', handleDurationChange);
        return () => audio.removeEventListener('durationchange', handleDurationChange);
    }, [durationStr]);

    const handleTimeUpdate = () => {
        if (!audioRef.current || durationHackRunning) return;
        const cur = audioRef.current.currentTime;
        const dur = (audioRef.current.duration && isFinite(audioRef.current.duration)) 
            ? audioRef.current.duration 
            : knownDuration || 0;
            
        setCurrentTime(formatTime(cur));
        if (dur && dur > 0) {
            setProgress((cur / dur) * 100);
        } else {
            setProgress(0);
        }
    };

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return;
        const dur = audioRef.current.duration;
        if (dur && isFinite(dur)) {
            setDurationStr(formatTime(dur));
        } else if (!knownDuration && !durationHackRunning) {
            setDurationHackRunning(true);
            audioRef.current.currentTime = 1e8;
            const onSeeked = () => {
                if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.removeEventListener('seeked', onSeeked);
                }
                setDurationHackRunning(false);
            };
            audioRef.current.addEventListener('seeked', onSeeked);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setIsEnded(true);
        setProgress(0);
        setCurrentTime("0:00");
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const pct = parseFloat(e.target.value);
        const dur = (audioRef.current.duration && isFinite(audioRef.current.duration)) 
            ? audioRef.current.duration 
            : knownDuration || 0;
            
        if (dur && dur > 0) {
            audioRef.current.currentTime = (pct / 100) * dur;
            setProgress(pct);
        }
    };

    const effectiveDurationStr = durationStr || (knownDuration ? formatTime(knownDuration) : "");
    const showDuration = effectiveDurationStr && effectiveDurationStr !== "0:00" && !effectiveDurationStr.includes("NaN");

    let timeLabel = currentTime;
    if (showDuration) {
        if (!isPlaying && progress === 0) {
            timeLabel = effectiveDurationStr;
        } else {
            timeLabel = `${currentTime} / ${effectiveDurationStr}`;
        }
    }

    return (
        <div className="w-full max-w-md relative group rounded-[24px] border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 pr-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in shrink-0">
            <style>{`
                .custom-seekbar {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                    width: 100%;
                    height: 24px;
                    cursor: pointer;
                }
                .custom-seekbar:focus {
                    outline: none;
                }
                .custom-seekbar::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    background: #e4e4e7;
                    border-radius: 2px;
                }
                .dark .custom-seekbar::-webkit-slider-runnable-track {
                    background: #27272a;
                }
                .custom-seekbar::-webkit-slider-thumb {
                    height: 12px;
                    width: 12px;
                    border-radius: 50%;
                    background: currentColor;
                    -webkit-appearance: none;
                    margin-top: -4px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.1s ease;
                }
                .custom-seekbar::-webkit-slider-thumb:hover {
                    transform: scale(1.25);
                }
            `}</style>

            <audio
                ref={audioRef}
                src={url}
                onPlay={() => { setIsPlaying(true); setIsEnded(false); }}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />

            <button
                onClick={togglePlay}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-transform active:scale-95 shrink-0",
                    accentObj.bgClass,
                    accentObj.hoverBgClass
                )}
            >
                {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white text-white shrink-0" />
                ) : (
                    <Play className="w-4 h-4 fill-white text-white translate-x-0.5 shrink-0" />
                )}
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-3">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={handleScrub}
                    disabled={!showDuration}
                    className={cn("custom-seekbar", accentObj.class, !showDuration && "opacity-50 cursor-not-allowed")}
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-mono min-w-[32px] text-right shrink-0 whitespace-nowrap">
                    {timeLabel}
                </span>
            </div>

            {onRemove && (
                <button
                    onClick={onRemove}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-400 hover:text-red-500 transition-colors shrink-0 active:scale-90"
                    title="Remove voice note"
                >
                    <Trash2 className="w-4 h-4 shrink-0" />
                </button>
            )}
        </div>
    );
}
