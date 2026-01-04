import { Play, Pause, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";

interface AudioPlayerProps {
    src: string;
    onDelete?: () => void;
    accentColor?: string;
}

export function AudioPlayer({ src, onDelete, accentColor = "bg-indigo-500" }: AudioPlayerProps) {
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const ringClass = accentObj.borderClass ? accentObj.borderClass.replace('border-', 'ring-') : "ring-zinc-700";
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const rafRef = useRef<number | null>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (time: number) => {
        if (!Number.isFinite(time) || isNaN(time)) return "--:--";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // RAF Loop for smooth regular updates
    useEffect(() => {
        const updateLoop = () => {
            if (audioRef.current && !audioRef.current.paused) {
                setCurrentTime(audioRef.current.currentTime);
                rafRef.current = requestAnimationFrame(updateLoop);
            }
        };

        if (isPlaying) {
            rafRef.current = requestAnimationFrame(updateLoop);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateDuration = () => setDuration(audio.duration);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0); // Optional: reset to start
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // We still listen to timeupdate as a fallback or for when paused scrubbing happen from outside
        const onTimeUpdate = () => {
            if (!isPlaying) setCurrentTime(audio.currentTime);
        };

        audio.addEventListener("loadedmetadata", updateDuration);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("timeupdate", onTimeUpdate);

        return () => {
            audio.removeEventListener("loadedmetadata", updateDuration);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("timeupdate", onTimeUpdate);
        };
    }, [isPlaying]); // Re-bind if isPlaying changes to handle the conditional logic

    const progress = duration ? (currentTime / duration) * 100 : 0;

    const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
        if (!audioRef.current || !duration) return;
        const bar = e.currentTarget.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const percent = Math.min(Math.max((clientX - bar.left) / bar.width, 0), 1);

        const newTime = percent * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime); // Immediate UI update
    };

    return (
        <div className="relative w-[95%] max-w-sm mx-auto mt-6 mb-8 group/audio select-none">
            {/* Glass Pill Container - Single Row */}
            <div className={cn(
                "flex items-center gap-3 md:gap-4 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 pr-5 shadow-lg dark:shadow-2xl backdrop-blur-md transition-all duration-300",
                isPlaying ? cn("border-zinc-300 dark:border-zinc-700 ring-1", ringClass, "ring-opacity-50") : "hover:border-zinc-300 dark:hover:border-zinc-700"
            )}>
                {/* Play Button */}
                <button
                    onClick={togglePlay}
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 dark:bg-white text-white dark:text-black hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-all active:scale-95 z-10"
                >
                    {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                </button>

                {/* Progress Bar (Interactive) */}
                <div
                    className="flex-1 h-8 flex items-center cursor-pointer group/progress relative touch-none"
                    onClick={handleSeek}
                    onTouchStart={handleSeek}
                    onTouchMove={handleSeek}
                >
                    {/* Hit Slop */}
                    <div className="absolute -inset-y-2 inset-x-0" />

                    {/* Track */}
                    <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        {/* Fill - Removed transition duration for instant RAF updates */}
                        <div
                            className={cn("h-full rounded-full relative", accentColor)}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Time Display */}
                <div className="text-[10px] md:text-[11px] font-mono font-medium text-zinc-500 dark:text-zinc-500 tabular-nums shrink-0">
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                </div>

                <audio ref={audioRef} src={src} className="hidden" preload="metadata" />
            </div>

            {/* Delete Button */}
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="absolute -top-1 -right-1 p-1 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-white hover:border-red-500 hover:bg-red-500 transition-all opacity-0 group-hover/audio:opacity-100 shadow-sm"
                    title="Delete voice note"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
