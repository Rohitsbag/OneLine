import { useState, useEffect, useRef, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { 
    X, Play, Pause, RotateCcw, ArrowRightLeft, 
    Mic, MicOff, Music, VolumeX, FastForward, ChevronLeft, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import { Storage } from "@/utils/storage";
import { resolveMediaUrl } from "@/utils/media";

interface Entry {
    date: string;
    content: string;
    media_items?: { type: "image" | "audio"; url: string; duration?: number }[];
}

interface CinematicOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    isGuest?: boolean;
}

export function CinematicOverlay({ isOpen, onClose, userId, isGuest = false }: CinematicOverlayProps) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [direction, setDirection] = useState<"rewind" | "chronological">("rewind");
    const [autoPlayVoice, setAutoPlayVoice] = useState(true);
    const [playAmbient, setPlayAmbient] = useState(false);
    const [speed, setSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);

    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
    const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);

    const ambientAudioRef = useRef<HTMLAudioElement>(null);
    const voiceAudioRef = useRef<HTMLAudioElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const effectiveId = userId || "guest";

    // 1. Gather all entries (offline cache + Supabase server)
    const loadAllEntries = useCallback(async () => {
        setIsLoading(true);

        const localList: Entry[] = [];
        const now = new Date();

        for (let i = 0; i < 365; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = format(d, "yyyy-MM-dd");
            const cached = Storage.getEntryCacheSync<any>(effectiveId, dateStr);
            if (cached && (cached.content?.trim() || cached.media_items?.length)) {
                localList.push({
                    date: dateStr,
                    content: cached.content?.trim() || "",
                    media_items: cached.media_items || [],
                });
            }
        }

        // Sort initially descending (newest to oldest)
        localList.sort((a, b) => b.date.localeCompare(a.date));
        setEntries(localList);
        setIsLoading(false);

        // Fetch from Supabase if online
        let activeUid = userId;
        if (!activeUid) {
            const cachedUser = Storage.getJSONSync<any>("cached_user");
            if (cachedUser?.id) activeUid = cachedUser.id;
        }

        if (!isGuest && activeUid && navigator.onLine) {
            try {
                const { data, error } = await supabase
                    .from("entries")
                    .select("date, content, media_items")
                    .eq("user_id", activeUid)
                    .order("date", { ascending: false })
                    .limit(300);

                if (!error && data) {
                    const serverDates = new Set(data.map((e) => e.date));
                    const merged = [
                        ...data,
                        ...localList.filter((e) => !serverDates.has(e.date)),
                    ].sort((a, b) => b.date.localeCompare(a.date));

                    setEntries(merged);
                }
            } catch (e) {
                console.warn("[Cinematic] Supabase load error:", e);
            }
        }
    }, [effectiveId, userId, isGuest]);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
            setIsPlaying(true);
            loadAllEntries();
        } else {
            setIsPlaying(false);
            if (timerRef.current) clearTimeout(timerRef.current);
            if (ambientAudioRef.current) ambientAudioRef.current.pause();
            if (voiceAudioRef.current) voiceAudioRef.current.pause();
        }
    }, [isOpen, loadAllEntries]);

    // Active entry based on direction
    const orderedEntries = direction === "rewind" 
        ? entries // Today -> Past (descending)
        : [...entries].reverse(); // Earliest -> Today (ascending)

    const currentEntry = orderedEntries[currentIndex] || null;

    // Resolve media signed URLs for current entry
    useEffect(() => {
        let isMounted = true;
        setResolvedImageUrl(null);
        setResolvedAudioUrl(null);

        if (!currentEntry || !currentEntry.media_items) return;

        const imgItem = currentEntry.media_items.find((item) => item.type === "image");
        const audioItem = currentEntry.media_items.find((item) => item.type === "audio");

        if (imgItem) {
            resolveMediaUrl(imgItem.url).then((url) => {
                if (isMounted) setResolvedImageUrl(url);
            });
        }

        if (audioItem) {
            resolveMediaUrl(audioItem.url).then((url) => {
                if (isMounted) setResolvedAudioUrl(url);
            });
        }

        return () => {
            isMounted = false;
        };
    }, [currentEntry]);

    // Handle Ambient Audio Toggle
    useEffect(() => {
        if (!ambientAudioRef.current) return;
        if (isOpen && playAmbient && isPlaying) {
            ambientAudioRef.current.play().catch(() => setPlayAmbient(false));
        } else {
            ambientAudioRef.current.pause();
        }
    }, [isOpen, playAmbient, isPlaying]);

    // Next / Prev slide handlers
    const handleNext = useCallback(() => {
        if (currentIndex < orderedEntries.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            // Loop back to start
            setCurrentIndex(0);
        }
    }, [currentIndex, orderedEntries.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex]);

    // Auto-play voice note logic
    useEffect(() => {
        if (!isOpen || !isPlaying || !resolvedAudioUrl || !autoPlayVoice) return;

        const voiceAudio = voiceAudioRef.current;
        if (!voiceAudio) return;

        voiceAudio.src = resolvedAudioUrl;
        voiceAudio.play().catch((e) => console.warn("[Cinematic] Auto-play voice error:", e));

        const onEnded = () => {
            handleNext();
        };

        voiceAudio.addEventListener("ended", onEnded);
        return () => {
            voiceAudio.removeEventListener("ended", onEnded);
            voiceAudio.pause();
        };
    }, [isOpen, isPlaying, resolvedAudioUrl, autoPlayVoice, handleNext]);

    // Auto-advance timer (if no voice note auto-playing)
    useEffect(() => {
        if (!isOpen || !isPlaying || (resolvedAudioUrl && autoPlayVoice)) return;

        const interval = Math.floor(6000 / speed);
        timerRef.current = setTimeout(() => {
            handleNext();
        }, interval);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isOpen, isPlaying, currentIndex, speed, resolvedAudioUrl, autoPlayVoice, handleNext]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-zinc-950/95 backdrop-blur-3xl flex flex-col items-center justify-between p-4 sm:p-8 animate-in fade-in duration-300 select-none overflow-hidden">
            {/* Ambient Background Track */}
            <audio ref={ambientAudioRef} src="/ambient/ambient.mp3" loop />
            <audio ref={voiceAudioRef} />

            {/* Top Navigation Bar - Clean, Minimalist Close Button */}
            <div className="w-full max-w-4xl flex items-center justify-end z-10">
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
                    title="Exit Cinematic Mode"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Center Content Display Area */}
            <div className="flex-1 w-full max-w-3xl flex flex-col items-center justify-center my-6 relative z-10">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-xs text-zinc-400 font-mono">Loading memories…</span>
                    </div>
                ) : !currentEntry ? (
                    <div className="text-center p-8 bg-zinc-900/60 rounded-3xl border border-white/10 max-w-md">
                        <p className="text-white text-lg font-medium mb-2">No memories found yet</p>
                        <p className="text-zinc-400 text-sm font-light">Start journaling to watch your cinematic story unfold!</p>
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in-95 duration-500 key={currentEntry.date}">
                        {/* Date Header */}
                        <div className="text-center">
                            <span className="text-sm font-mono text-zinc-400 tracking-widest uppercase">
                                {format(parseISO(currentEntry.date), "EEEE, MMMM d, yyyy")}
                            </span>
                        </div>

                        {/* Photo Display with Ken Burns Pan Effect */}
                        {resolvedImageUrl && (
                            <div className="w-full max-w-lg aspect-video rounded-3xl overflow-hidden border border-white/15 shadow-2xl relative group bg-zinc-900">
                                <img
                                    src={resolvedImageUrl}
                                    alt="Memory photo"
                                    className="w-full h-full object-cover scale-105 transition-transform duration-[10000ms] ease-out group-hover:scale-110"
                                />
                            </div>
                        )}

                        {/* Journal Thought Text */}
                        {currentEntry.content && (
                            <div className="max-w-xl text-center px-4">
                                <p className="text-xl sm:text-2xl md:text-3xl text-white font-light leading-relaxed drop-shadow-md">
                                    "{currentEntry.content}"
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Floating Control Bar (Mobile Responsive) */}
            <div className="w-full max-w-2xl bg-zinc-900/90 backdrop-blur-2xl border border-white/15 rounded-full px-4 sm:px-6 py-3 flex items-center justify-between gap-2 shadow-2xl z-20">
                {/* Prev Slide */}
                <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                    title="Previous Memory"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Play / Pause */}
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-zinc-950" /> : <Play className="w-5 h-5 fill-zinc-950 translate-x-0.5" />}
                </button>

                {/* Next Slide */}
                <button
                    onClick={handleNext}
                    className="p-2 text-zinc-400 hover:text-white transition-colors"
                    title="Next Memory"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                <div className="h-4 w-px bg-white/15 mx-1 hidden sm:block" />

                {/* Direction Toggle: Rewind vs Forward */}
                <button
                    onClick={() => setDirection(prev => prev === "rewind" ? "chronological" : "rewind")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
                        direction === "rewind"
                            ? "bg-white/10 text-white border-white/20"
                            : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    )}
                    title={direction === "rewind" ? "Playing Newest to Oldest (Rewind)" : "Playing Oldest to Newest (Forward)"}
                >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{direction === "rewind" ? "Rewind" : "Forward"}</span>
                </button>

                {/* Voice Auto-Play Toggle */}
                <button
                    onClick={() => setAutoPlayVoice(!autoPlayVoice)}
                    className={cn(
                        "p-2.5 rounded-full transition-colors border",
                        autoPlayVoice ? "bg-white/15 text-white border-white/20" : "bg-transparent text-zinc-500 border-transparent"
                    )}
                    title={autoPlayVoice ? "Voice Auto-Play: ON" : "Voice Auto-Play: OFF"}
                >
                    {autoPlayVoice ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
                </button>

                {/* Ambient Sound Toggle */}
                <button
                    onClick={() => setPlayAmbient(!playAmbient)}
                    className={cn(
                        "p-2.5 rounded-full transition-colors border",
                        playAmbient ? "bg-white/15 text-white border-white/20" : "bg-transparent text-zinc-500 border-transparent"
                    )}
                    title={playAmbient ? "Ambient Sound: ON" : "Ambient Sound: OFF"}
                >
                    {playAmbient ? <Music className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Speed Selector (0.5x, 1x, 1.5x, 2x) */}
                <button
                    onClick={() => setSpeed(prev => (prev === 0.5 ? 1 : prev === 1 ? 1.5 : prev === 1.5 ? 2 : 0.5))}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono border border-white/15 transition-colors"
                    title="Playback Speed (0.5x, 1x, 1.5x, 2x)"
                >
                    {speed}x
                </button>
            </div>
        </div>
    );
}
