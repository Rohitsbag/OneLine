import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Image as ImageIcon, Mic, Trash2, Play, Pause } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/hooks/useAuth";
import { callGemini } from "@/utils/ai";
import { compressImageFile, uploadToSupabase, resolveMediaUrl } from "@/utils/media";
import { useDropzone } from 'react-dropzone';

interface JournalEditorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    minDate?: Date;
    accentColor?: string;
    refreshTrigger?: number;
}

interface MediaItem {
    type: "image" | "audio";
    url: string;
    originalUrl?: string;
    duration?: number;
}

/**
 * Reusable, premium HTML5 custom audio player card.
 * Integrates flawlessly with active system accent themes and dark mode layouts.
 */
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

    // Watch for duration changes (this fires when the hack completes and Chrome discovers the true length)
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
            // WebM Infinity duration workaround: seek to the end so browser calculates true duration
            setDurationHackRunning(true);
            audioRef.current.currentTime = 1e8; // seek to end
            const onSeeked = () => {
                if (audioRef.current) {
                    audioRef.current.currentTime = 0; // return to start
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

    // Determine what to show in the time label
    let timeLabel = currentTime;
    if (showDuration) {
        if (!isPlaying && progress === 0) {
            timeLabel = effectiveDurationStr; // Show only duration before they start playing
        } else {
            timeLabel = `${currentTime} / ${effectiveDurationStr}`; // Show both during playback
        }
    }

    return (
        <div className="w-full max-w-md relative group rounded-[24px] border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 pr-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in shrink-0">
            {/* Custom Range Slider Stylesheet */}
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

            {/* Play Button */}
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

            {/* Scrubber & Time */}
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

            {/* Remove Button */}
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

export function JournalEditor({
    date,
    onDateChange,
    minDate,
    accentColor = "bg-indigo-500",
    refreshTrigger = 0,
}: JournalEditorProps) {
    const dateStr = format(date, "yyyy-MM-dd");
    const accentObj = ACCENT_COLORS.find((a) => a.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverClass = accentObj.hoverTextClass || "group-hover:text-zinc-900";

    const { connected: isOnline } = useNetworkStatus();
    const { userId } = useAuth();
    const effectiveId = userId || "guest";

    const [entryId, setEntryId] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "local" | "error">("synced");

    // Media states
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingTimeRef = useRef(0);

    // AI Refinement states
    const [isRefining, setIsRefining] = useState(false);
    const [refinedContent, setRefinedContent] = useState<string | null>(null);
    const [showRefinedPreview, setShowRefinedPreview] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const contentRef = useRef(content);
    const mediaItemsRef = useRef(mediaItems);
    const isDirtyRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Recording refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    useEffect(() => {
        mediaItemsRef.current = mediaItems;
    }, [mediaItems]);

    // Cleanup recording timer on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, []);

    // Helper to resolve all media items URLs to secure signed URLs
    const resolveItemsUrls = async (items: MediaItem[]): Promise<MediaItem[]> => {
        if (!items || items.length === 0) return [];
        return Promise.all(
            items.map(async (item) => ({
                ...item,
                url: await resolveMediaUrl(item.url),
                originalUrl: item.originalUrl || item.url // keep reference of the persistent public URL
            }))
        );
    };

    // ── LOAD ──────────────────────────────────────────────────────────────────
    const loadEntry = useCallback(async () => {
        setIsLoading(true);
        isDirtyRef.current = false;
        setRefinedContent(null);
        setShowRefinedPreview(false);
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingTime(0);
        recordingTimeRef.current = 0;

        // 1. Instant load from localStorage
        const cached = Storage.getJSONSync<any>(STORAGE_KEYS.ENTRY_CACHE(effectiveId, dateStr));
        setContent(cached?.content || "");
        setEntryId(cached?.id || null);
        
        // Resolve cache URLs to valid signed URLs
        const resolvedLocal = await resolveItemsUrls(cached?.media_items || []);
        setMediaItems(resolvedLocal);
        setSyncStatus("synced");

        // 2. Refresh from Supabase (if logged in + online)
        if (userId && isOnline) {
            try {
                abortRef.current?.abort();
                abortRef.current = new AbortController();

                const { data, error } = await supabase
                    .from("entries")
                    .select("id, content, media_items, updated_at")
                    .eq("user_id", userId)
                    .eq("date", dateStr)
                    .abortSignal(abortRef.current.signal)
                    .maybeSingle();

                if (!error && data && !isDirtyRef.current) {
                    setContent(data.content || "");
                    setEntryId(data.id);
                    
                    // Resolve public Supabase URLs to secure signed URLs
                    const resolvedServer = await resolveItemsUrls(data.media_items || []);
                    setMediaItems(resolvedServer);
                    setSyncStatus("synced");
                    Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(effectiveId, dateStr), data);
                }
            } catch (e: any) {
                if (e.name !== "AbortError") console.error("[Editor] Load error:", e);
            }
        }

        setIsLoading(false);
    }, [effectiveId, userId, dateStr, isOnline]);

    useEffect(() => {
        loadEntry();
        return () => { abortRef.current?.abort(); };
    }, [loadEntry, refreshTrigger]);

    // ── SAVE ──────────────────────────────────────────────────────────────────
    const saveEntry = useCallback(async () => {
        const text = contentRef.current;
        
        // Persist original public URLs in the database, not temporary signed ones
        const items = mediaItemsRef.current.map(item => ({
            type: item.type,
            url: item.originalUrl || item.url,
            ...(item.duration ? { duration: item.duration } : {})
        }));

        // Always write to localStorage first
        const localRecord = {
            id: entryId,
            content: text,
            date: dateStr,
            media_items: items,
            updated_at: new Date().toISOString(),
        };
        await Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(effectiveId, dateStr), localRecord);

        if (!userId || !isOnline) {
            setSyncStatus("local");
            isDirtyRef.current = false;
            return;
        }

        // Then sync to Supabase
        try {
            if (entryId) {
                const { error } = await supabase
                    .from("entries")
                    .update({ 
                        content: text, 
                        media_items: items,
                        updated_at: new Date().toISOString() 
                    })
                    .eq("id", entryId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from("entries")
                    .upsert(
                        { 
                            user_id: userId, 
                            date: dateStr, 
                            content: text, 
                            media_items: items,
                            updated_at: new Date().toISOString() 
                        },
                        { onConflict: "user_id,date" }
                    )
                    .select("id")
                    .single();
                if (error) throw error;
                if (data?.id) {
                    setEntryId(data.id);
                    await Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(effectiveId, dateStr), {
                        ...localRecord,
                        id: data.id,
                    });
                }
            }
            setSyncStatus("synced");
        } catch {
            setSyncStatus("error");
        }

        isDirtyRef.current = false;
    }, [effectiveId, userId, dateStr, entryId, isOnline]);

    // ── AUTOSAVE ──────────────────────────────────────────────────────────────
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        isDirtyRef.current = true;
        setSyncStatus("saving");

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(saveEntry, 1500);
    };

    // Save on unmount if dirty
    useEffect(() => {
        return () => {
            if (isDirtyRef.current) saveEntry();
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [saveEntry]);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
    }, [content]);

    // ── MEDIA OPERATIONS ──────────────────────────────────────────────────────
    const processImageFile = async (file: File) => {
        if (mediaItems.some(item => item.type === "image")) {
            alert("Only one photo is allowed. Please remove the existing photo first.");
            return;
        }

        setIsLoadingMedia(true);
        try {
            // Compress image client-side to target <1.5MB
            const compressed = await compressImageFile(file);

            let uploadUrl = "";
            let displayUrl = "";
            if (userId && userId !== "guest" && isOnline) {
                uploadUrl = await uploadToSupabase(compressed, userId, dateStr, "image");
                displayUrl = await resolveMediaUrl(uploadUrl);
            } else {
                uploadUrl = URL.createObjectURL(compressed);
                displayUrl = uploadUrl;
                if (!userId) {
                    alert("Guest Mode: Sign in to permanently save and sync your attached photo.");
                }
            }

            const nextItems = [...mediaItems, { type: "image" as const, url: displayUrl, originalUrl: uploadUrl }];
            setMediaItems(nextItems);

            // Trigger silent save
            isDirtyRef.current = true;
            setSyncStatus("saving");
            setTimeout(saveEntry, 100);

        } catch (err: any) {
            console.error("[media] Image processing error:", err);
            alert(`Failed to add photo: ${err.message || "Please try again."}`);
        } finally {
            setIsLoadingMedia(false);
        }
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processImageFile(file);
        }
        e.target.value = ""; // clear selector
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await processImageFile(file);
                    break; // Only process the first image pasted
                }
            }
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            await processImageFile(file);
        }
    }, [mediaItems, userId, isOnline, dateStr]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        noClick: true,
        noKeyboard: true,
        multiple: false
    });

    const startRecording = async () => {
        if (mediaItems.some(item => item.type === "audio")) {
            alert("Only one voiceover is allowed. Please remove the existing voiceover first.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];

            // Configure compressed Opus capturing
            let options = {};
            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                options = { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64000 };
            }

            const recorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const durationSeconds = Math.max(1, recordingTimeRef.current);
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach(track => track.stop()); // release micro

                setIsLoadingMedia(true);
                try {
                    let uploadUrl = "";
                    let displayUrl = "";
                    if (userId && userId !== "guest" && isOnline) {
                        uploadUrl = await uploadToSupabase(audioBlob, userId, dateStr, "audio");
                        displayUrl = await resolveMediaUrl(uploadUrl);
                    } else {
                        uploadUrl = URL.createObjectURL(audioBlob);
                        displayUrl = uploadUrl;
                        if (!userId) {
                            alert("Guest Mode: Sign in to permanently save and sync your voiceover.");
                        }
                    }

                    setMediaItems(prev => {
                        const next = [...prev, { type: "audio" as const, url: displayUrl, originalUrl: uploadUrl, duration: durationSeconds }];
                        isDirtyRef.current = true;
                        setSyncStatus("saving");
                        setTimeout(saveEntry, 100);
                        return next;
                    });
                } catch (err: any) {
                    console.error("[media] Audio upload error:", err);
                    alert(`Failed to save voiceover: ${err.message || "Please check Supabase configurations."}`);
                } finally {
                    setIsLoadingMedia(false);
                }
            };

            recorder.start(250);
            setIsRecording(true);
            setIsRecordingPaused(false);
            setRecordingTime(0);
            recordingTimeRef.current = 0;

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => {
                if (mediaRecorderRef.current?.state === "paused") return; // Skip if paused

                setRecordingTime(prev => {
                    const next = prev + 1;
                    recordingTimeRef.current = next;
                    if (next >= 299) { // 5-minute cap (300 seconds)
                        stopRecording();
                        return 300;
                    }
                    return next;
                });
            }, 1000);

        } catch (err) {
            console.error("[recorder] Permission denied:", err);
            alert("Unable to access microphone. Please enable browser permissions.");
        }
    };

    const stopRecording = () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const cancelRecording = () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.onstop = null; // skip uploading logic
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
    };

    const togglePauseRecording = () => {
        if (!mediaRecorderRef.current) return;
        if (isRecordingPaused) {
            mediaRecorderRef.current.resume();
            setIsRecordingPaused(false);
        } else {
            mediaRecorderRef.current.pause();
            setIsRecordingPaused(true);
        }
    };

    const handleRemoveMedia = (type: "image" | "audio") => {
        const item = mediaItems.find(i => i.type === type);
        if (!item) return;

        if (item.url.startsWith("blob:")) {
            URL.revokeObjectURL(item.url);
        }

        setMediaItems(prev => {
            const next = prev.filter(i => i.type !== type);
            isDirtyRef.current = true;
            setSyncStatus("saving");
            setTimeout(saveEntry, 100);
            return next;
        });
    };

    // ── AI REFINEMENT ─────────────────────────────────────────────────────────
    const handleAiRefine = async () => {
        if (!content.trim()) return;
        setIsRefining(true);
        try {
            const prompt = `Politely clean up spelling, punctuation, grammar, and sentence flow of the following daily journal entry, while retaining the exact core message, tone, first-person perspective, and personal details. Do NOT summarize it or change its style to be overly verbose or artificial. Keep it natural, warm, and authentic.

Journal Entry:
"""
${content}
"""`;
            const result = await callGemini(prompt);
            if (result.trim()) {
                setRefinedContent(result.trim());
                setShowRefinedPreview(true);
            }
        } catch (e) {
            console.error("[ai-refine] failed:", e);
            alert("Failed to refine entry with AI. Please check your connection and try again.");
        } finally {
            setIsRefining(false);
        }
    };

    const handleApplyRefine = () => {
        if (!refinedContent) return;
        setContent(refinedContent);
        setShowRefinedPreview(false);

        isDirtyRef.current = true;
        setSyncStatus("saving");
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(saveEntry, 1000);
    };

    // ── RENDER ────────────────────────────────────────────────────────────────
    const isToday = isSameDay(date, new Date());
    const isAtMin = !!(minDate && isSameDay(date, minDate));

    return (
        <div className="flex flex-col flex-1 max-w-2xl w-full mx-auto mt-12 mb-8 items-center px-4">

            {/* Date Navigation */}
            <div className="flex items-center gap-6 mb-12">
                <button
                    onClick={() => { if (!isAtMin) onDateChange(subDays(date, 1)); }}
                    disabled={isAtMin}
                    className={cn(
                        "group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all",
                        isAtMin && "opacity-20 cursor-not-allowed"
                    )}
                >
                    <ChevronLeft className={cn("w-5 h-5 text-zinc-500", !isAtMin && hoverClass)} />
                </button>

                <div className="flex flex-col items-center gap-1">
                    <h2 className="text-2xl font-light text-zinc-900 dark:text-white select-none">
                        {isToday ? "Today" : format(date, "MMMM d, yyyy")}
                    </h2>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                        {syncStatus === "synced" && "✓ Synced"}
                        {syncStatus === "saving" && "○ Saving…"}
                        {syncStatus === "local" && "○ Saved locally"}
                        {syncStatus === "error" && "✗ Save failed — check connection"}
                    </div>
                </div>

                <button
                    onClick={() => { if (!isToday) onDateChange(addDays(date, 1)); }}
                    disabled={isToday}
                    className={cn(
                        "group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all",
                        isToday && "opacity-0 pointer-events-none"
                    )}
                >
                    <ChevronRight className={cn("w-5 h-5 text-zinc-500", !isToday && hoverClass)} />
                </button>
            </div>

            {/* Editor Container */}
            <div 
                {...getRootProps()} 
                className={cn(
                    "w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col relative transition-colors duration-300",
                    isDragActive && "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20"
                )}
            >
                <input {...getInputProps()} />
                
                {isDragActive && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-2 border-dashed border-indigo-500 rounded-3xl animate-in fade-in duration-200">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-lg animate-bounce">
                                <ImageIcon size={32} />
                            </div>
                            <span className="text-xl font-bold text-zinc-900 dark:text-white">Drop photo to attach</span>
                        </div>
                    </div>
                )}
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                    </div>
                ) : (
                    <>
                        <div className="relative w-full">
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={handleChange}
                                onPaste={handlePaste}
                                placeholder="Write about your day…"
                                className="w-full p-6 bg-transparent resize-none outline-none text-lg leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 font-light min-h-[220px]"
                            />
                            
                            {/* Sparkles Button overlayed in bottom right of textarea section */}
                            {content.trim() && !isLoading && (
                                <div className="absolute right-4 bottom-4 flex items-center">
                                    <button
                                        onClick={handleAiRefine}
                                        disabled={isRefining}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 text-white cursor-pointer",
                                            accentColor,
                                            isRefining && "animate-pulse"
                                        )}
                                        title="Refine entry with AI"
                                    >
                                        {isRefining ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        <span>Refine</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Media Preview Section */}
                        {mediaItems.length > 0 && (
                            <div className="border-t border-zinc-100 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-950/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Photo Preview */}
                                {mediaItems.filter(item => item.type === "image").map((item, idx) => (
                                    <div key={idx} className="relative group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 shadow-sm aspect-video max-h-48 flex items-center justify-center transition-all hover:shadow-md">
                                        <img 
                                            src={item.url} 
                                            alt="Attached moment" 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <button
                                            onClick={() => handleRemoveMedia("image")}
                                            className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white transition-all cursor-pointer shadow-md active:scale-90"
                                            title="Remove photo"
                                        >
                                            <Trash2 className="w-4 h-4 shrink-0" />
                                        </button>
                                    </div>
                                ))}

                                {/* Audio Preview */}
                                {mediaItems.filter(item => item.type === "audio").map((item, idx) => (
                                    <CustomAudioPlayer 
                                        key={idx}
                                        url={item.url} 
                                        onRemove={() => handleRemoveMedia("audio")}
                                        accentColor={accentColor}
                                        knownDuration={item.duration}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Media Controls bottom bar */}
                        <div className="flex justify-between items-center px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-950/5 relative">
                            <div className="flex gap-3">
                                <input
                                    type="file"
                                    id="photo-upload-input"
                                    accept="image/*"
                                    onChange={handlePhotoSelect}
                                    className="hidden"
                                    disabled={isLoadingMedia}
                                />
                                
                                {!mediaItems.some(item => item.type === "image") && (
                                    <button
                                        onClick={() => document.getElementById("photo-upload-input")?.click()}
                                        disabled={isLoadingMedia}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 active:scale-95 cursor-pointer"
                                    >
                                        <ImageIcon className="w-4 h-4 text-zinc-400" />
                                        <span>Add Photo</span>
                                    </button>
                                )}

                                {!mediaItems.some(item => item.type === "audio") && (
                                    <button
                                        onClick={startRecording}
                                        disabled={isLoadingMedia}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 active:scale-95 cursor-pointer"
                                    >
                                        <Mic className="w-4 h-4 text-zinc-400" />
                                        <span>Record Voice</span>
                                    </button>
                                )}
                            </div>

                            {isLoadingMedia && (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 animate-pulse">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Uploading media...</span>
                                </div>
                            )}
                        </div>

                        {/* Refinement Preview Section */}
                        {refinedContent && showRefinedPreview && (
                            <div className="border-t border-zinc-100 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-950/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className={cn("w-4 h-4", accentObj.class)} />
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">AI Refined Version</span>
                                </div>
                                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 font-normal mb-4 whitespace-pre-wrap">
                                    {refinedContent}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleApplyRefine}
                                        className={cn("px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95", accentColor)}
                                    >
                                        Use AI Version
                                    </button>
                                    <button
                                        onClick={() => setShowRefinedPreview(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                                    >
                                        Keep Original
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Recording Live Overlay */}
                        {isRecording && (
                            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-6 py-4 bg-zinc-900 text-white animate-in slide-in-from-bottom-full duration-300">
                                <div className="flex items-center gap-3">
                                    {!isRecordingPaused ? (
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                                    ) : (
                                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                                    )}
                                    <span className="text-sm font-semibold tracking-wider font-mono">
                                        Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                                    </span>
                                    <span className="text-xs text-zinc-400 shrink-0">(Max 5:00)</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={togglePauseRecording}
                                        className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center"
                                        title={isRecordingPaused ? "Resume Recording" : "Pause Recording"}
                                    >
                                        {isRecordingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={stopRecording}
                                        className={cn("px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer transition-all active:scale-95", accentColor)}
                                    >
                                        Done
                                    </button>
                                    <button
                                        onClick={cancelRecording}
                                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
