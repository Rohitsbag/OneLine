import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Camera, X, Square, AudioLines, ScanText, Loader2 } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { compressImage } from "@/utils/image";
import { AudioPlayer } from "./AudioPlayer";
import { ACCENT_COLORS } from "@/constants/colors";
import { useToast } from "./Toast";
import { JOURNAL_CONFIG } from "@/constants/journal";
import * as nativeMedia from "@/utils/native-media";

// Fix Types for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onerror: ((this: SpeechRecognition, ev: any) => void) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition?: { new(): SpeechRecognition };
        webkitSpeechRecognition?: { new(): SpeechRecognition };
    }
}

interface JournalEditorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    minDate?: Date;
    accentColor?: string;
    isGuest?: boolean;
    onGuestAction?: () => void;
    refreshTrigger?: number;
    sttLanguage?: string;
}

// CRASH PREVENTION: Safe localStorage wrapper for Private Mode / disabled cookies
// Accessing localStorage directly can throw SecurityError in Safari Private Mode
const safeStorage = {
    getItem: (key: string): string | null => {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    setItem: (key: string, value: string): void => {
        try { localStorage.setItem(key, value); } catch { /* quota exceeded or blocked */ }
    },
    removeItem: (key: string): void => {
        try { localStorage.removeItem(key); } catch { }
    }
};

// SECURITY: Magic Number Validation to prevent spoofed extensions
const validateImageFile = async (file: File): Promise<boolean> => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp'];

    // First check MIME type
    if (!supportedTypes.includes(file.type) && !file.type.startsWith('image/')) {
        return false;
    }

    try {
        const buffer = await file.slice(0, 16).arrayBuffer(); // Extended to 16 bytes
        const bytes = new Uint8Array(buffer);

        const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
            'image/jpeg': (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
            'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
            'image/gif': (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
            'image/bmp': (b) => b[0] === 0x42 && b[1] === 0x4D,
            'image/webp': (b) => {
                // RIFF header + WEBP identifier
                return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
            },
            'image/heic': (b) => {
                // HEIC uses ftyp box at offset 4, then brand code at offset 8
                // Valid brands: heic, heix, mif1, msf1
                const isFtyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
                if (!isFtyp) return false;
                // Check brand codes: heic(68 65 69 63), heix(68 65 69 78), mif1(6D 69 66 31)
                const isHeic = b[8] === 0x68 && b[9] === 0x65 && b[10] === 0x69 && (b[11] === 0x63 || b[11] === 0x78);
                const isMif1 = b[8] === 0x6D && b[9] === 0x69 && b[10] === 0x66 && b[11] === 0x31;
                return isHeic || isMif1;
            },
            'image/heif': (b) => {
                const isFtyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
                if (!isFtyp) return false;
                const isHeic = b[8] === 0x68 && b[9] === 0x65 && b[10] === 0x69 && (b[11] === 0x63 || b[11] === 0x78);
                const isMif1 = b[8] === 0x6D && b[9] === 0x69 && b[10] === 0x66 && b[11] === 0x31;
                return isHeic || isMif1;
            },
        };

        const validator = signatures[file.type];
        if (validator) {
            return validator(bytes);
        }

        // SECURITY FIX: Do NOT trust MIME alone - reject unknown file types
        // Spoofed files could have image/* MIME but malicious content
        console.warn("Unknown image format, magic bytes don't match known types");
        return false;

    } catch (e) {
        console.error("Magic number check failed", e);
        return false;
    }
};

// ETERNAL SIGNED URL: 7-day URLs with localStorage cache + auto-refresh
// This prevents images from breaking after 1 hour
const getEternalSignedUrl = async (path: string, bucket: string = 'journal-media-private'): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith('http')) return path; // Already a URL

    try {
        // Check cache first
        const cacheKey = `signed_url_${bucket}_${path}`;
        const cached = safeStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { url, expiresAt } = JSON.parse(cached);
                // If still valid for at least 24 hours, use cached
                if (expiresAt > Date.now() + 1000 * 60 * 60 * 24) {
                    return url;
                }
            } catch (parseError) {
                // FIX: Corrupted cache - delete and regenerate
                console.warn('Corrupted signed URL cache, regenerating:', parseError);
                safeStorage.removeItem(cacheKey);
            }
        }

        // Generate new 7-day signed URL
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

        if (error || !data?.signedUrl) {
            console.warn("Failed to create eternal signed URL:", error?.message);
            return null;
        }

        // Cache the URL (expires in 6 days to give buffer for refresh)
        try {
            safeStorage.setItem(cacheKey, JSON.stringify({
                url: data.signedUrl,
                expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 6 // 6 days
            }));
        } catch {
            // Ignore cache write errors (quota)
        }

        return data.signedUrl;
    } catch (e) {
        console.error("Eternal signed URL error:", e);
        return null;
    }
};

