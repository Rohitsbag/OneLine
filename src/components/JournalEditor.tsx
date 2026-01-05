import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Camera, X, Square, AudioLines, ScanText } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { compressImage } from "@/utils/image";
import { AudioPlayer } from "./AudioPlayer";
import { ACCENT_COLORS } from "@/constants/colors";
import { performOCR } from "@/utils/ai";
import { useToast } from "./Toast";
import { JOURNAL_CONFIG } from "@/constants/journal";

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
}

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
                // HEIC uses ftyp box - check for 'ftyp' at offset 4
                return b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
            },
            'image/heif': (b) => {
                return b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
            },
        };

        const validator = signatures[file.type];
        if (validator) {
            return validator(bytes);
        }

        // For unknown image types, trust MIME if it starts with image/
        return file.type.startsWith('image/');

    } catch (e) {
        console.error("Magic number check failed", e);
        return false;
    }
};

export function JournalEditor({
    date,
    onDateChange,
    minDate,
    accentColor = "bg-indigo-500",
    isGuest = false,
    onGuestAction,
    refreshTrigger = 0
}: JournalEditorProps) {
    const currentDate = date; // Define early for Ref usage

    const [content, setContent] = useState("");
    const [imagePath, setImagePath] = useState<string | null>(null);
    const [displayUrl, setDisplayUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingSync, setPendingSync] = useState(false);

    const [userId, setUserId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Voice Note State
    const [audioPath, setAudioPath] = useState<string | null>(null);
    const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [imageLoadError, setImageLoadError] = useState(false); // NEW: Handle broken images
    const recognitionRef = useRef<SpeechRecognition | null>(null); // Type safety fix

    // Media Menu State
    const [showMicMenu, setShowMicMenu] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const micMenuRef = useRef<HTMLDivElement>(null);
    const cameraMenuRef = useRef<HTMLDivElement>(null);

    // OCR State
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);

    // === HARDENING REFS ===
    // 1. AbortController for fetching entries (prevent race conditions)
    const abortControllerRef = useRef<AbortController | null>(null);
    // 2. Track active Blob URL for immediate cleanup (prevents leaks in rapid DnD)
    const activeBlobUrlRef = useRef<string | null>(null);
    // 3. Track valid MIME type for Audio Recorder
    const mimeTypeRef = useRef<string>('audio/webm');
    // 4. Manual abort for OCR
    const ocrAbortControllerRef = useRef<AbortController | null>(null);
    // 5. Last Refresh Time (Visibility Debounce)
    const lastRefreshTimeRef = useRef<number>(0);


    // 2. Refs for cleanup (Fix Stale Closure in useEffect)
    const contentRef = useRef(content);
    const imagePathRef = useRef(imagePath);
    const audioPathRef = useRef(audioPath);

    // Sync refs with state
    useEffect(() => {
        contentRef.current = content;
        imagePathRef.current = imagePath;
        audioPathRef.current = audioPath;
    }, [content, imagePath, audioPath]);

    // === BUG FIX REFS ===
    // Prevents data loss on fast navigation - tracks if content needs saving
    const isDirtyRef = useRef(false);
    // Prevents memory leaks - guards async state updates after unmount
    const isMountedRef = useRef(true);
    const activeDateRef = useRef(currentDate); // Tracks the currently active date for async checks
    // Prevents SST duplication - tracks last appended transcript
    const lastAppendedTextRef = useRef("");
    // Recording timer state
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // ROOT CAUSE FIX: Tracks which date the CURRENT 'content' state belongs to.
    // This prevents Today's content from being saved into Yesterday's slot during transitions.
    const contentDateRef = useRef(format(date, 'yyyy-MM-dd'));

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
            const cachedUserRaw = localStorage.getItem('cached_user');
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
        const cacheKey = `entry_cache_${userId}_${dateStr}`;

        // STEP 0: Reset state immediately to prevent "Today" text showing on "Yesterday"
        if (isMountedRef.current) {
            setContent("");
            setImagePath(null);
            setAudioPath(null);
            setDisplayUrl(null);
            setAudioDisplayUrl(null);
            setIsLoading(true);
            setImageLoadError(false); // Reset error state on date change
            // CRITICAL: Reset dirty flag for the new date
            isDirtyRef.current = false;
            // Also reset the lock so no saves happen until data is loaded
            contentDateRef.current = "";
        }

        // STEP 1: Load from localStorage cache first (instant)
        const cachedEntry = localStorage.getItem(cacheKey);
        if (cachedEntry) {
            const cached = JSON.parse(cachedEntry);
            if (isMountedRef.current) {
                setContent(cached.content || "");
                setImagePath(cached.image_url || null);
                setAudioPath(cached.audio_url || null);
                // LOCK NOW: Allow saving immediate edits to the cached content
                contentDateRef.current = dateStr;
            }
        } else if (isMountedRef.current) {
            // No cache entry? It's a fresh day, so allow saving immediately
            contentDateRef.current = dateStr;
        }

        // STEP 2: Try to fetch from server (if online)
        try {
            const { data, error } = await supabase
                .from('entries')
                .select('content, image_url, audio_url, updated_at')
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
                    setContent(data.content || "");
                    setImagePath(data.image_url || null);
                    setAudioPath(data.audio_url || null);
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

    // Image Signed URL
    useEffect(() => {
        let cancelled = false;
        const loadSignedUrl = async () => {
            if (!imagePath) {
                if (isMountedRef.current && !cancelled) setDisplayUrl(null);
                return;
            }
            if (imagePath.startsWith('http')) {
                if (isMountedRef.current && !cancelled) setDisplayUrl(imagePath);
                return;
            }

            const { data, error } = await supabase.storage
                .from('journal-media-private')
                .createSignedUrl(imagePath, JOURNAL_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

            if (error) {
                console.warn("Failed to create signed URL:", error.message);
            }

            if (data?.signedUrl && isMountedRef.current && !cancelled) {
                setDisplayUrl(data.signedUrl);
            } else if (isMountedRef.current && !cancelled) {
                // Handle case where signing fails
                console.warn("Signed URL creation failed for path:", imagePath);
                setImageLoadError(true);
            }
        };
        loadSignedUrl();
        return () => { cancelled = true; };
    }, [imagePath]);

    // NEW: Targeted retry for image loading (Polish)
    const refreshImageUrl = useCallback(async () => {
        if (!imagePath || imagePath.startsWith('http')) return;

        setImageLoadError(false);
        // Optimistically clear error while processing

        const { data } = await supabase.storage
            .from('journal-media-private')
            .createSignedUrl(imagePath, JOURNAL_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

        if (data?.signedUrl && isMountedRef.current) {
            setDisplayUrl(data.signedUrl);
        } else if (isMountedRef.current) {
            setImageLoadError(true);
            showToast("Failed to reload image", "error");
        }
    }, [imagePath, showToast]);

    // Audio Signed URL
    useEffect(() => {
        let cancelled = false;
        const loadAudioUrl = async () => {
            if (!audioPath) {
                if (isMountedRef.current && !cancelled) setAudioDisplayUrl(null);
                return;
            }
            if (audioPath.startsWith('http')) {
                if (isMountedRef.current && !cancelled) setAudioDisplayUrl(audioPath);
                return;
            }

            const { data } = await supabase.storage
                .from('journal-media-private')
                .createSignedUrl(audioPath, JOURNAL_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

            if (data?.signedUrl && isMountedRef.current && !cancelled) {
                setAudioDisplayUrl(data.signedUrl);
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
                localStorage.setItem(key, value);
            } catch (e: any) {
                if (e.name === 'QuotaExceededError') {
                    console.warn("LocalStorage full, cleaning up oldest entries...");
                    try {
                        // Smart Cleanup: Sort by updated_at to remove ONLY the oldest
                        const items = Object.keys(localStorage)
                            .filter(k => k.startsWith('entry_cache_'))
                            .map(k => {
                                try {
                                    const val = JSON.parse(localStorage.getItem(k) || '{}');
                                    return { key: k, time: val.updated_at ? new Date(val.updated_at).getTime() : 0 };
                                } catch {
                                    return { key: k, time: 0 };
                                }
                            })
                            .sort((a, b) => a.time - b.time); // Oldest first

                        // Remove oldest 20% or at least 5
                        const countToRemove = Math.max(5, Math.floor(items.length * 0.2));
                        items.slice(0, countToRemove).forEach(item => localStorage.removeItem(item.key));

                        // Retry set
                        localStorage.setItem(key, value);
                    } catch (retryE) {
                        console.error("Cache write failed even after cleanup", retryE);
                    }
                }
            }
        };

        // OFFLINE-FIRST: Always update local cache first
        const cacheKey = `entry_cache_${userId}_${dateStr}`;
        const cacheData = {
            content: currentContent,
            image_url: currentImagePath,
            audio_url: currentAudioPath,
            updated_at: new Date().toISOString()
        };
        safeSetItem(cacheKey, JSON.stringify(cacheData));

        // Helper to save to pending sync queue (for server sync)
        const saveOffline = () => {
            const existingRaw = localStorage.getItem('pending_journal_sync');
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

        const { error } = await supabase
            .from('entries')
            .upsert({
                user_id: userId,
                date: dateStr,
                content: currentContent,
                image_url: currentImagePath,
                audio_url: currentAudioPath,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, date' });

        if (isMountedRef.current) {
            if (error) {
                console.error('Error saving:', error);
                setHasError(true);
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
            }
            setIsSaving(false);
        }
        isDirtyRef.current = false;
    }, [userId]);

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
        if (isMountedRef.current) setIsSaving(true);

        const timeoutId = setTimeout(() => {
            saveEntry(dateStr, content, imagePath, audioPath);
        }, 800);

        return () => {
            clearTimeout(timeoutId);
            // CRITICAL (STALE CLOSURE FIX): Use Refs to ensure we save the LATEST text during cleanup
            if (isDirtyRef.current && userId && contentDateRef.current === dateStr) {
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
    }, [content, adjustTextareaHeight]);

    // --- File Handlers ---
    const processFile = useCallback(async (file: File) => {
        if (!userId) return;

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
            const compressedBlob = await compressImage(file, JOURNAL_CONFIG.IMAGE_UPLOAD_QUALITY, JOURNAL_CONFIG.IMAGE_UPLOAD_MAX_SIZE);

            // COMPRESSION VALIDATION
            if (!compressedBlob || compressedBlob.size === 0) {
                throw new Error("Compression failed (empty result).");
            }
            if (compressedBlob.size > JOURNAL_CONFIG.MAX_COMPRESSED_IMAGE_SIZE_MB * 1024 * 1024) {
                throw new Error("Image too complex. Please use a smaller image.");
            }

            const fileName = `${userId}/${Date.now()}-${file.name.split('.')[0]}.webp`;
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
                showToast(error.message || "Failed to upload image.", "error");
                setDisplayUrl(null);
                setImagePath(null);
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
            setImagePath(previousPath);
            setDisplayUrl(previousUrl);
            showToast("Failed to delete image. Please try again.", "error");
        }
    };

    // --- Audio Logic ---
    const startAudioRecording = async () => {
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

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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

                stream.getTracks().forEach(track => track.stop());
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
            console.error("Error starting audio:", error);
            if (error.name === 'NotAllowedError') {
                showToast("Microphone access denied. Please enable microphone permissions in settings.", "error");
            } else {
                showToast("Could not start microphone: " + error.message, "error");
            }
        }
    };

    const stopAudioRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        // Stop timer on manual stop
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setIsRecordingAudio(false);
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
            setAudioPath(previousPath);
            setAudioDisplayUrl(previousUrl);
            showToast("Failed to delete voice note.", "error");
        }
    };

    // --- STT Logic (Tiered: Whisper Online / WebSpeech Offline) ---
    const [isTranscribing, setIsTranscribing] = useState(false);

    const toggleRecording = async () => {
        if (isRecording) {
            // STOP RECORDING
            if (recognitionRef.current) {
                // Offline mode stop
                recognitionRef.current.stop();
                setIsRecording(false);
            } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                // Online mode stop
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            // START RECORDING

            // Check Network Tier
            const { detectNetworkTier, getSTTModel } = await import("@/utils/stt-tiered");
            let tier = detectNetworkTier();

            // SMART FALLBACK: If nominally online, do a quick API health check
            // If API is broken (e.g., auth issues), fall back to offline mode proactively
            // OPTIMIZED AUTH: Use local session check or cached userId to avoid redundant API hits
            if (tier !== "offline") {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token && !userId) {
                    console.log("No session - using offline STT mode");
                    tier = "offline";
                }
            }

            if (tier === "offline") {
                // === OFFLINE MODE: Web Speech API ===
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    showToast("Offline voice recognition not supported on this device.", "warning");
                    return;
                }

                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                recognition.onstart = () => {
                    setIsRecording(true);
                    lastAppendedTextRef.current = "";
                };
                recognition.onend = () => {
                    setIsRecording(false);
                    recognitionRef.current = null;
                };
                recognition.onerror = (e: any) => {
                    console.warn('Speech recognition error:', e.error);
                    setIsRecording(false);
                };
                recognition.onresult = (event: any) => {
                    const latestResult = event.results[event.results.length - 1];
                    if (latestResult.isFinal) {
                        // ROBUST STT DEDUPLICATION (Master Prompt #5)
                        const newText = latestResult[0].transcript.trim();
                        if (!newText) return;

                        // Get the truly new part by checking if the previous text ends with the beginning of new text
                        // or if the new text starts with the previous text (overlap)
                        let textToAppend = newText;

                        // normalize (remove case/punctuation for check)
                        const normalize = (str: string) => str.toLowerCase().replace(/[.,!?;]/g, '');

                        // Check if exact same content came through (common phantom event)
                        if (normalize(newText) === normalize(lastAppendedTextRef.current)) return;

                        // Incremental append strategy:
                        // Only Append if it's genuinely new content
                        if (textToAppend !== lastAppendedTextRef.current) {
                            lastAppendedTextRef.current = textToAppend;

                            setContent(prev => {
                                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                                return prev + (needsSpace ? ' ' : '') + textToAppend;
                            });
                        }
                    }
                };

                recognitionRef.current = recognition;
                try {
                    recognition.start();
                } catch (startError: any) {
                    console.error("Failed to start speech recognition:", startError);
                    showToast("Could not start voice recognition. Please try again.", "error");
                    setIsRecording(false);
                    return;
                }

            } else {
                // === ONLINE MODE: Whisper (High Quality) ===
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    // Determine supported MIME type for Mobile/Desktop compatibility
                    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
                    const mediaRecorder = new MediaRecorder(stream, { mimeType });
                    const chunks: BlobPart[] = [];

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) chunks.push(e.data);
                    };

                    mediaRecorder.onstop = async () => {
                        // Clean up stream tracks immediately
                        stream.getTracks().forEach(track => track.stop());

                        const blob = new Blob(chunks, { type: mimeType }); // Use detected MIME type

                        setIsTranscribing(true);
                        try {
                            const { transcribeAudio } = await import("@/utils/ai");
                            const model = getSTTModel(tier); // whisper-large-v3 or turbo

                            const text = await transcribeAudio(blob, model);
                            if (text && isMountedRef.current) {
                                setContent(prev => {
                                    const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                                    return prev + (needsSpace ? ' ' : '') + text;
                                });
                            }
                        } catch (err: any) {
                            console.error("Transcription failed:", err);
                            // Specific feedback for Auth/Network issues
                            if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
                                showToast("Session expired. Please sign in again.", "warning");
                            } else {
                                showToast("Transcription failed. Please try again.", "error");
                            }
                        } finally {
                            if (isMountedRef.current) setIsTranscribing(false);
                        }
                    };

                    mediaRecorderRef.current = mediaRecorder;
                    mediaRecorder.start();
                    setIsRecording(true);

                } catch (err) {
                    console.error("Mic error:", err);
                    showToast("Could not access microphone.", "error");
                }
            }
        }
    };

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

    const handlePhotoStart = () => {
        triggerHaptic();
        setShowCameraMenu(false);
        fileInputRef.current?.click();
    };

    const handleOCRStart = () => {
        triggerHaptic(15);
        setShowCameraMenu(false);
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
        const startDateStr = format(currentDate, 'yyyy-MM-dd');

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
            // Args: file, maxDimension (px), targetSize (KB)
            const compressedBlob = await compressImage(
                file,
                JOURNAL_CONFIG.OCR_IMAGE_MAX_SIZE, // 1024px
                1024 // Target 1MB (plenty for OCR text)
            );

            if (signal.aborted) return;

            // Post-compression size guard
            if (compressedBlob.size === 0) {
                throw new Error("Image compression failed (0 bytes). Try a different image.");
            }
            if (compressedBlob.size > JOURNAL_CONFIG.MAX_OCR_IMAGE_SIZE_MB * 1024 * 1024) {
                throw new Error("Image too complex for OCR. Please crop or resize.");
            }

            const processedFile = new File([compressedBlob], "ocr_temp.webp", { type: "image/webp" });

            // Import and run OCR (Tiered)
            const { extractTextOffline } = await import("@/utils/ocr-offline");

            let text = "";

            // Check Network Tier
            const { detectNetworkTier } = await import("@/utils/stt-tiered");
            const tier = detectNetworkTier();

            // ABORT WRAPPER
            const abortableOCR = <T,>(promise: Promise<T>, timeout: number) => {
                return new Promise<T>((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error("OCR Timeout")), timeout);
                    signal.addEventListener("abort", () => {
                        clearTimeout(timer);
                        reject(new DOMException("Aborted", "AbortError"));
                    }, { once: true });

                    promise.then(res => {
                        clearTimeout(timer);
                        if (!signal.aborted) resolve(res);
                    }).catch(err => {
                        clearTimeout(timer);
                        reject(err);
                    });
                });
            };

            if (tier === 'offline') {
                if (signal.aborted) return;
                text = await abortableOCR(extractTextOffline(processedFile), JOURNAL_CONFIG.OCR_TIMEOUT_MS);
            } else {
                try {
                    // Online: performOCR takes a File object directly
                    text = await performOCR(processedFile);
                } catch (err: any) {
                    // Check if it was an abort
                    if (err.name === 'AbortError' || signal.aborted) throw err;

                    console.warn("Online OCR failed, falling back to offline", err);
                    text = await abortableOCR(extractTextOffline(processedFile), JOURNAL_CONFIG.OCR_TIMEOUT_MS);
                }
            }

            if (signal.aborted) return;

            // Verify we're still on the same date using Ref (Fresh Value)
            const currentActiveDateStr = format(activeDateRef.current, 'yyyy-MM-dd');
            if (currentActiveDateStr !== startDateStr) {
                console.log("Date changed during OCR - discarding result");
                return;
            }

            if (text && isMountedRef.current) {
                // Sanitize: Remove control characters
                const cleanText = text.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

                setContent(prev => {
                    // Smart append
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
                    return prev + (needsSpace ? ' ' : '') + cleanText;
                });
                showToast("Text extracted from image!", "success");
            }

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
                <h2 className="text-2xl font-light text-[#18181b] dark:text-white select-none">
                    {isToday ? "Today" : format(currentDate, "MMMM d, yyyy")}
                </h2>
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

            {/* Editor */}
            <div
                className={cn(
                    "w-full relative group transition-all duration-300 rounded-xl",
                    isDragging ? "bg-zinc-200/50 dark:bg-zinc-900/50 ring-2 ring-zinc-400 dark:ring-zinc-700 scale-[1.02]" : ""
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
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
                                onError={() => setImageLoadError(true)}
                                onLoad={() => setImageLoadError(false)}
                            />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors" />
                    </div>
                    <button
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-white hover:border-red-500 hover:bg-red-500 transition-all opacity-0 group-hover/image:opacity-100 shadow-lg"
                    >
                        <X className="w-3 h-3" />
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
                            <Camera className="w-6 h-6 text-blue-500 animate-pulse" />
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
