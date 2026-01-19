import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Camera, Video, X, Square, AudioLines, ScanText, Loader2, Trash2, Sparkles } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { compressImage } from "@/utils/image";
import { transcribeAudio } from "@/utils/ai";
import { AudioPlayer } from "./AudioPlayer";
import { ACCENT_COLORS } from "@/constants/colors";
import { useToast } from "./Toast";
import { JOURNAL_CONFIG } from "@/constants/journal";
import * as nativeMedia from "@/utils/native-media";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { MediaItem, MEDIA_LIMITS, canAddMedia } from "@/types/media";


// Fix Types for SpeechRecognition (REMOVED: Using Whisper Only)
interface JournalEditorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    minDate?: Date;
    accentColor?: string;
    isGuest?: boolean;
    onGuestAction?: () => void;
    refreshTrigger?: number;
    sttLanguage?: string;
    aiRewriteEnabled?: boolean;
    mediaDisplayMode?: 'grid' | 'swipe' | 'scroll';
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
// Sub-component for rendering media items with signed URLs
const MediaItemView = ({ item, accentColor }: { item: MediaItem, accentColor?: string }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        const load = async () => {
            // Handle raw files or data URLs instantly
            if (item.url.startsWith('http') || item.url.startsWith('data:') || item.url.startsWith('blob:')) {
                setUrl(item.url);
                return;
            }
            if (item.url.startsWith('local://')) {
                try {
                    const fileName = item.url.replace('local://', '');
                    const fileData = await Filesystem.readFile({
                        path: fileName,
                        directory: Directory.Data
                    });
                    // Determine mime type based on item type
                    const mime = item.type === 'image' ? 'image/webp' : 'audio/webm';
                    const src = `data:${mime};base64,${fileData.data}`;
                    if (isMounted.current) setUrl(src);
                } catch (e) {
                    console.error("Local load failed", e);
                    if (isMounted.current) setError(true);
                }
                return;
            }

            // Supabase Signed URL
            const signed = await getEternalSignedUrl(item.url);
            if (isMounted.current) {
                if (signed) setUrl(signed);
                else setError(true);
            }
        };
        load();
        return () => { isMounted.current = false; };
    }, [item.url, item.type]);

    if (error) return <div className="flex items-center justify-center w-full h-full bg-zinc-100 dark:bg-zinc-800 text-xs text-red-500">Failed</div>;
    if (!url) return <div className="flex items-center justify-center w-full h-full bg-zinc-100 dark:bg-zinc-800"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>;

    if (item.type === 'image' || item.type === 'video') {
        return <img src={url} alt="Media" className="w-full h-full object-cover" />;
    }

    if (item.type === 'audio') {
        // Audio player needs to be wrapped or styled?
        // It handles its own styles usually.
        return <AudioPlayer src={url} accentColor={accentColor} />;
    }

    return null;
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
    sttLanguage = "Auto",
    aiRewriteEnabled = false,
    mediaDisplayMode = 'grid'
}: JournalEditorProps) {
    const currentDate = date; // Define early for Ref usage

    // --------------------------------------------------------------------------------
    // STATE DECLARATIONS (Base)
    // --------------------------------------------------------------------------------
    const [userId, setUserId] = useState<string | null>(null);
    const [entryId, setEntryId] = useState<string | null>(null);
    const [content, setContent] = useState("");

    // Media State
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

    // Derived state for backward compatibility references or specialized views if needed
    // const [displayUrl, setDisplayUrl] = useState<string | null>(null); // Replaced by mediaItems render logic

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
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const [showMicMenu, setShowMicMenu] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isRewriting, setIsRewriting] = useState(false);

    // Sync Status (UI-only for visual feedback)
    const [syncStatus, setSyncStatus] = useState<'local' | 'pending' | 'synced' | 'failed'>('synced');

    // History State
    // History State
    const [history, setHistory] = useState<Array<{ content: string; mediaItems: MediaItem[] }>>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // --------------------------------------------------------------------------------
    // REFS (Lifecycle & Async Guards)
    // --------------------------------------------------------------------------------
    const isUndoingRedoingRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);
    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const micMenuRef = useRef<HTMLDivElement>(null);
    const cameraMenuRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const activeBlobUrlRef = useRef<string | null>(null);
    const mimeTypeRef = useRef<string>('audio/webm');
    const ocrAbortControllerRef = useRef<AbortController | null>(null);
    const lastRefreshTimeRef = useRef<number>(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const contentRef = useRef(content);
    const mediaItemsRef = useRef(mediaItems);
    const isDirtyRef = useRef(false);
    const isMountedRef = useRef(true);
    const activeDateRef = useRef(currentDate);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const contentDateRef = useRef(format(date, 'yyyy-MM-dd'));
    const micStreamRef = useRef<MediaStream | null>(null);
    const onAudioBlobRef = useRef<((blob: Blob, duration: number) => void) | null>(null);

    // Sync refs with state
    useEffect(() => {
        contentRef.current = content;
        mediaItemsRef.current = mediaItems;
    }, [content, mediaItems]);

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

            // NEW: Stop MediaRecorder if active
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

    const syncPendingData = useCallback(async () => {
        const pendingRaw = localStorage.getItem('pending_journal_sync');
        if (!pendingRaw || !userId) return;

        setPendingSync(true);
        try {
            const pendingEntries = JSON.parse(pendingRaw) as Record<string, { content: string; media_items?: MediaItem[]; updated_at?: string }>;
            // CHRONOLOGICAL SYNC: Sort dates to prevent older data from overwriting newer entries
            const dates = Object.keys(pendingEntries).sort();

            for (const dateKey of dates) {
                const entry = pendingEntries[dateKey];
                const localTimestamp = entry.updated_at ? new Date(entry.updated_at).getTime() : Date.now();

                // OFFLINE MEDIA SYNC: Detect and upload local files
                // We must process the media_items array
                let finalMediaItems: MediaItem[] = [];
                if (entry.media_items) {
                    finalMediaItems = [...entry.media_items];

                    if (nativeMedia.isNative()) {
                        for (let i = 0; i < finalMediaItems.length; i++) {
                            const item = finalMediaItems[i];
                            if (item.url.startsWith('local://')) {
                                try {
                                    const fileName = item.url.replace('local://', '');
                                    const fileData = await Filesystem.readFile({
                                        path: fileName,
                                        directory: Directory.Data
                                    });

                                    // Determine mime type and extension
                                    let mimeType = item.type === 'image' ? 'image/webp' :
                                        item.type === 'video' ? 'video/mp4' : 'audio/webm';
                                    const ext = fileName.split('.').pop() || (item.type === 'image' ? 'webp' : item.type === 'video' ? 'mp4' : 'webm');
                                    if (item.type === 'audio') mimeType = `audio/${ext}`; // Better audio mime handling

                                    const blob = new Blob([Uint8Array.from(atob(fileData.data as string), c => c.charCodeAt(0))], { type: mimeType });
                                    const serverFileName = `${userId}/${Date.now()}-synced-${i}.${ext}`;

                                    const { error: uploadError } = await supabase.storage
                                        .from('journal-media-private')
                                        .upload(serverFileName, blob);

                                    if (!uploadError) {
                                        // Update the item URL in our list
                                        finalMediaItems[i] = { ...item, url: serverFileName, local_path: undefined }; // Clear local path if synced? Keep it?
                                        // Clean up local file
                                        await Filesystem.deleteFile({ path: fileName, directory: Directory.Data });
                                    }
                                } catch (e) {
                                    console.error(`Local media sync failed for ${item.url}:`, e);
                                }
                            }
                        }
                    }
                }

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
                        media_items: finalMediaItems, // Using new column
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
            setMediaItems([]);
            setIsLoading(true);
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
                setMediaItems(cached.media_items || []);
                setEntryId(cached.id || null);
                contentDateRef.current = dateStr;
            }
        } else if (isMountedRef.current && !isSameDateRefresh) {
            contentDateRef.current = dateStr;
        }

        try {
            const { data, error } = await supabase
                .from('entries')
                .select('id, content, media_items, updated_at')
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
                    const newMedia = data.media_items || [];

                    setContent(newContent);
                    setMediaItems(newMedia);
                    setEntryId(data.id); // Bind to Server Identity

                    // Initialize History once data is loaded
                    setHistory([{ content: newContent, mediaItems: newMedia }]);
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
        setHistory([{ content: contentRef.current, mediaItems: mediaItemsRef.current }]);
        setHistoryIndex(0);
    }, [currentDate]); // ONLY currentDate

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

    // --- Media Helpers ---
    const addMedia = useCallback((newItem: MediaItem) => {
        if (!canAddMedia(mediaItems, newItem.type)) {
            const limit = newItem.type === 'audio' ? MEDIA_LIMITS.MAX_AUDIO : MEDIA_LIMITS.MAX_PHOTOS_VIDEOS;
            showToast(`Limit Reached: You can only add ${limit} ${newItem.type} files.`, 'error');
            return false;
        }

        setMediaItems(prev => [...prev, newItem]);
        isDirtyRef.current = true;
        return true;
    }, [mediaItems, showToast]);

    const removeMedia = useCallback(async (index: number) => {
        const itemToRemove = mediaItems[index];
        if (!itemToRemove) return;

        const confirmed = await showConfirm({
            title: "Delete Media",
            message: "Delete this item? This cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel"
        });
        if (!confirmed) return;

        // Optimistic Remove
        const previousItems = [...mediaItems];
        setMediaItems(prev => prev.filter((_, i) => i !== index));
        isDirtyRef.current = true;

        try {
            // Delete file logic
            if (itemToRemove.url.startsWith('local://')) {
                const fileName = itemToRemove.url.replace('local://', '');
                await Filesystem.deleteFile({ path: fileName, directory: Directory.Data }).catch(e => console.warn("Local delete failed", e));
            } else if (!itemToRemove.url.startsWith('http') && !itemToRemove.url.startsWith('blob:') && !itemToRemove.url.startsWith('data:')) {
                // Supabase path
                const { error } = await supabase.storage.from('journal-media-private').remove([itemToRemove.url]);
                if (error) console.warn("Remote delete failed:", error);
            }
        } catch (e) {
            console.error("Delete failed", e);
            setMediaItems(previousItems); // Rollback
            showToast("Failed to delete item", "error");
        }
    }, [mediaItems, showToast, showConfirm]);

    // Save Entry (Debounced with dirty flag to prevent data loss)
    const saveEntry = useCallback(async (dateStr: string, currentContent: string, currentMediaItems: MediaItem[]) => {
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
            media_items: currentMediaItems,
            updated_at: new Date().toISOString()
        };
        safeSetItem(cacheKey, JSON.stringify(cacheData));

        // Helper to save to pending sync queue (for server sync)
        const saveOffline = () => {
            const existingRaw = safeStorage.getItem('pending_journal_sync');
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            existing[dateStr] = {
                content: currentContent,
                media_items: currentMediaItems,
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
                    media_items: currentMediaItems,
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
                    media_items: currentMediaItems,
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
            saveEntry(dateStr, content, mediaItems);
        }, 7000); // PRODUCTION: 7-second debounce to prevent API spam

        return () => {
            clearTimeout(timeoutId);
            // FIX: Use closure-captured `dateStr` (not ref) - this effect belongs to this specific date
            // Using ref was risky: if fetchEntry for new date runs before cleanup, ref has wrong date
            if (isDirtyRef.current && userId) {
                saveEntry(dateStr, contentRef.current, mediaItemsRef.current);
            }
        };
    }, [content, mediaItems, currentDate, userId, isLoading, saveEntry]);

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
                JSON.stringify(lastState.mediaItems) !== JSON.stringify(mediaItems);

            if (hasChanged) {
                const timeoutId = setTimeout(() => {
                    setHistory(prev => {
                        const newHistory = prev.slice(0, historyIndex + 1);
                        newHistory.push({ content, mediaItems });
                        if (newHistory.length > 20) newHistory.shift();
                        return newHistory;
                    });
                    setHistoryIndex(prev => Math.min(prev + 1, 19));
                }, 500); // Debounce history push
                return () => clearTimeout(timeoutId);
            }
        }
    }, [content, mediaItems, adjustTextareaHeight, isLoading]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoingRedoingRef.current = true;
            const prevState = history[historyIndex - 1];
            setContent(prevState.content);
            setMediaItems(prevState.mediaItems);
            setHistoryIndex(prev => prev - 1);
            setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoingRedoingRef.current = true;
            const nextState = history[historyIndex + 1];
            setContent(nextState.content);
            setMediaItems(nextState.mediaItems);
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

        // OFFLINE CHECK
        if (!navigator.onLine && nativeMedia.isNative()) {
            try {
                // Offline Logic for Native
                setIsUploading(true);

                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const fileName = `offline-image-${Date.now()}.webp`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });

                const localPath = `local://${fileName}`;
                if (isMountedRef.current) {
                    addMedia({ type: 'image', url: localPath });
                    showToast("Saved locally (offline mode)", "success");
                }
                return;
            } catch (error) {
                console.error("Offline image save failed:", error);
                showToast("Could not save image offline.", "error");
                return;
            } finally {
                setIsUploading(false);
            }
        }

        if (!navigator.onLine) {
            showToast("Cannot upload media while offline.", "warning");
            return;
        }

        if (!file.type.startsWith('image/')) {
            showToast("Invalid image file", "error");
            return;
        }

        setIsUploading(true);

        try {
            // Compress with specific target size from updated logic
            const compressedBlob = await compressImage(file, JOURNAL_CONFIG.IMAGE_UPLOAD_MAX_SIZE, 1500);

            if (!compressedBlob || compressedBlob.size === 0) throw new Error("Compression failed");

            const uuid = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
            const fileName = `${userId}/${Date.now()}-${uuid}.webp`;

            const { error } = await supabase.storage
                .from('journal-media-private')
                .upload(fileName, compressedBlob);

            if (error) throw error;

            if (isMountedRef.current) {
                addMedia({ type: 'image', url: fileName });
            }

        } catch (error: any) {
            console.error("Upload failed", error);
            showToast("Upload failed: " + error.message, "error");
        } finally {
            if (isMountedRef.current) setIsUploading(false);
        }
    }, [userId, addMedia, showToast]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        processFile(e.target.files[0]);
        e.target.value = "";
    };

    // --- Audio Handler ---
    const handleVoiceNote = async (audioBlob: Blob, duration?: number) => {
        const finalDuration = duration ?? recordingDuration;

        if (!navigator.onLine && nativeMedia.isNative()) {
            // Offline Native Audio Logic
            try {
                const reader = new FileReader();
                const base64Data = await new Promise<string>((r, rej) => {
                    reader.onload = () => r(reader.result as string);
                    reader.onerror = rej;
                    reader.readAsDataURL(audioBlob);
                });
                const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
                const fileName = `offline-audio-${Date.now()}.${ext}`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });
                if (isMountedRef.current) {
                    addMedia({ type: 'audio', url: `local://${fileName}`, duration_seconds: finalDuration });
                    showToast("Voice note saved locally", "success");
                }
                return;
            } catch (e) {
                console.error("Offline audio save failed", e);
                return;
            }
        }

        if (!navigator.onLine && nativeMedia.isNative()) {
            try {
                // Offline Logic for Voice Note (Native)
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(audioBlob);
                });

                const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
                const fileName = `offline-audio-${Date.now()}.${ext}`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });

                const localPath = `local://${fileName}`;
                if (isMountedRef.current) {
                    addMedia({ type: 'audio', url: localPath, duration_seconds: finalDuration });
                    showToast("Audio saved locally (offline)", "success");
                }
                return;
            } catch (error) {
                console.error("Offline audio save failed:", error);
                showToast("Could not save audio offline.", "error");
                return;
            }
        }

        if (!navigator.onLine) {
            showToast("Offline: Please wait for internet to upload.", "warning");
            return;
        }

        const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const fileName = `${userId}/audio-${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from('journal-media-private').upload(fileName, audioBlob);

        if (error) {
            console.error("Audio upload failed", error);
            showToast("Upload failed", "error");
        } else {
            if (isMountedRef.current) {
                addMedia({ type: 'audio', url: fileName, duration_seconds: finalDuration });
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
        // DOUBLE RECORDING GUARD
        if (isRecordingAudio || mediaRecorderRef.current?.state === "recording") {
            console.warn("Recording already in progress");
            return;
        }

        if (nativeMedia.isNative()) {
            const hasPermission = await nativeMedia.nativeVoice.requestPermission();
            if (!hasPermission) {
                showToast("Microphone permission denied.", "error");
                onAudioBlobRef.current = null;
                setIsRecording(false);
                return;
            }
            try {
                await nativeMedia.nativeVoice.start();
                setIsRecordingAudio(true);
                setRecordingDuration(0);
                recordingTimerRef.current = setInterval(() => {
                    if (isMountedRef.current) {
                        setRecordingDuration(prev => {
                            if (prev >= JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS) {
                                stopAudioRecording();
                                return JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS;
                            }
                            return prev + 1;
                        });
                    }
                }, 1000);
                return;
            } catch (err) {
                console.error("Native recording start failed:", err);
                showToast("Could not start microphone.", "error");
                onAudioBlobRef.current = null;
                setIsRecording(false);
                return;
            }
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("Audio recording not supported.", "error");
            return;
        }

        if (!navigator.onLine) {
            const confirmed = await showConfirm({
                title: "You're Offline",
                message: "Voice notes recorded offline will be saved locally.",
                confirmText: "Record Anyway",
                cancelText: "Cancel"
            });
            if (!confirmed) return;
        }

        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;

            // Check supported mime types
            let mimeType = 'audio/webm';
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
                else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
                else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
            }
            mimeTypeRef.current = mimeType;

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                    recordingTimerRef.current = null;
                }
                const duration = recordingDuration; // Capture current duration
                if (isMountedRef.current) setRecordingDuration(0);

                const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });

                // CRITICAL: Differentiate between Transcription (STT) and Voice Note
                if (onAudioBlobRef.current) {
                    onAudioBlobRef.current(audioBlob, duration);
                    onAudioBlobRef.current = null;
                } else {
                    handleVoiceNote(audioBlob, duration);
                }

                setIsRecordingAudio(false);
                micStreamRef.current?.getTracks().forEach(track => track.stop());
                micStreamRef.current = null;
            };

            mediaRecorder.start();
            setIsRecordingAudio(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                if (isMountedRef.current) {
                    setRecordingDuration(prev => {
                        if (prev >= JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS) {
                            stopAudioRecording();
                            return JOURNAL_CONFIG.MAX_RECORDING_DURATION_SECONDS;
                        }
                        return prev + 1;
                    });
                }
            }, 1000);

        } catch (error: any) {
            if (stream) stream.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
            console.error("Error starting audio:", error);
            showToast("Could not start microphone: " + error.message, "error");
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
                // Respect STT callback if present
                if (onAudioBlobRef.current) {
                    onAudioBlobRef.current(result.blob, recordingDuration);
                    onAudioBlobRef.current = null;
                } else {
                    await handleVoiceNote(result.blob, recordingDuration);
                }
            }
            if (isMountedRef.current) setRecordingDuration(0);
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

    const stopTranscriptionRecording = async () => {
        if (!isRecording) return;

        // Use central stop logic to ensure all states (including isRecordingAudio) are reset
        await stopAudioRecording();
        setIsRecording(false);
    };




    // --- STT Logic (Strictly Whisper-Only) ---
    const [isTranscribing, setIsTranscribing] = useState(false);

    const toggleRecording = useCallback(async () => {
        if (!navigator.onLine) {
            showToast("Internet required for transcription.", "warning");
            return;
        }

        if (isRecording) {
            // --- STOP RECORDING ---
            stopTranscriptionRecording();
        } else {
            // --- START RECORDING ---

            // 1. SET TRANSCRIPTION CALLBACK
            onAudioBlobRef.current = async (blob: Blob) => {
                setIsTranscribing(true);

                const tryTranscribe = async (model: string) => {
                    try {
                        return await transcribeAudio(blob, model, sttLanguage);
                    } catch (e) {
                        console.error(`Transcription with ${model} failed`, e);
                        return null;
                    }
                };

                const executeFlow = async () => {
                    // TIER 1: Main Model
                    let result = await tryTranscribe("whisper-large-v3");
                    if (result?.trim()) return result;

                    // TIER 1.5: Instant Fallback
                    result = await tryTranscribe("whisper-large-v3-turbo");
                    if (result?.trim()) return result;

                    // TIER 2: Full Retry Cycle (once more)
                    result = await tryTranscribe("whisper-large-v3");
                    if (result?.trim()) return result;

                    result = await tryTranscribe("whisper-large-v3-turbo");
                    return result;
                };

                try {
                    const finalResult = await executeFlow();

                    if (isMountedRef.current && finalResult?.trim()) {
                        setContent(prev => {
                            const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                            return prev + (needsSpace ? ' ' : '') + finalResult.trim();
                        });
                        showToast("Transcription complete", "success");
                    } else if (isMountedRef.current) {
                        showToast("Speech could not be processed. Please try again.", "error");
                    }
                } catch (err: any) {
                    console.error("Critical transcription error:", err);
                    if (isMountedRef.current) {
                        showToast("Transcription failed. Check your connection.", "error");
                    }
                } finally {
                    if (isMountedRef.current) setIsTranscribing(false);
                }
            };

            // 2. START RECORDING
            try {
                startAudioRecording();
                setIsRecording(true);
            } catch (err) {
                console.error("Failed to start audio recording", err);
                showToast("Could not access microphone.", "error");
                onAudioBlobRef.current = null;
            }
        }
    }, [isRecording, sttLanguage, showToast, isMountedRef, setContent, startAudioRecording, stopTranscriptionRecording]);

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
                await handleOCRUploadManual(result.blob);
            }
            return;
        }

        ocrFileInputRef.current?.click();
    };

    const handleVideoStart = async () => {
        setShowCameraMenu(false);
        if (nativeMedia.isNative()) {
            const result = await nativeMedia.getVideo();
            if (result) {
                await processVideoFile(new File([result.blob], `video.${result.format}`, { type: `video/${result.format}` }));
            }
            return;
        }
        videoFileInputRef.current?.click();
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = "";
        await processVideoFile(file);
    };

    const processVideoFile = async (file: File) => {
        if (!userId) return;

        // OFFLINE CHECK
        if (!navigator.onLine && nativeMedia.isNative()) {
            try {
                setIsUploading(true);
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const fileName = `offline-video-${Date.now()}.mp4`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });

                const localPath = `local://${fileName}`;
                if (isMountedRef.current) {
                    addMedia({ type: 'video', url: localPath });
                    showToast("Video saved locally (offline)", "success");
                }
                return;
            } catch (error) {
                console.error("Offline video save failed:", error);
                showToast("Could not save video offline.", "error");
                return;
            } finally {
                setIsUploading(false);
            }
        }

        if (!navigator.onLine) {
            showToast("Internet required for video upload.", "warning");
            return;
        }

        setIsUploading(true);
        try {
            const uuid = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
            const ext = file.name.split('.').pop() || 'mp4';
            const fileName = `${userId}/video-${Date.now()}-${uuid}.${ext}`;

            const { error } = await supabase.storage
                .from('journal-media-private')
                .upload(fileName, file);

            if (error) throw error;

            if (isMountedRef.current) {
                addMedia({ type: 'video', url: fileName });
                showToast("Video uploaded", "success");
            }
        } catch (error: any) {
            console.error("Video upload error:", error);
            showToast("Video upload failed.", "error");
        } finally {
            if (isMountedRef.current) setIsUploading(false);
        }
    };

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

    const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = "";

        if (ocrAbortControllerRef.current) {
            ocrAbortControllerRef.current.abort();
        }
        ocrAbortControllerRef.current = new AbortController();
        const signal = ocrAbortControllerRef.current.signal;

        if (!userId) return;

        if (!file.type.startsWith('image/')) {
            showToast("Invalid image file.", "error");
            return;
        }

        if (file.size > JOURNAL_CONFIG.MAX_RAW_IMAGE_SIZE_MB * 1024 * 1024) {
            showToast(`Image too large (Max ${JOURNAL_CONFIG.MAX_RAW_IMAGE_SIZE_MB}MB).`, "error");
            return;
        }

        setIsProcessingOCR(true);

        try {
            if (signal.aborted) return;
            const compressedBlob = await compressImage(file, JOURNAL_CONFIG.OCR_IMAGE_MAX_SIZE, 1024);
            if (signal.aborted) return;
            await handleOCRUploadManual(compressedBlob);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error("OCR Error:", error);
                showToast("Could not read text from image.", "error");
            }
        } finally {
            if (isMountedRef.current) {
                setIsProcessingOCR(false);
            }
        }
    };

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
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
            if (deltaX > 0) {
                if (!isMinDate) navigateDate('prev');
            } else {
                if (!isToday) navigateDate('next');
            }
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

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

            {/* Offline Banner */}
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
                        const dateStr = format(currentDate, 'yyyy-MM-dd');
                        if (isDirtyRef.current && userId && contentDateRef.current === dateStr) {
                            saveEntry(dateStr, content, mediaItems);
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

                <div className="flex items-center justify-between mt-2 px-1">
                    <div className="flex items-center gap-2 transition-opacity opacity-0 group-hover:opacity-100">
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

                    <div className="flex items-center gap-3 transition-opacity opacity-0 group-hover:opacity-100">
                        {aiRewriteEnabled && content.trim().length > 0 && (
                            <button
                                onClick={async () => {
                                    if (isGuest && onGuestAction) {
                                        onGuestAction();
                                        return;
                                    }
                                    if (isRewriting) return;
                                    setIsRewriting(true);
                                    try {
                                        const { performRewrite } = await import("@/utils/ai");
                                        const result = await performRewrite(content);
                                        if (result) {
                                            setContent(result);
                                            showToast("Entry polished with AI", "success");
                                        }
                                    } catch (e: any) {
                                        showToast(e.message || "Rewrite failed", "error");
                                    } finally {
                                        setIsRewriting(false);
                                    }
                                }}
                                disabled={isRewriting}
                                className={cn(
                                    "p-2 rounded-full transition-all",
                                    isRewriting ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 animate-pulse" : "bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:scale-110"
                                )}
                                title="Refine with AI"
                            >
                                {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className={cn("w-4 h-4", accentObj.class)} />}
                            </button>
                        )}

                        <div className="text-xs font-mono">
                            {hasError ? <span className="text-red-500 font-semibold">Failed to save</span> :
                                isRecording ? <span className="flex items-center gap-2 text-red-500 font-semibold animate-pulse"><span className="w-2 h-2 rounded-full bg-red-500" />Recording...</span> :
                                    isLoading ? <span className="flex items-center gap-2 text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />Syncing...</span> :
                                        isOffline ? <span className="text-orange-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Offline (Saved locally)</span> :
                                            pendingSync ? <span className="text-blue-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Syncing...</span> :
                                                isSaving ? <span className="text-zinc-500">Saving...</span> :
                                                    <span className="text-zinc-600">Saved</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Inputs & Action Bar (Now above media for instant access) */}
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

            <div className="flex w-full justify-center gap-10 mt-10 mb-2 select-none">
                {/* Voice Group */}
                <div className="relative" ref={micMenuRef}>
                    <button
                        onClick={handleMicButtonClick}
                        className={cn(
                            "group p-4 rounded-full transition-all duration-300 relative",
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
                            "group p-4 rounded-full transition-all duration-300 disabled:opacity-50 relative",
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
                            <button
                                onClick={handleVideoStart}
                                className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-left"
                            >
                                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                                    <Video className="w-4 h-4 text-purple-500" />
                                </div>
                                <div>
                                    <div className="text-zinc-900 dark:text-zinc-100 text-sm font-semibold">Video</div>
                                    <div className="text-zinc-500 text-[10px]">Upload movie clip</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
                <input
                    type="file"
                    ref={videoFileInputRef}
                    onChange={handleVideoUpload}
                    accept="video/*"
                    className="hidden"
                />
            </div>

            {/* Media Display */}
            {mediaItems.length > 0 && (
                <div className="w-full max-w-2xl mx-auto mt-6 mb-10">
                    {/* Images/Videos Display */}
                    {mediaItems.some(i => i.type === 'image' || i.type === 'video') && (
                        <div className={cn(
                            mediaDisplayMode === 'grid' ? "grid grid-cols-2 gap-3" :
                                mediaDisplayMode === 'swipe' ? "flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 pb-4" :
                                    "flex flex-col gap-6"
                        )}>
                            {mediaItems.map((item, index) => {
                                if (item.type !== 'image' && item.type !== 'video') return null;
                                return (
                                    <div
                                        key={item.url + index}
                                        className={cn(
                                            "relative group rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700",
                                            mediaDisplayMode === 'grid' ? "aspect-video" :
                                                mediaDisplayMode === 'swipe' ? "min-w-[85vw] md:min-w-[400px] aspect-video snap-center" :
                                                    "w-full aspect-video"
                                        )}
                                    >
                                        <MediaItemView item={item} />
                                        <button
                                            onClick={() => removeMedia(index)}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove media"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Audio List (Always a list as it feels most natural) */}
                    <div className="space-y-2 mt-6">
                        {mediaItems.map((item, index) => {
                            if (item.type !== 'audio') return null;
                            return (
                                <div key={item.url + index} className="relative group">
                                    <MediaItemView item={item} accentColor={accentColor} />
                                    <button
                                        onClick={() => removeMedia(index)}
                                        className="absolute top-1/2 -translate-y-1/2 -right-8 p-1.5 text-zinc-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove audio"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}




        </div>
    );
}