export function JournalEditor({
    date,
    onDateChange,
    minDate,
    accentColor = "bg-indigo-500",
    isGuest = false,
    onGuestAction,
    refreshTrigger = 0,
    sttLanguage = "Auto"
}: JournalEditorProps) {
    const currentDate = date; // Define early for Ref usage

    // --------------------------------------------------------------------------------
    // STATE DECLARATIONS (Base)
    // --------------------------------------------------------------------------------
    const [userId, setUserId] = useState<string | null>(null);
    const [entryId, setEntryId] = useState<string | null>(null);
    const [content, setContent] = useState("");

    // Media State
    const [imagePath, setImagePath] = useState<string | null>(null);
    const [displayUrl, setDisplayUrl] = useState<string | null>(null);
    const [audioPath, setAudioPath] = useState<string | null>(null);
    const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingSync, setPendingSync] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const [showMicMenu, setShowMicMenu] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    // Sync Status (UI-only for visual feedback)
    const [syncStatus, setSyncStatus] = useState<'local' | 'pending' | 'synced' | 'failed'>('synced');

    // History State
    const [history, setHistory] = useState<Array<{ content: string; image: string | null; audio: string | null }>>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // --------------------------------------------------------------------------------
    // REFS (Lifecycle & Async Guards)
    // --------------------------------------------------------------------------------
    const isUndoingRedoingRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);
    const micMenuRef = useRef<HTMLDivElement>(null);
    const cameraMenuRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const activeBlobUrlRef = useRef<string | null>(null);
    const imageRetryAttemptedRef = useRef(false); // FIX: Prevent infinite img onError loop
    const mimeTypeRef = useRef<string>('audio/webm');
    const ocrAbortControllerRef = useRef<AbortController | null>(null);
    const lastRefreshTimeRef = useRef<number>(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const webSpeechResultRef = useRef<string>(""); // Store Web Speech API result
    const isWebSpeechActiveRef = useRef<boolean>(false);
    const contentRef = useRef(content);
    const imagePathRef = useRef(imagePath);
    const audioPathRef = useRef(audioPath);
    const isDirtyRef = useRef(false);
    const isMountedRef = useRef(true);
    const activeDateRef = useRef(currentDate);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const contentDateRef = useRef(format(date, 'yyyy-MM-dd'));

    // Sync refs with state
    useEffect(() => {
        contentRef.current = content;
        imagePathRef.current = imagePath;
        audioPathRef.current = audioPath;
    }, [content, imagePath, audioPath]);

    // Toast/Confirm UI (replaces native alert/confirm)
    const { showToast, showConfirm } = useToast();

    // currentDate already defined at top

    // Auth & Initial Fetch
    useEffect(() => {
        const checkUser = async () => {
            // Try Supabase auth first
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                return;
            }

            // Fallback: Check for cached user (Offline Mode)
            const cachedUserRaw = safeStorage.getItem('cached_user');
            if (cachedUserRaw) {
                try {
                    const cachedUser = JSON.parse(cachedUserRaw);
                    if (cachedUser && cachedUser.id) {
                        console.log("Using cached user ID for offline mode");
                        setUserId(cachedUser.id);
                    }
                } catch (e) {
                    console.error("Failed to parse cached user", e);
                }
            }
        };
        checkUser();
    }, []);

    // Cleanup: Stop any active recordings and close menus on unmount
    useEffect(() => {
        isMountedRef.current = true;

        const handleClickOutside = (event: MouseEvent) => {
            if (micMenuRef.current && !micMenuRef.current.contains(event.target as Node)) {
                setShowMicMenu(false);
            }
            if (cameraMenuRef.current && !cameraMenuRef.current.contains(event.target as Node)) {
                setShowCameraMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            isMountedRef.current = false;
            document.removeEventListener("mousedown", handleClickOutside);

            // PRIVACY GUARD: Stop microphone tracks even if recording failed or unmounted
            if (mediaRecorderRef.current?.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }

            // Stop SpeechRecognition if active
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                } catch (e) { }
            }
            // Stop MediaRecorder if active
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
            // Clear recording timer
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }

            // Cleanup active blob URL on unmount
            if (activeBlobUrlRef.current) {
                URL.revokeObjectURL(activeBlobUrlRef.current);
            }

            // NEW: Cancel any in-progress OCR
            if (ocrAbortControllerRef.current) {
                ocrAbortControllerRef.current.abort();
                ocrAbortControllerRef.current = null;
            }

            // NEW: Cancel any in-progress fetch (Double safety)
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

        };
    }, []); // Run ONCE on mount/unmount

    // --- Dual STT Initialization (Web Speech API) ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // MEMORY LEAK FIX: Stop and cleanup old recognition instance before creating new one
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    // Ignore abort errors
                }
                recognitionRef.current = null;
            }
            // Also clear stale transcription data from previous sessions
            webSpeechResultRef.current = "";

            // Enable for BOTH Web and Native (Android WebView supports SpeechRecognition)
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = sttLanguage === "Auto" ? "en-US" : (sttLanguage === "Hindi" ? "hi-IN" : "en-US");

                recognition.onresult = (event: SpeechRecognitionEvent) => {
                    let finalTranscript = '';
                    // @ts-ignore
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        // @ts-ignore
                        if (event.results[i].isFinal) {
                            // @ts-ignore
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalTranscript) {
                        webSpeechResultRef.current += (webSpeechResultRef.current ? ' ' : '') + finalTranscript;
                    }
                };

                // @ts-ignore
                recognition.onerror = (event) => {
                    if (event.error === 'network' || event.error === 'aborted' || event.error === 'no-speech') {
                        return;
                    }
                    console.warn("Web Speech API Error:", event);
                    isWebSpeechActiveRef.current = false;
                };

                recognition.onend = () => {
                    isWebSpeechActiveRef.current = false;
                };

                recognitionRef.current = recognition;
            }
        }

        // CLEANUP: Stop recognition on unmount or language change
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    // Ignore
                }
            }
            webSpeechResultRef.current = "";
        };
    }, [sttLanguage]);

    // Separate effect for URL cleanup avoids re-running global cleanup
    useEffect(() => {
        return () => {
            // MEMORY LEAK FIX: Revoke any lingering blob URLs
            if (displayUrl && displayUrl.startsWith('blob:')) {
                URL.revokeObjectURL(displayUrl);
            }
        };
    }, [displayUrl]);

    const syncPendingData = useCallback(async () => {
        const pendingRaw = localStorage.getItem('pending_journal_sync');
        if (!pendingRaw || !userId) return;

        setPendingSync(true);
        try {
            const pendingEntries = JSON.parse(pendingRaw) as Record<string, { content: string; image_url?: string; audio_url?: string; updated_at?: string }>;
            // CHRONOLOGICAL SYNC: Sort dates to prevent older data from overwriting newer entries
            const dates = Object.keys(pendingEntries).sort();

            for (const dateKey of dates) {
                const entry = pendingEntries[dateKey];
                const localTimestamp = entry.updated_at ? new Date(entry.updated_at).getTime() : Date.now();

                // CONFLICT RESOLUTION: Check server timestamp first
                const { data: serverEntry } = await supabase
                    .from('entries')
                    .select('updated_at')
                    .eq('user_id', userId)
                    .eq('date', dateKey)
                    .single();

                // Only sync if local is newer or no server entry exists
                if (serverEntry?.updated_at) {
                    const serverTimestamp = new Date(serverEntry.updated_at).getTime();
                    if (serverTimestamp > localTimestamp) {
                        // Server is newer - skip this entry, remove from pending
                        console.log(`Skipping ${dateKey}: server has newer data`);
                        delete pendingEntries[dateKey];
                        continue;
                    }
                }

                const { error } = await supabase
                    .from('entries')
                    .upsert({
                        user_id: userId,
                        date: dateKey,
                        content: entry.content,
                        image_url: entry.image_url || null,
                        audio_url: entry.audio_url || null,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id, date' });

                if (!error) {
                    // Remove this date from pending
                    delete pendingEntries[dateKey];
                    console.log(`Synced pending data for ${dateKey}`);
                } else {
                    console.error(`Failed to sync ${dateKey}:`, error);
                }
            }

            // Update or clear localStorage
            if (Object.keys(pendingEntries).length === 0) {
                localStorage.removeItem('pending_journal_sync');
            } else {
                localStorage.setItem('pending_journal_sync', JSON.stringify(pendingEntries));
            }
        } catch (e) {
            console.error("Sync failed", e);
        } finally {
            if (isMountedRef.current) {
                setPendingSync(false);
            }
        }
    }, [userId]);

    // Offline / Online Listener
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            syncPendingData();
        };
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [userId, syncPendingData]);

    useEffect(() => {
        if (refreshTrigger > 0) {
            syncPendingData();
        }
    }, [refreshTrigger, userId, syncPendingData]);

    // Update activeDateRef immediately when date changes
    useEffect(() => {
        activeDateRef.current = currentDate;
    }, [currentDate]);



    // Fetch Entry (OFFLINE-FIRST)
    const fetchEntry = useCallback(async () => {
        if (!userId) return;

        // Cancel any in-flight request to prevent race conditions
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const isSameDateRefresh = contentDateRef.current === dateStr;

        // STEP 0: Reset state ONLY if date has changed to prevent "Today" text showing on "Yesterday"
        if (isMountedRef.current && !isSameDateRefresh) {
            setContent("");
            setImagePath(null);
            setAudioPath(null);
            setDisplayUrl(null);
            setAudioDisplayUrl(null);
            setIsLoading(true);
            setImageLoadError(false);
            isDirtyRef.current = false;
            contentDateRef.current = "";
        } else if (isMountedRef.current && isSameDateRefresh && !isLoading) {
            // If it's a refresh of same date, maybe just show a subtle pulse instead of full loading
            setIsLoading(true);
        }

        const cacheKey = `entry_cache_${userId}_${dateStr}`;
        // STEP 1: Load from localStorage cache first (instant)
        const cachedEntry = localStorage.getItem(cacheKey);
        if (cachedEntry && !isSameDateRefresh) { // Only use cache if we're not already displaying current data
            const cached = JSON.parse(cachedEntry);
            if (isMountedRef.current) {
                setContent(cached.content || "");
                setImagePath(cached.image_url || null);
                setAudioPath(cached.audio_url || null);
                setEntryId(cached.id || null);
                contentDateRef.current = dateStr;
            }
        } else if (isMountedRef.current && !isSameDateRefresh) {
            contentDateRef.current = dateStr;
        }

        try {
            const { data, error } = await supabase
                .from('entries')
                .select('id, content, image_url, audio_url, updated_at')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .abortSignal(abortControllerRef.current.signal)
                .maybeSingle();

            if (error) {
                // If aborted, check multiple patterns
                const isAborted =
                    error.name === 'AbortError' ||
                    error.code === 'ABORT_ERR' ||
                    error.code === '20' || // DOMException abort code
                    error.message?.toLowerCase().includes('abort') ||
                    error.message?.toLowerCase().includes('cancel');

                if (isAborted) return;

                // Network error or other - we already have cache data
                console.log('Server fetch failed, using cached data:', error.message);
            } else if (data && isMountedRef.current) {
                // Update cache with server data
                localStorage.setItem(cacheKey, JSON.stringify(data));

                // On initial fetch for a date, we ALWAYS want to update UI 
                // unless the user has already started typing on THIS specific date
                // CRITICAL: Check against activeDateRef to ensure we haven't navigated away
                const isActiveDate = format(activeDateRef.current, 'yyyy-MM-dd') === dateStr;

                if (!isDirtyRef.current && isActiveDate) {
                    const newContent = data.content || "";
                    const newImage = data.image_url || null;
                    const newAudio = data.audio_url || null;

                    setContent(newContent);
                    setImagePath(newImage);
                    setAudioPath(newAudio);
                    setEntryId(data.id); // Bind to Server Identity

                    // Initialize History once data is loaded
                    setHistory([{ content: newContent, image: newImage, audio: newAudio }]);
                    setHistoryIndex(0);
                } else if (!isActiveDate) {
                    console.log("Fetch result discarded - user navigated away");
                    return;
                }
                // Update the lock to allow saving for THIS date now
                contentDateRef.current = dateStr;
            } else if (!data && isMountedRef.current) {
                // If no entry exists on server, it's a fresh day
                contentDateRef.current = dateStr;
            }
        } catch (error) {
            // Offline - already using cached data
            console.log('Offline mode - using cached entry');
        }

        if (isMountedRef.current) {
            setIsLoading(false);
            // CRITICAL: Unconditionally unlock saving for this date once UI is ready
            contentDateRef.current = dateStr;
        }
    }, [currentDate, userId]);

    // BLOCKER FIX #3: Reset history on date change to prevent cross-date undo
    // FIX: Only reset on date change, NOT on content change (was breaking undo)
    useEffect(() => {
        // Reset history stack to current state when date changes
        // Use refs to get current values without adding them to dependencies
        setHistory([{ content: contentRef.current, image: imagePathRef.current, audio: audioPathRef.current }]);
        setHistoryIndex(0);
    }, [currentDate]); // ONLY currentDate - content changes handled by separate history effect

    // VISIBILITY CHANGE & FOCUS HANDLER
    // Refresh signed URLs when app comes to foreground, but debounce heavily
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && userId) {
                const now = Date.now();
                if (now - lastRefreshTimeRef.current < JOURNAL_CONFIG.VISIBILITY_REFRESH_DEBOUNCE_MS) {
                    console.log("Skipping refresh - too recent");
                    return;
                }

                lastRefreshTimeRef.current = now;
                console.log("App visible - refreshing entry");
                fetchEntry();
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        // 'focus' often fires with visibilitychange, so simplified to just visibilitychange for mobile/tab switching reliability
        // window.addEventListener('focus', handleVisibilityChange); 

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            // window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [userId, fetchEntry]);

    useEffect(() => {
        fetchEntry();
    }, [fetchEntry, refreshTrigger]);

    // Image Signed URL - ETERNAL 7-DAY URLs with cache
    useEffect(() => {
        let cancelled = false;
        // FIX: Reset retry counter on imagePath change for fresh retry logic
        imageRetryAttemptedRef.current = false;

        const loadSignedUrl = async () => {
            if (!imagePath) {
                if (isMountedRef.current && !cancelled) setDisplayUrl(null);
                return;
            }

            const url = await getEternalSignedUrl(imagePath);

            if (isMountedRef.current && !cancelled) {
                if (url) {
                    setDisplayUrl(url);
                    setImageLoadError(false);
                } else {
                    console.warn("Eternal signed URL creation failed for path:", imagePath);
                    setImageLoadError(true);
                }
            }
        };
        loadSignedUrl();
        return () => { cancelled = true; };
    }, [imagePath]);

    // Targeted retry for image loading with eternal URL
    const refreshImageUrl = useCallback(async () => {
        if (!imagePath) return;

        setImageLoadError(false);

        // Force refresh by clearing localStorage cache first
        try {
            localStorage.removeItem(`signed_url_journal-media-private_${imagePath}`);
        } catch { }

        const url = await getEternalSignedUrl(imagePath);

        if (isMountedRef.current) {
            if (url) {
                setDisplayUrl(url);
            } else {
                setImageLoadError(true);
                showToast("Failed to reload image", "error");
            }
        }
    }, [imagePath, showToast]);

    // Audio Signed URL - ETERNAL 7-DAY URLs with cache
    useEffect(() => {
        let cancelled = false;
        const loadAudioUrl = async () => {
            if (!audioPath) {
                if (isMountedRef.current && !cancelled) setAudioDisplayUrl(null);
                return;
            }

            const url = await getEternalSignedUrl(audioPath);

            if (isMountedRef.current && !cancelled && url) {
                setAudioDisplayUrl(url);
            }
        };
        loadAudioUrl();
        return () => { cancelled = true; };
    }, [audioPath]);

    // Save Entry (Debounced with dirty flag to prevent data loss)
    const saveEntry = useCallback(async (dateStr: string, currentContent: string, currentImagePath: string | null, currentAudioPath: string | null) => {
        if (!userId) return;

        // Helper to safe-set localStorage (Quota Handling with LRU)
        const safeSetItem = (key: string, value: string) => {
            try {
                safeStorage.setItem(key, value);
            } catch (e: any) {
                if (e.name === 'QuotaExceededError') {
                    console.warn("LocalStorage full, cleaning up oldest entries...");
                    try {
                        // Smart Cleanup: Sort by updated_at to remove ONLY the oldest
                        const items = Object.keys(localStorage)
                            .filter(k => k.startsWith('entry_cache_'))
                            .map(k => {
                                try {
                                    const val = JSON.parse(safeStorage.getItem(k) || '{}');
                                    return { key: k, time: val.updated_at ? new Date(val.updated_at).getTime() : 0 };
                                } catch {
                                    return { key: k, time: 0 };
                                }
                            })
                            .sort((a, b) => a.time - b.time); // Oldest first

                        // Remove oldest 20% or at least 5
                        const countToRemove = Math.max(5, Math.floor(items.length * 0.2));
                        items.slice(0, countToRemove).forEach(item => safeStorage.removeItem(item.key));

                        // Retry set
                        safeStorage.setItem(key, value);
                    } catch (retryE) {
                        console.error("Cache write failed even after cleanup", retryE);
                    }
                }
            }
        };

        // OFFLINE-FIRST: Always update local cache first
        const cacheKey = `entry_cache_${userId}_${dateStr}`;
        const cacheData = {
            id: entryId, // Save Identity
            content: currentContent,
            image_url: currentImagePath,
            audio_url: currentAudioPath,
            updated_at: new Date().toISOString()
        };
        safeSetItem(cacheKey, JSON.stringify(cacheData));

        // Helper to save to pending sync queue (for server sync)
        const saveOffline = () => {
            const existingRaw = safeStorage.getItem('pending_journal_sync');
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            existing[dateStr] = {
                content: currentContent,
                image_url: currentImagePath,
                audio_url: currentAudioPath,
                updated_at: cacheData.updated_at
            };
            safeSetItem('pending_journal_sync', JSON.stringify(existing));
        };

        if (!navigator.onLine) {
            saveOffline();
            if (isMountedRef.current) {
                setIsOffline(true);
                setIsSaving(false);
            }
            isDirtyRef.current = false;
            return;
        }

        let error;

        // MASTER FIX: Strict Identity-Based Updates
        if (entryId) {
            // We have an identity - enforce strict update
            const result = await supabase
                .from('entries')
                .update({
                    content: currentContent,
                    image_url: currentImagePath,
                    audio_url: currentAudioPath,
                    updated_at: new Date().toISOString()
                })
                .eq('id', entryId);
            error = result.error;
        } else {
            // First Write (or offline created) - Use Upsert to Resolve Date Conflict
            // This creates the identity if missing, or recovers it if we missed the sync
            const result = await supabase
                .from('entries')
                .upsert({
                    user_id: userId,
                    date: dateStr,
                    content: currentContent,
                    image_url: currentImagePath,
                    audio_url: currentAudioPath,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, date' })
                .select('id') // GET THE IDENTITY
                .single();

            error = result.error;
            if (result.data?.id && isMountedRef.current) {
                setEntryId(result.data.id); // Bind immediately
            }
        }

        if (isMountedRef.current) {
            if (error) {
                console.error('Error saving:', error);
                setHasError(true);
                setSyncStatus('failed'); // UI: Show failed status
                saveOffline(); // Fallback
            } else {
                setHasError(false);
                // Remove this date from pending if it exists
                const existingRaw = localStorage.getItem('pending_journal_sync');
                if (existingRaw) {
                    const existing = JSON.parse(existingRaw);
                    delete existing[dateStr];
                    if (Object.keys(existing).length === 0) {
                        localStorage.removeItem('pending_journal_sync');
                    } else {
                        localStorage.setItem('pending_journal_sync', JSON.stringify(existing));
                    }
                }
                setSyncStatus('synced'); // UI: Show synced status
            }
            setIsSaving(false);
        }
        isDirtyRef.current = false;
    }, [userId, entryId]);

    useEffect(() => {
        if (!userId || isLoading) return;
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        // ROOT CAUSE GUARD: Block save if the content in state doesn't match the date we're on
        // This stops the "Today's text saving to Yesterday" bug during fast navigation.
        if (contentDateRef.current !== dateStr) {
            console.log("Save blocked: Date mismatch during transition");
            return;
        }

        isDirtyRef.current = true;
        // Immediate Feedback: Show saving pulse as soon as typing starts
        if (isMountedRef.current) {
            setIsSaving(true);
            setSyncStatus(isOffline ? 'pending' : 'local'); // UI: Show local or pending status
        }

        const timeoutId = setTimeout(() => {
            saveEntry(dateStr, content, imagePath, audioPath);
        }, 7000); // PRODUCTION: 7-second debounce to prevent API spam

        return () => {
            clearTimeout(timeoutId);
            // FIX: Use closure-captured `dateStr` (not ref) - this effect belongs to this specific date
            // Using ref was risky: if fetchEntry for new date runs before cleanup, ref has wrong date
            if (isDirtyRef.current && userId) {
                saveEntry(dateStr, contentRef.current, imagePathRef.current, audioPathRef.current);
            }
        };
    }, [content, imagePath, audioPath, currentDate, userId, isLoading, saveEntry]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto'; // Reset to auto to get correct scrollHeight
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    // Auto-resize on content change
    useEffect(() => {
        adjustTextareaHeight();

        // Track history
        if (!isUndoingRedoingRef.current && !isLoading) {
            const lastState = history[historyIndex];
            const hasChanged = !lastState ||
                lastState.content !== content ||
                lastState.image !== imagePath ||
                lastState.audio !== audioPath;

            if (hasChanged) {
                const timeoutId = setTimeout(() => {
                    setHistory(prev => {
                        const newHistory = prev.slice(0, historyIndex + 1);
                        newHistory.push({ content, image: imagePath, audio: audioPath });
                        if (newHistory.length > 20) newHistory.shift();
                        return newHistory;
                    });
                    setHistoryIndex(prev => Math.min(prev + 1, 19));
                }, 500); // Debounce history push
                return () => clearTimeout(timeoutId);
            }
        }
    }, [content, imagePath, audioPath, adjustTextareaHeight, isLoading]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoingRedoingRef.current = true;
            const prevState = history[historyIndex - 1];
            setContent(prevState.content);
            setImagePath(prevState.image);
            setAudioPath(prevState.audio);
            setHistoryIndex(prev => prev - 1);
            setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoingRedoingRef.current = true;
            const nextState = history[historyIndex + 1];
            setContent(nextState.content);
            setImagePath(nextState.image);
            setAudioPath(nextState.audio);
            setHistoryIndex(prev => prev + 1);
            setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
        }
    }, [history, historyIndex]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo(); else undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // --- File Handlers ---
    const processFile = useCallback(async (file: File) => {
        if (!userId) return;

        // FIX: Offline check - media uploads require network
        if (!navigator.onLine) {
            showToast("Cannot upload media while offline. Please reconnect to upload images.", "warning");
            return;
        }

        if (!(await validateImageFile(file))) {
            showToast("Invalid image file. Please upload a valid image (JPEG, PNG, WebP, HEIC).", "error");
            return;
        }

        // Size Check (Original)
        if (file.size > JOURNAL_CONFIG.MAX_RAW_IMAGE_SIZE_MB * 1024 * 1024) {
            showToast(`Image too large! Max: ${JOURNAL_CONFIG.MAX_RAW_IMAGE_SIZE_MB}MB`, "error");
            return;
        }

        if (activeBlobUrlRef.current) {
            URL.revokeObjectURL(activeBlobUrlRef.current);
        }

        setIsUploading(true);
        // Optimistic preview
        const objectUrl = URL.createObjectURL(file);
        activeBlobUrlRef.current = objectUrl;
        setDisplayUrl(objectUrl);

        try {
            const compressedBlob = await compressImage(file, JOURNAL_CONFIG.IMAGE_UPLOAD_MAX_SIZE, 1500);

            // COMPRESSION VALIDATION
            if (!compressedBlob || compressedBlob.size === 0) {
                throw new Error("Compression failed (empty result).");
            }
            if (compressedBlob.size > JOURNAL_CONFIG.MAX_COMPRESSED_IMAGE_SIZE_MB * 1024 * 1024) {
                throw new Error("Image too complex. Please use a smaller image.");
            }

            // SECURITY: Use UUID-only filename to prevent path injection attacks
            // FIX: Add fallback for old browsers (Safari < 15.4) or HTTP contexts
            const uuid = typeof crypto?.randomUUID === 'function'
                ? crypto.randomUUID().slice(0, 8)
                : Math.random().toString(36).slice(2, 10);
            const fileName = `${userId}/${Date.now()}-${uuid}.webp`;
            const compressedFile = new File([compressedBlob], fileName, { type: 'image/webp' });

            const { error: uploadError } = await supabase.storage
                .from('journal-media-private')
                .upload(fileName, compressedFile);

            if (uploadError) throw uploadError;

            // MEMORY LEAK GUARD: Only update state if still mounted
            if (isMountedRef.current) {
                // NAVIGATION RACE GUARD:
                const isActiveDate = format(activeDateRef.current, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
                if (isActiveDate) {
                    setImagePath(fileName);
                } else {
                    console.log("Image upload finished but user navigated away - discarding UI update");
                }
            }

        } catch (error: any) {
            console.error("Image upload failed:", error);
            if (isMountedRef.current) {
                // FALLBACK: If compression failed but original is safe (< 10MB), use original
                if (file.size < JOURNAL_CONFIG.MAX_COMPRESSED_IMAGE_SIZE_MB * 1024 * 1024) {
                    console.warn("Compression failed, using original file as fallback.", error);

                    // SECURITY: Use UUID-only filename for fallback too
                    // FIX: Add fallback for old browsers (Safari < 15.4) or HTTP contexts
                    const uuidFallback = typeof crypto?.randomUUID === 'function'
                        ? crypto.randomUUID().slice(0, 8)
                        : Math.random().toString(36).slice(2, 10);
                    const fileName = `${userId}/${Date.now()}-${uuidFallback}.${file.name.split('.').pop() || 'jpg'}`;
                    const { error: uploadError } = await supabase.storage
                        .from('journal-media-private')
                        .upload(fileName, file);

                    if (uploadError) {
                        showToast("Upload failed: " + uploadError.message, "error");
                        setDisplayUrl(null);
                        setImagePath(null);
                    } else {
                        setImagePath(fileName);
                        showToast("Image uploaded (uncompressed fallback)", "warning");
                    }
                } else {
                    showToast(error.message || "Failed to upload image. Try a smaller file.", "error");
                    setDisplayUrl(null);
                    setImagePath(null);
                }
            }
        } finally {
            if (isMountedRef.current) {
                setIsUploading(false);
            }
        }
    }, [userId]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        processFile(e.target.files[0]);
        e.target.value = "";
    };

    const removeImage = async () => {
        if (!userId || !imagePath) return;

        // UX SAFETY: Confirm before deletion with UI modal
        const confirmed = await showConfirm({
            title: "Delete Image",
            message: "Delete this image? This cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel"
        });
        if (!confirmed) return;

        // ROLLBACK STATE
        const previousPath = imagePath;
        const previousUrl = displayUrl;

        // Optimistic UI update
        setImagePath(null);
        setDisplayUrl(null);

        try {
            // STRATEGY: Update Database FIRST.
            // If DB update fails, we can rollback UI and nothing is lost.
            // If DB update succeeds but Storage delete fails, we just have an orphaned file (acceptable).

            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const { error: dbError } = await supabase
                .from('entries')
                .update({ image_url: null, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('date', dateStr);

            if (dbError) throw dbError;

            // Now delete from storage
            const { error: storageError } = await supabase.storage
                .from('journal-media-private')
                .remove([previousPath]);

            if (storageError) {
                console.warn("Storage deletion failed (orphaned file):", storageError);
            }

            // Clean local cache properly
            const cacheKey = `entry_cache_${userId}_${dateStr}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                data.image_url = null;
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }

        } catch (error) {
            console.error("Failed to delete image:", error);
            // Rollback Logic
            if (isMountedRef.current) {
                setImagePath(previousPath);
                setDisplayUrl(previousUrl);
                showToast("Failed to delete image. Please try again.", "error");
            }
        }
    };

    // --- Shared Upload Handlers ---
    const handleVoiceNote = async (audioBlob: Blob) => {
        // FIX: Offline check - media uploads require network
        if (!navigator.onLine) {
            showToast("Cannot upload voice note while offline. Please reconnect.", "warning");
            return;
        }

        const type = audioBlob.type || 'audio/webm';
        const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
        const fileName = `${userId}/audio-${Date.now()}.${ext}`;

        const { error } = await supabase.storage
            .from('journal-media-private')
            .upload(fileName, audioBlob);

        if (error) {
            console.error("Audio upload failed:", error);
            showToast("Voice note upload failed.", "error");
            if (isMountedRef.current) setHasError(true);
        } else {
            if (isMountedRef.current) {
                const isActiveDate = format(activeDateRef.current, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
                if (isActiveDate) {
                    setAudioPath(fileName);
                    setHasError(false);
                }
            }
        }
    };

    const handleOCRUploadManual = async (blob: Blob) => {
        setIsProcessingOCR(true);
        try {
            const { performOCR } = await import("@/utils/ai");
            const ocrFile = new File([blob], "ocr.webp", { type: blob.type });
            const result = await performOCR(ocrFile);
            if (result && isMountedRef.current) {
                setContent(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                    return prev + (needsSpace ? ' ' : '') + result;
                });
                showToast("Text extracted successfully", "success");
            }
        } catch (err: any) {
            console.error("OCR Failed:", err);
            showToast(err.message || "OCR failed.", "error");
        } finally {
            setIsProcessingOCR(false);
        }
    };

    // --- Audio Logic ---
    const startAudioRecording = async () => {
        // DOUBLE RECORDING GUARD: Prevent starting if already recording
        if (isRecordingAudio || mediaRecorderRef.current?.state === "recording") {
            console.warn("Recording already in progress, ignoring start request");
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("Audio recording not supported.", "error");
            return;
        }

        // PRE-FLIGHT CHECK: Network
        if (!navigator.onLine) {
            const confirmed = await showConfirm({
                title: "You're Offline",
                message: "Voice notes recorded offline will be saved locally but cannot be uploaded until you're back online.",
                confirmText: "Record Anyway",
                cancelText: "Cancel"
            });
            if (!confirmed) return;
        }

        // TRACK REFERENCE: Keep stream reference for cleanup on error
        let stream: MediaStream | null = null;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // MOBILE COMPATIBILITY: Check supported MIME types
            let mimeType = 'audio/webm';
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    mimeType = 'audio/ogg';
                }
                // If none supported, let browser use default (but may fail on iOS if we force webm later)
            }

            // SAFARI FIX: Use the negotiated mime type
            mimeTypeRef.current = mimeType;

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop timer
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                    recordingTimerRef.current = null;
                }
                if (isMountedRef.current) {
                    setRecordingDuration(0);
                }

                // SAFARI FIX: Create blob with the correct MIME type
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });

                // Extension handling
                const type = mimeTypeRef.current;
                const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
                const fileName = `${userId}/audio-${Date.now()}.${ext}`;

                const { error } = await supabase.storage
                    .from('journal-media-private')
                    .upload(fileName, audioBlob);

                if (error) {
                    console.error("Audio upload failed:", error);
                    showToast("Voice note upload failed. Please check your connection and try again.", "error");
                    if (isMountedRef.current) {
                        setHasError(true);
                    }
                } else {
                    const oldAudioPath = audioPathRef.current;

                    // CRITICAL FIX: Update State FIRST.
                    // This immediately triggers the debounced 'saveEntry' effect which handles the upsert cleanly.
                    if (isMountedRef.current) {
                        // NAVIGATION RACE GUARD:
                        const isActiveDate = format(activeDateRef.current, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
                        if (isActiveDate) {
                            setAudioPath(fileName);
                            setHasError(false);
                        } else {
                            console.log("Audio recording finished but user navigated away - discarding UI update");
                            return; // Do not schedule deletion of 'oldAudioPath' because we didn't actually replace it in this view
                        }
                    }

                    // RACE CONDITION PREVENTION:
                    // 1. We do NOT upsert here manualy to avoid conflict with the debounced saver.
                    // 2. We delay the deletion of the OLD file slightly to ensure the new state persists 
                    //    and the 'saveEntry' effect has captured the new 'fileName'.

                    if (oldAudioPath) {
                        // VERIFY DB UPDATE BEFORE DELETE
                        setTimeout(async () => {
                            try {
                                const { data: entry } = await supabase
                                    .from('entries')
                                    .select('audio_url')
                                    .eq('user_id', userId)
                                    .eq('date', format(currentDate, 'yyyy-MM-dd'))
                                    .single();

                                // Only delete if DB confirms new file is saved (audio_url matches new fileName)
                                if (entry?.audio_url === fileName) {
                                    await supabase.storage.from('journal-media-private').remove([oldAudioPath]);
                                    console.log("Old audio file safely deleted.");
                                } else {
                                    console.warn("Skipped old audio deletion - DB state mismatch.");
                                }
                            } catch (e) {
                                console.error("Failed to cleanup old audio file:", e);
                            }
                        }, JOURNAL_CONFIG.AUDIO_DELETE_DELAY_MS);
                    }
                }

                stream?.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecordingAudio(true);

            // Start recording timer with LIMIT check
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                if (isMountedRef.current) {
                    setRecordingDuration(prev => {
                        // 5 MINUTE LIMIT
                        if (prev >= JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS) {
                            stopAudioRecording();
                            showToast("Recording limit reached (5 mins).", "info");
                            return JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS;
                        }
                        return prev + 1;
                    });
                }
            }, 1000);
        } catch (error: any) {
            // CRITICAL: Stop stream tracks if we acquired them before error
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            console.error("Error starting audio:", error);
            if (error.name === 'NotAllowedError') {
                showToast("Microphone access denied. Please enable microphone permissions in settings.", "error");
            } else {
                showToast("Could not start microphone: " + error.message, "error");
            }
        }
    };

    const stopAudioRecording = async () => {
        if (!isRecordingAudio) return;

        if (nativeMedia.isNative()) {
            const result = await nativeMedia.nativeVoice.stop();
            setIsRecordingAudio(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            if (result) {
                await handleVoiceNote(result.blob);
            }
            return;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecordingAudio(false);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };


    const removeAudio = async () => {
        if (!userId || !audioPath) return;

        const confirmed = await showConfirm({
            title: "Delete Voice Note",
            message: "Delete this voice note? This cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel"
        });
        if (!confirmed) return;

        // ROLLBACK STATE
        const previousPath = audioPath;
        const previousUrl = audioDisplayUrl;

        setAudioPath(null);
        setAudioDisplayUrl(null);

        try {
            // DB FIRST Strategy
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const { error: dbError } = await supabase
                .from('entries')
                .update({ audio_url: null, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('date', dateStr);

            if (dbError) throw dbError;

            const { error: storageError } = await supabase.storage
                .from('journal-media-private')
                .remove([previousPath]);

            if (storageError) {
                console.warn("Storage deletion failed (orphaned file):", storageError);
            }

            // Update cache
            const cacheKey = `entry_cache_${userId}_${dateStr}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                data.audio_url = null;
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }

        } catch (error) {
            console.error("Failed to delete voice note:", error);
            if (isMountedRef.current) {
                setAudioPath(previousPath);
                setAudioDisplayUrl(previousUrl);
                showToast("Failed to delete voice note.", "error");
            }
        }
    };

    // --- STT Logic (Tiered: Whisper Online / WebSpeech Offline) ---
    const [isTranscribing, setIsTranscribing] = useState(false);

    const toggleRecording = useCallback(async () => {
        if (isRecording) {
            // STOP RECORDING
            if (nativeMedia.isNative()) {
                const result = await nativeMedia.nativeVoice.stop();

                // Stop Backup (Web Speech)
                if (recognitionRef.current && isWebSpeechActiveRef.current) {
                    recognitionRef.current.stop();
                    isWebSpeechActiveRef.current = false;
                }

                setIsRecording(false);
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                    recordingTimerRef.current = null;
                }

                if (result) {
                    setIsTranscribing(true);
                    try {
                        const { transcribeAudio } = await import("@/utils/ai");
                        const text = await transcribeAudio(result.blob, 'whisper-large-v3-turbo', sttLanguage);
                        if (text && isMountedRef.current) {
                            setContent(prev => {
                                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                                return prev + (needsSpace ? ' ' : '') + text;
                            });
                        }
                    } catch (err) {
                        console.error("Native transcription failed:", err);

                        // FALLBACK: Use Web Speech API Result
                        if (webSpeechResultRef.current && webSpeechResultRef.current.trim().length > 0) {
                            console.log("Using Offline Fallback (Native)...");
                            showToast("Network failed. Used offline backup.", "warning");
                            setContent(prev => {
                                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                                return prev + (needsSpace ? ' ' : '') + webSpeechResultRef.current;
                            });
                        } else {
                            showToast("Transcription failed. No offline backup available.", "error");
                        }
                    } finally {
                        setIsTranscribing(false);
                    }
                }
                return;
            }

            // --- STOP WEB RECORDING (Dual Strategy) ---

            // 1. Stop Audio Recorder (for Whisper)
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.requestData(); // Flush last chunk
                mediaRecorderRef.current.stop();
            }

            // 2. Stop Web Speech API (Background)
            if (recognitionRef.current && isWebSpeechActiveRef.current) {
                recognitionRef.current.stop();
                isWebSpeechActiveRef.current = false;
            }

            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            // 3. Transcription happens in the 'onstop' handler of MediaRecorder.
            // The onstop handler sets isTranscribing state appropriately.
            // We don't do anything else here - the flow continues in onstop.
        } else {
            // --- START RECORDING ---
            try {
                if (nativeMedia.isNative()) {
                    // Start Native Recorder
                    await nativeMedia.nativeVoice.start();

                    // Start Backup (Web Speech)
                    // We wrap in try/catch to ensure native recording continues even if backup fails (e.g. mic busy)
                    if (recognitionRef.current) {
                        try {
                            webSpeechResultRef.current = "";
                            recognitionRef.current.start();
                            isWebSpeechActiveRef.current = true;
                        } catch (e) {
                            console.warn("Could not start offline backup:", e);
                        }
                    }

                    setIsRecording(true);
                    // Start Timer...
                    setRecordingDuration(0);
                    recordingTimerRef.current = setInterval(() => {
                        if (isMountedRef.current) {
                            setRecordingDuration(prev => {
                                if (prev >= JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS) {
                                    toggleRecording(); // Auto-stop
                                    showToast("Recording limit reached (5 mins).", "info");
                                    return JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS;
                                }
                                return prev + 1;
                            });
                        }
                    }, 1000);
                    return;
                }
            } catch (error: any) {
                console.error("Error starting native audio:", error);
                showToast("Could not start recording.", "error");
                return;
            }
        }

        // --- START WEB RECORDING (Dual Strategy) ---

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("Microphone not supported in this browser.", "error");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 1. Start Audio Recorder (Whisper)
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
            } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4'; // Safari
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                // This runs when we call .stop() in the STOP block above
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                // CRITICAL: Set transcribing state at START of transcription
                if (isMountedRef.current) setIsTranscribing(true);

                // FIX: Declare outside try so it's accessible in nested catch blocks
                let transcribeAudio: ((blob: Blob, model: string, lang?: string) => Promise<string>) | null = null;

                try {
                    // FIX: Move import INSIDE try block so finally runs if import fails
                    const aiModule = await import("@/utils/ai");
                    transcribeAudio = aiModule.transcribeAudio;

                    // ATTEMPT 1: Whisper Large v3 (Cloud)
                    console.log("Dual STT: Trying Whisper Large...");
                    const text = await transcribeAudio(audioBlob, 'whisper-large-v3', sttLanguage);
                    if (text && isMountedRef.current) {
                        setContent(prev => {
                            const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                            return prev + (needsSpace ? ' ' : '') + text;
                        });
                        showToast("Transcribed with Whisper (High Quality)", "success");
                        return; // Success!
                    }
                } catch (err: any) {
                    console.warn("Whisper Large failed:", err);

                    // ATTEMPT 2: Whisper Turbo (Cloud - Faster/Fallback)
                    try {
                        // If import failed above, transcribeAudio is null - go straight to offline fallback
                        if (!transcribeAudio) throw new Error("Import failed, skip to offline");

                        console.log("Dual STT: Trying Whisper Turbo...");
                        const text = await transcribeAudio(audioBlob, 'whisper-large-v3-turbo', sttLanguage);
                        if (text && isMountedRef.current) {
                            setContent(prev => {
                                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                                return prev + (needsSpace ? ' ' : '') + text;
                            });
                            showToast("Transcribed with Whisper Turbo", "success");
                            return; // Success!
                        }
                    } catch (turboErr: any) {
                        console.warn("Whisper Turbo failed:", turboErr);

                        // ATTEMPT 3: Web Speech API (Local / Background Result)
                        // We use the result we captured in background 'webSpeechResultRef'
                        console.log("Dual STT: Using Browser Fallback...");
                        if (webSpeechResultRef.current && isMountedRef.current) {
                            const backupText = webSpeechResultRef.current;
                            setContent(prev => {
                                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                                return prev + (needsSpace ? ' ' : '') + backupText;
                            });
                            showToast("Offline Fallback Used (Browser Speech)", "warning");
                        } else {
                            showToast("Transcription failed. Please try again.", "error");
                        }
                    }
                } finally {
                    if (isMountedRef.current) setIsTranscribing(false);
                    stream.getTracks().forEach(track => track.stop()); // Cleanup mic
                }
            };

            mediaRecorder.start();

            // 2. Start Web Speech API (Background)
            webSpeechResultRef.current = ""; // Reset buffer
            if (recognitionRef.current && !isWebSpeechActiveRef.current) {
                try {
                    recognitionRef.current.start();
                    isWebSpeechActiveRef.current = true;
                } catch (e: any) {
                    if (e.name !== 'InvalidStateError') {
                        console.warn("Failed to start Web Speech API", e);
                    } else {
                        // If it says "already started", we just mark it as active and continue
                        isWebSpeechActiveRef.current = true;
                    }
                }
            }

            setIsRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error: any) {
            console.error("Error starting STT:", error);
            showToast("Could not access microphone.", "error");
        }
    }, [isRecording, sttLanguage, showToast]);

    const triggerHaptic = useCallback((pattern: number | number[] = 10) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }, []);

    const handleTranscriptionStart = () => {
        triggerHaptic();
        setShowMicMenu(false);
        toggleRecording();
    };

    const handleVoiceNoteStart = () => {
        triggerHaptic(15);
        setShowMicMenu(false);
        startAudioRecording();
    };

    const handlePhotoStart = async () => {
        triggerHaptic();
        setShowCameraMenu(false);

        if (nativeMedia.isNative()) {
            const result = await nativeMedia.getPhoto('CAMERA');
            if (result) {
                // Pass to existing file handler logic but with blob
                processFile(new File([result.blob], "photo.jpg", { type: result.blob.type }));
            }
            return;
        }

        fileInputRef.current?.click();
    };

    const handleOCRStart = async () => {
        triggerHaptic(15);
        setShowCameraMenu(false);

        if (nativeMedia.isNative()) {
            const result = await nativeMedia.getPhoto('CAMERA');
            if (result) {
                // Use existing OCR handler (Tesseract.js or AI-based)
                await handleOCRUploadManual(result.blob);
            }
            return;
        }

        ocrFileInputRef.current?.click();
    };

    // Memoized Handlers for Menu Buttons
    const handleMicButtonClick = useCallback(() => {
        if (isGuest && onGuestAction) {
            onGuestAction();
            return;
        }
        if (isRecording) {
            toggleRecording();
            return;
        }
        if (isRecordingAudio) {
            stopAudioRecording();
            return;
        }
        setShowMicMenu(prev => !prev);
        setShowCameraMenu(false);
        triggerHaptic(5);
    }, [isGuest, onGuestAction, isRecording, isRecordingAudio, toggleRecording, stopAudioRecording, triggerHaptic]);

    const handleCameraButtonClick = useCallback(() => {
        if (isGuest && onGuestAction) {
            onGuestAction();
            return;
        }
        setShowCameraMenu(prev => !prev);
        setShowMicMenu(false);
        triggerHaptic(5);
    }, [isGuest, onGuestAction, triggerHaptic]);

    // --- OCR Processing (HYBRID: Online + Offline Fallback) ---
    // --- OCR Processing (HYBRID: Online + Offline Fallback) ---
    const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = ""; // Reset input

        // Cancel any in-progress OCR
        if (ocrAbortControllerRef.current) {
            ocrAbortControllerRef.current.abort();
        }
        ocrAbortControllerRef.current = new AbortController();
        const signal = ocrAbortControllerRef.current.signal;

        if (!userId) return;

        // Capture initial state for race condition check

        // Validation
        if (!(await validateImageFile(file))) {
            showToast("Invalid image file. Please use a valid image.", "error");
            return;
        }

        // Hard Limit check on input
        if (file.size > JOURNAL_CONFIG.MAX_RAW_IMAGE_SIZE_MB * 1024 * 1024) {
            showToast(`Image too large (Max ${JOURNAL_CONFIG.MAX_RAW_IMAGE_SIZE_MB}MB).`, "error");
            return;
        }

        setIsProcessingOCR(true);

        try {
            if (signal.aborted) return;

            // Optimize for OCR
            const compressedBlob = await compressImage(
                file,
                JOURNAL_CONFIG.OCR_IMAGE_MAX_SIZE, // 1024px
                1024 // Target 1MB
            );

            if (signal.aborted) return;
            await handleOCRUploadManual(compressedBlob);
        } catch (error: any) {
            if (error.name === 'AbortError' || signal.aborted) {
                console.log("OCR aborted");
                return;
            }
            console.error("OCR Error:", error);
            showToast(error.message || "Could not read text from image.", "error");
        } finally {
            if (isMountedRef.current) {
                setIsProcessingOCR(false);
            }
        }
    };

    // --- Drag & Drop ---
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length > 0 && e.dataTransfer.files[0].type.startsWith('image/')) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [processFile]);

    const navigateDate = useCallback((direction: 'prev' | 'next') => {
        const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
        onDateChange(newDate);
    }, [currentDate, onDateChange]);

    const isToday = isSameDay(currentDate, new Date());
    const isMinDate = minDate && isSameDay(currentDate, minDate);

    // --- Swipe Navigation ---
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const SWIPE_THRESHOLD = 80;

    const handleTouchStartSwipe = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEndSwipe = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null) return;

        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;

        // Ensure it's mostly horizontal
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
            if (deltaX > 0) {
                // Swipe Right -> Prev Date
                if (!isMinDate) navigateDate('prev');
            } else {
                // Swipe Left -> Next Date
                if (!isToday) navigateDate('next');
            }
        }

        touchStartX.current = null;
        touchStartY.current = null;
    };

    // Dynamic accent color logic
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverClass = (accentObj as any).hoverTextClass || "group-hover:text-white";

    return (
        <div className="flex flex-col flex-1 max-w-2xl w-full mx-auto mt-12 mb-8 items-center">

            {/* Header / Date Nav */}
            <div className="flex items-center gap-6 mb-12">
                <button
                    onClick={() => navigateDate('prev')}
                    disabled={!!isMinDate}
                    className={cn(
                        "group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all",
                        isMinDate && "opacity-20 cursor-not-allowed hover:bg-transparent"
                    )}
                >
                    <ChevronLeft className={cn("w-5 h-5 text-zinc-500 transition-colors", !isMinDate && hoverClass)} />
                </button>
                <div className="flex flex-col items-center gap-1">
                    <h2 className="text-2xl font-light text-[#18181b] dark:text-white select-none">
                        {isToday ? "Today" : format(currentDate, "MMMM d, yyyy")}
                    </h2>
                    {/* Sync Status Indicator - Subtle */}
                    <div className="text-[9px] text-zinc-400 dark:text-zinc-600 font-medium tracking-wide uppercase flex items-center gap-1">
                        {syncStatus === 'synced' && <span title="Synced to cloud">✓ Synced</span>}
                        {syncStatus === 'local' && <span title="Saved locally">○ Saved</span>}
                        {syncStatus === 'pending' && <span title="Waiting for connection" className="text-amber-600 dark:text-amber-500">⚠ Pending</span>}
                        {syncStatus === 'failed' && <span title="Sync failed - will retry" className="text-red-600 dark:text-red-500">✗ Failed</span>}
                    </div>
                </div>
                <button
                    onClick={() => navigateDate('next')}
                    disabled={isToday}
                    className={cn(
                        "group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all",
                        isToday ? "opacity-0 cursor-default" : ""
                    )}
                >
                    <ChevronRight className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors", !isToday && hoverClass)} />
                </button>
            </div>

            {/* Offline Banner - Non-blocking, subtle */}
            {isOffline && (
                <div className="w-full mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-center justify-center gap-2 text-xs text-amber-800 dark:text-amber-400 font-medium">
                    <span>📡</span>
                    <span>You're offline. Changes will sync when connected.</span>
                </div>
            )}

            {/* Editor */}
            <div
                className={cn(
                    "w-full relative group transition-all duration-300 rounded-xl",
                    isDragging ? "bg-zinc-200/50 dark:bg-zinc-900/50 ring-2 ring-zinc-400 dark:ring-zinc-700 scale-[1.02]" : ""
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onTouchStart={handleTouchStartSwipe}
                onTouchEnd={handleTouchEndSwipe}
            >
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => {
                        if (isGuest && onGuestAction) {
                            onGuestAction();
                            return;
                        }
                        setContent(e.target.value);
                        adjustTextareaHeight();
                    }}
                    onBlur={() => {
                        // IMMEDIATE FLUSH ON BLUR
                        const dateStr = format(currentDate, 'yyyy-MM-dd');
                        if (isDirtyRef.current && userId && contentDateRef.current === dateStr) {
                            saveEntry(dateStr, content, imagePath, audioPath);
                        }
                    }}
                    onFocus={(e) => {
                        if (isGuest && onGuestAction) {
                            e.target.blur();
                            onGuestAction();
                        }
                    }}
                    onClick={(e) => {
                        if (isGuest && onGuestAction) {
                            e.currentTarget.blur();
                            onGuestAction();
                        }
                    }}
                    placeholder={isDragging ? "Drop image here..." : "One line for today..."}
                    className="w-full bg-transparent text-xl md:text-2xl text-[#18181b] dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none outline-none min-h-[150px] text-left md:text-center font-light leading-relaxed scrollbar-hide p-6 md:p-4 overflow-hidden"
                    spellCheck={false}
                />

                <div className="absolute bottom-[-30px] left-0 flex items-center gap-2 transition-opacity opacity-0 group-hover:opacity-100">
                    <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                        title="Undo (Ctrl+Z)"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                        title="Redo (Ctrl+Y)"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-zinc-400 font-mono ml-1">
                        {historyIndex + 1}/{history.length}
                    </span>
                </div>

                <div className="absolute bottom-[-30px] right-0 text-xs font-mono transition-opacity opacity-0 group-hover:opacity-100 flex items-center gap-2">
                    {hasError ? <span className="text-red-500 font-semibold">Failed to save</span> :
                        isRecording ? <span className="flex items-center gap-2 text-red-500 font-semibold animate-pulse"><span className="w-2 h-2 rounded-full bg-red-500" />Recording...</span> :
                            isLoading ? <span className="flex items-center gap-2 text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />Syncing...</span> :
                                isOffline ? <span className="text-orange-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Offline (Saved locally)</span> :
                                    pendingSync ? <span className="text-blue-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Syncing...</span> :
                                        isSaving ? <span className="text-zinc-500">Saving...</span> :
                                            <span className="text-zinc-600">Saved</span>}
                </div>
            </div>

            {/* Media Previews */}
            {displayUrl && (
                <div className="relative w-full max-w-sm mx-auto mt-6 mb-8 group/image">
                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 shadow-xl dark:shadow-2xl">
                        {imageLoadError ? (
                            <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-zinc-500">
                                <X className="w-8 h-8" />
                                <span className="text-sm">Image failed to load</span>
                                <button
                                    onClick={refreshImageUrl} // Targeted refresh - only reloads image URL
                                    className="text-xs text-blue-500 hover:underline"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <img
                                src={displayUrl}
                                alt={`Journal entry for ${format(currentDate, 'MMMM d, yyyy')}`}
                                className="w-full h-auto max-h-[500px] object-contain transition-transform duration-700 hover:scale-[1.02]"
                                onError={() => {
                                    // FIX: Use sync handler to avoid stale state, limit to 1 retry
                                    // imageRetryAttemptedRef prevents infinite loop
                                    // FIX: Capture path to prevent race condition on navigation
                                    const capturedPath = imagePath;
                                    if (capturedPath && !imageLoadError && !imageRetryAttemptedRef.current) {
                                        imageRetryAttemptedRef.current = true;
                                        try {
                                            safeStorage.removeItem(`signed_url_journal-media-private_${capturedPath}`);
                                        } catch { }
                                        // Call async function separately
                                        getEternalSignedUrl(capturedPath).then(newUrl => {
                                            // FIX: Only update if path hasn't changed during async operation
                                            if (newUrl && isMountedRef.current && imagePathRef.current === capturedPath) {
                                                setDisplayUrl(newUrl);
                                            } else if (isMountedRef.current && imagePathRef.current === capturedPath) {
                                                setImageLoadError(true);
                                            }
                                        }).catch(() => {
                                            if (isMountedRef.current && imagePathRef.current === capturedPath) {
                                                setImageLoadError(true);
                                            }
                                        });
                                        return;
                                    }
                                    setImageLoadError(true);
                                }}
                                onLoad={() => setImageLoadError(false)}
                            />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors" />
                    </div>
                    <button
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 px-2 py-1 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-white hover:border-red-500 hover:bg-red-500 transition-all shadow-lg flex items-center gap-1 group/del-btn"
                    >
                        <X className="w-3 h-3" />
                        <span className="text-[10px] font-medium hidden group-hover/del-btn:block">Delete</span>
                    </button>
                </div>
            )}

            {audioDisplayUrl && (
                <AudioPlayer src={audioDisplayUrl} onDelete={removeAudio} accentColor={accentColor} />
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />

            <input
                type="file"
                ref={ocrFileInputRef}
                onChange={handleOCRUpload}
                accept="image/*"
                capture="environment"
                className="hidden"
            />

            {/* Action Bar */}
            <div className="flex w-full justify-center gap-8 mt-4 select-none">

                {/* Voice Group */}
                <div className="relative" ref={micMenuRef}>
                    <button
                        onClick={handleMicButtonClick}
                        className={cn(
                            "group p-3.5 rounded-full transition-all duration-300 relative",
                            isRecording ? "bg-zinc-200 dark:bg-zinc-800 ring-4 ring-zinc-300/30 dark:ring-zinc-700/30" :
                                isRecordingAudio ? "bg-red-500 scale-110 shadow-lg shadow-red-500/20" :
                                    showMicMenu ? "bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-200 dark:ring-zinc-700" :
                                        "hover:bg-black/5 dark:hover:bg-white/10"
                        )}
                    >
                        {isRecordingAudio ? (
                            <div className="flex items-center gap-1.5">
                                <AudioLines className="w-5 h-5 text-white animate-pulse" />
                                <span className="text-white text-xs font-mono">
                                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                        ) : isRecording ? (
                            <div className="flex items-center gap-2">
                                <Square className="w-5 h-5 text-zinc-900 dark:text-zinc-100 fill-current" />
                                <span className="text-zinc-900 dark:text-zinc-100 text-xs font-bold uppercase tracking-wider">Stop</span>
                            </div>
                        ) : (
                            <Mic className={cn("w-6 h-6 text-zinc-600 transition-colors", hoverClass)} />
                        )}
                    </button>

                    {/* Mic Menu Bubble */}
                    {showMicMenu && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col gap-1 min-w-[160px] animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                            <button
                                onClick={handleTranscriptionStart}
                                disabled={isTranscribing}
                                className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left disabled:opacity-50 disabled:cursor-wait"
                            >
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                                    <Mic className={cn("w-4 h-4 text-indigo-500", isTranscribing && "animate-pulse")} />
                                </div>
                                <div>
                                    <div className="text-zinc-900 dark:text-zinc-100 text-sm font-semibold">
                                        {isTranscribing ? "Processing..." : "Transcription"}
                                    </div>
                                    <div className="text-zinc-500 text-[10px]">
                                        {isTranscribing ? "Converting audio..." : "Type as you speak"}
                                    </div>
                                </div>
                            </button>
                            <button
                                onClick={handleVoiceNoteStart}
                                className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                                    <AudioLines className="w-4 h-4 text-red-500" />
                                </div>
                                <div>
                                    <div className="text-zinc-900 dark:text-zinc-100 text-sm font-semibold">Voice Note</div>
                                    <div className="text-zinc-500 text-[10px]">Save original audio</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Camera Group */}
                <div className="relative" ref={cameraMenuRef}>
                    <button
                        onClick={handleCameraButtonClick}
                        disabled={isUploading || isProcessingOCR}
                        className={cn(
                            "group p-3.5 rounded-full transition-all duration-300 disabled:opacity-50 relative",
                            isProcessingOCR ? "bg-blue-500/20 ring-4 ring-blue-500/20" :
                                showCameraMenu ? "bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-200 dark:ring-zinc-700" :
                                    "hover:bg-black/5 dark:hover:bg-white/10"
                        )}
                    >
                        {isProcessingOCR ? (
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        ) : (
                            <Camera className={cn("w-6 h-6 text-zinc-600 transition-colors", hoverClass)} />
                        )}
                    </button>

                    {/* Camera Menu Bubble */}
                    {showCameraMenu && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col gap-1 min-w-[160px] animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                            <button
                                onClick={handlePhotoStart}
                                className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                                    <Camera className="w-4 h-4 text-orange-500" />
                                </div>
                                <div>
                                    <div className="text-zinc-900 dark:text-zinc-100 text-sm font-semibold">Snap Photo</div>
                                    <div className="text-zinc-500 text-[10px]">Instant capture</div>
                                </div>
                            </button>
                            <button
                                onClick={handleOCRStart}
                                className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                    <ScanText className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <div className="text-zinc-900 dark:text-zinc-100 text-sm font-semibold">Scan Text</div>
                                    <div className="text-zinc-500 text-[10px]">Convert to text</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}