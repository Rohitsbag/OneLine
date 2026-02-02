import { useRef, useState, useEffect, useCallback } from "react";
import {
    ChevronLeft, ChevronRight, Mic, Camera, Video, X, Square,
    AudioLines, ScanText, Loader2, Trash2, Sparkles, WifiOff
} from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { compressImage } from "@/utils/image";
import { transcribeAudio } from "@/utils/ai";
import { AudioPlayer } from "./AudioPlayer";
import { ACCENT_COLORS } from "@/constants/colors";
import { useToast } from "./Toast";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { MediaItem, canAddMedia } from "@/types/media";
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { OfflineQueue } from "@/utils/offlineQueue";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useCamera } from "@/hooks/useCamera";
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Configuration
const CONFIG = {
    AUTOSAVE_DEBOUNCE_MS: 3000,
    IMAGE_MAX_SIZE_MB: 1.5,
    IMAGE_MAX_DIMENSION: 1500,
    MAX_RECORDING_DURATION_SECONDS: 300,
    VISIBILITY_REFRESH_DEBOUNCE_MS: 60000,
};

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

// Sub-component for rendering media items
const MediaItemView = ({ item, accentColor, onError }: {
    item: MediaItem;
    accentColor?: string;
    onError?: () => void;
}) => {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        const load = async () => {
            // Direct URLs
            if (item.url.startsWith('http') || item.url.startsWith('data:') || item.url.startsWith('blob:')) {
                setUrl(item.url);
                return;
            }

            // Local files
            if (item.url.startsWith('local://')) {
                try {
                    const fileName = item.url.replace('local://', '');
                    const fileData = await Filesystem.readFile({
                        path: fileName,
                        directory: Directory.Data
                    });
                    const mime = item.type === 'image' ? 'image/webp' :
                        item.type === 'audio' ? 'audio/webm' : 'video/mp4';
                    const src = `data:${mime};base64,${fileData.data}`;
                    if (isMounted.current) setUrl(src);
                } catch (e) {
                    console.error("Local file load failed:", e);
                    if (isMounted.current) {
                        setError(true);
                        onError?.();
                    }
                }
                return;
            }

            // Supabase storage paths - get signed URL
            try {
                const { data, error: signError } = await supabase.storage
                    .from('journal-media-private')
                    .createSignedUrl(item.url, 60 * 60 * 24 * 7);

                if (signError || !data?.signedUrl) {
                    throw signError;
                }
                if (isMounted.current) setUrl(data.signedUrl);
            } catch (e) {
                console.error("Signed URL failed:", e);
                if (isMounted.current) setError(true);
            }
        };

        load();
        return () => { isMounted.current = false; };
    }, [item.url, item.type, onError]);

    if (error) {
        return (
            <div className="flex items-center justify-center w-full h-full bg-zinc-100 dark:bg-zinc-800 text-xs text-red-500">
                Failed to load
            </div>
        );
    }

    if (!url) {
        return (
            <div className="flex items-center justify-center w-full h-full bg-zinc-100 dark:bg-zinc-800">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (item.type === 'image') {
        return <img src={url} alt="Media" className="w-full h-full object-cover" />;
    }

    if (item.type === 'video') {
        return (
            <video src={url} controls className="w-full h-full object-cover">
                Your browser doesn't support video playback.
            </video>
        );
    }

    if (item.type === 'audio') {
        return <AudioPlayer src={url} accentColor={accentColor} />;
    }

    return null;
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
    const dateStr = format(date, 'yyyy-MM-dd');

    // ============ INFRASTRUCTURE ============
    const { connected: isOnline } = useNetworkStatus();
    const { userId } = useAuth(isOnline);
    const { showToast } = useToast();
    const { capturePhoto, /* captureVideo, */ isCapturing: isCameraProcessing } = useCamera();
    const voiceRecorder = useVoiceRecorder();

    // ============ ENTRY STATE ============
    const [entryId, setEntryId] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

    // ============ UI STATE ============
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);
    const [showMicMenu, setShowMicMenu] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'local' | 'pending' | 'failed'>('synced');

    // Transcription-specific state (different from voice note recording)
    const [isTranscriptionRecording, setIsTranscriptionRecording] = useState(false);

    // ============ REFS ============
    const contentRef = useRef(content);
    const mediaItemsRef = useRef(mediaItems);
    const isDirtyRef = useRef(false);
    const isMountedRef = useRef(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);
    // const videoFileInputRef = useRef<HTMLInputElement>(null);
    const micMenuRef = useRef<HTMLDivElement>(null);
    const cameraMenuRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Keep refs in sync
    useEffect(() => {
        contentRef.current = content;
        mediaItemsRef.current = mediaItems;
    }, [content, mediaItems]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // ============ HAPTIC FEEDBACK ============
    const triggerHaptic = useCallback(async (style: ImpactStyle = ImpactStyle.Light) => {
        try {
            if (Capacitor.isNativePlatform()) {
                await Haptics.impact({ style });
            } else if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        } catch (e) {
            // Haptics not available
        }
    }, []);

    // ============ DATA LOADING ============
    const fetchEntry = useCallback(async () => {
        if (!userId) return;

        setIsLoading(true);

        // 1. Load from cache first (instant)
        const cached = Storage.getJSONSync<any>(STORAGE_KEYS.ENTRY_CACHE(userId, dateStr));
        if (cached) {
            setContent(cached.content || "");
            setMediaItems(cached.media_items || []);
            setEntryId(cached.id || null);
            setSyncStatus(cached._pending ? 'pending' : 'synced');
        } else {
            setContent("");
            setMediaItems([]);
            setEntryId(null);
        }

        // 2. Fetch from server if online
        if (isOnline) {
            try {
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }
                abortControllerRef.current = new AbortController();

                const { data, error } = await supabase
                    .from('entries')
                    .select('id, content, media_items, updated_at')
                    .eq('user_id', userId)
                    .eq('date', dateStr)
                    .abortSignal(abortControllerRef.current.signal)
                    .maybeSingle();

                if (!error && data && !isDirtyRef.current) {
                    setContent(data.content || "");
                    setMediaItems(data.media_items || []);
                    setEntryId(data.id);
                    setSyncStatus('synced');
                    await Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(userId, dateStr), data);
                }
            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    console.error("Fetch error:", e);
                }
            }
        }

        setIsLoading(false);
    }, [userId, dateStr, isOnline]);

    useEffect(() => {
        fetchEntry();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchEntry, refreshTrigger]);

    // ============ DATA SAVING ============
    const saveEntry = useCallback(async () => {
        if (!userId || !isMountedRef.current) return;

        const currentContent = contentRef.current;
        const currentMedia = mediaItemsRef.current;

        setIsSaving(true);

        try {
            const entryData = {
                id: entryId,
                content: currentContent,
                media_items: currentMedia,
                updated_at: new Date().toISOString(),
                _pending: !isOnline
            };

            // Always save to local cache first
            await Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(userId, dateStr), entryData);

            if (isOnline) {
                // Try to save to server
                if (entryId) {
                    const { error } = await supabase
                        .from('entries')
                        .update({
                            content: currentContent,
                            media_items: currentMedia,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', entryId);

                    if (error) throw error;
                    setSyncStatus('synced');
                } else {
                    const { data, error } = await supabase
                        .from('entries')
                        .upsert({
                            user_id: userId,
                            date: dateStr,
                            content: currentContent,
                            media_items: currentMedia,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id,date' })
                        .select('id')
                        .single();

                    if (error) throw error;
                    if (data?.id) setEntryId(data.id);
                    setSyncStatus('synced');
                }

                // Update cache without pending flag
                await Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(userId, dateStr), {
                    ...entryData,
                    _pending: false
                });
            } else {
                // Queue for later sync
                await OfflineQueue.add(userId, {
                    type: 'upsert_entry',
                    table: 'entries',
                    data: {
                        user_id: userId,
                        date: dateStr,
                        content: currentContent,
                        media_items: currentMedia,
                        updated_at: new Date().toISOString()
                    }
                });
                setSyncStatus('pending');
            }

            isDirtyRef.current = false;
        } catch (e) {
            console.error("Save failed:", e);
            setSyncStatus('failed');

            // Fallback to queue
            await OfflineQueue.add(userId, {
                type: 'upsert_entry',
                table: 'entries',
                data: {
                    user_id: userId,
                    date: dateStr,
                    content: contentRef.current,
                    media_items: mediaItemsRef.current,
                    updated_at: new Date().toISOString()
                }
            });
        } finally {
            if (isMountedRef.current) setIsSaving(false);
        }
    }, [userId, dateStr, entryId, isOnline]);

    // Autosave effect
    useEffect(() => {
        if (isLoading || !userId) return;

        isDirtyRef.current = true;
        setSyncStatus(isOnline ? 'local' : 'pending');

        const timer = setTimeout(() => {
            if (isDirtyRef.current) {
                saveEntry();
            }
        }, CONFIG.AUTOSAVE_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
        };
    }, [content, mediaItems, userId, isLoading, isOnline, saveEntry]);

    // Save on unmount
    useEffect(() => {
        return () => {
            if (isDirtyRef.current && userId) {
                saveEntry();
            }
        };
    }, [userId, saveEntry]);

    // ============ MEDIA HELPERS ============
    const addMedia = useCallback((newItem: MediaItem): boolean => {
        const validation = canAddMedia(mediaItems, newItem.type);
        if (!validation.canAdd) {
            showToast(validation.reason || 'Media limit reached', 'error');
            return false;
        }
        setMediaItems(prev => [...prev, newItem]);
        isDirtyRef.current = true;
        return true;
    }, [mediaItems, showToast]);

    const removeMedia = useCallback(async (index: number) => {
        const item = mediaItems[index];
        if (!item) return;

        // Optimistic remove
        setMediaItems(prev => prev.filter((_, i) => i !== index));
        isDirtyRef.current = true;

        try {
            if (item.url.startsWith('local://')) {
                await Filesystem.deleteFile({
                    path: item.url.replace('local://', ''),
                    directory: Directory.Data
                }).catch(() => { });
            } else if (!item.url.startsWith('http') && !item.url.startsWith('blob:') && !item.url.startsWith('data:')) {
                await supabase.storage
                    .from('journal-media-private')
                    .remove([item.url])
                    .catch(e => console.warn("Remote delete failed:", e));
            }
        } catch (e) {
            console.error("Delete error:", e);
        }
    }, [mediaItems]);

    // ============ IMAGE UPLOAD ============
    const processImageFile = useCallback(async (file: File) => {
        if (!userId) {
            showToast("Please wait for app to load", "warning");
            return;
        }

        if (!file.type.startsWith('image/')) {
            showToast("Invalid image file", "error");
            return;
        }

        setIsUploading(true);

        try {
            const compressedBlob = await compressImage(file, CONFIG.IMAGE_MAX_SIZE_MB, CONFIG.IMAGE_MAX_DIMENSION);
            if (!compressedBlob || compressedBlob.size === 0) {
                throw new Error("Compression failed");
            }

            if (!isOnline) {
                // Save locally for offline (Original Logic)
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(compressedBlob);
                });

                const fileName = `offline-image-${Date.now()}.webp`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });

                const remotePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
                await OfflineQueue.addPendingMedia(userId, {
                    localPath: `local://${fileName}`,
                    remotePath,
                    type: 'image',
                    entryDate: dateStr
                });

                addMedia({ type: 'image', url: `local://${fileName}` });
                showToast("Image saved locally - will sync when online", "success");

            } else {
                // TRY ONLINE UPLOAD WITH FALLBACK
                try {
                    const uuid = crypto.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
                    const fileName = `${userId}/${Date.now()}-${uuid}.webp`;

                    const { error } = await supabase.storage
                        .from('journal-media-private')
                        .upload(fileName, compressedBlob);

                    if (error) throw error;

                    addMedia({ type: 'image', url: fileName });
                    showToast("Image uploaded", "success");
                } catch (uploadError) {
                    console.warn("Online upload failed, falling back to offline save:", uploadError);

                    // FALLBACK LOGIC (Duplicate of offline block)
                    const reader = new FileReader();
                    const base64Data = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(compressedBlob);
                    });

                    const fileName = `offline-image-${Date.now()}.webp`;
                    await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data.split(',')[1],
                        directory: Directory.Data
                    });

                    const remotePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
                    await OfflineQueue.addPendingMedia(userId, {
                        localPath: `local://${fileName}`,
                        remotePath,
                        type: 'image',
                        entryDate: dateStr
                    });

                    addMedia({ type: 'image', url: `local://${fileName}` });
                    showToast("Saved offline (Upload failed)", "success");
                }
            }
        } catch (e: any) {
            console.error("Image upload failed:", e);
            showToast("Upload failed: " + e.message, "error");
        } finally {
            setIsUploading(false);
        }
    }, [userId, dateStr, isOnline, addMedia, showToast]);

    // ============ VIDEO UPLOAD (Disabled) ============
    /*
    const processVideoFile = useCallback(async (file: File) => {
        if (!userId) return;

        setIsUploading(true);

        try {
            if (!isOnline) {
                // Save locally
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const ext = file.name.split('.').pop() || 'mp4';
                const fileName = `offline-video-${Date.now()}.${ext}`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });

                const remotePath = `${userId}/video-${Date.now()}.${ext}`;
                await OfflineQueue.addPendingMedia(userId, {
                    localPath: `local://${fileName}`,
                    remotePath,
                    type: 'video',
                    entryDate: dateStr
                });

                addMedia({ type: 'video', url: `local://${fileName}` });
                showToast("Video saved locally", "success");
            } else {
                const ext = file.name.split('.').pop() || 'mp4';
                const fileName = `${userId}/video-${Date.now()}.${ext}`;

                const { error } = await supabase.storage
                    .from('journal-media-private')
                    .upload(fileName, file);

                if (error) throw error;

                addMedia({ type: 'video', url: fileName });
                showToast("Video uploaded", "success");
            }
        } catch (e: any) {
            console.error("Video upload failed:", e);
            showToast("Video upload failed", "error");
        } finally {
            setIsUploading(false);
        }
    }, [userId, dateStr, isOnline, addMedia, showToast]);
    */

    // ============ AUDIO HANDLING ============
    const handleVoiceNoteComplete = useCallback(async (audioBlob: Blob, duration: number) => {
        if (!userId) return;

        try {
            const ext = audioBlob.type.includes('mp4') ? 'mp4' :
                audioBlob.type.includes('ogg') ? 'ogg' : 'webm';

            if (!isOnline) {
                // Save locally (Original Logic)
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(audioBlob);
                });

                const fileName = `offline-audio-${Date.now()}.${ext}`;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data.split(',')[1],
                    directory: Directory.Data
                });

                const remotePath = `${userId}/audio-${Date.now()}.${ext}`;
                await OfflineQueue.addPendingMedia(userId, {
                    localPath: `local://${fileName}`,
                    remotePath,
                    type: 'audio',
                    entryDate: dateStr
                });

                addMedia({
                    type: 'audio',
                    url: `local://${fileName}`,
                    duration_seconds: duration
                });
                showToast("Voice note saved locally", "success");

            } else {
                // TRY ONLINE UPLOAD WITH FALLBACK
                const fileName = `${userId}/audio-${Date.now()}.${ext}`;

                try {
                    const { error } = await supabase.storage
                        .from('journal-media-private')
                        .upload(fileName, audioBlob);

                    if (error) throw error;

                    addMedia({
                        type: 'audio',
                        url: fileName,
                        duration_seconds: duration
                    });
                    showToast("Voice note saved", "success");
                } catch (uploadError) {
                    console.warn("Voice upload failed, falling back to offline save:", uploadError);

                    // FALLBACK LOGIC
                    const reader = new FileReader();
                    const base64Data = await new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(audioBlob);
                    });

                    const localFileName = `offline-audio-${Date.now()}.${ext}`;
                    await Filesystem.writeFile({
                        path: localFileName,
                        data: base64Data.split(',')[1],
                        directory: Directory.Data
                    });

                    const remotePath = `${userId}/audio-${Date.now()}.${ext}`;
                    await OfflineQueue.addPendingMedia(userId, {
                        localPath: `local://${localFileName}`,
                        remotePath,
                        type: 'audio',
                        entryDate: dateStr
                    });

                    addMedia({
                        type: 'audio',
                        url: `local://${localFileName}`,
                        duration_seconds: duration
                    });
                    showToast("Saved offline (Upload failed)", "success");
                }
            }
        } catch (e: any) {
            console.error("Voice note save failed:", e);
            showToast("Failed to save voice note", "error");
        }
    }, [userId, dateStr, isOnline, addMedia, showToast]);

    // ============ TRANSCRIPTION ============
    const startTranscription = useCallback(async () => {
        if (!isOnline) {
            showToast("Internet required for transcription", "warning");
            return;
        }

        try {
            await voiceRecorder.start();
            setIsTranscriptionRecording(true);
            triggerHaptic(ImpactStyle.Medium);
        } catch (e) {
            showToast("Could not start microphone", "error");
        }
    }, [isOnline, voiceRecorder, showToast, triggerHaptic]);

    const stopTranscription = useCallback(async () => {
        setIsTranscriptionRecording(false);
        setIsTranscribing(true);

        try {
            const audioBlob = await voiceRecorder.stop();

            if (!audioBlob) {
                showToast("No audio recorded", "warning");
                setIsTranscribing(false);
                return;
            }

            // Try transcription with fallback
            let result: string | null = null;

            try {
                result = await transcribeAudio(audioBlob, "whisper-large-v3", sttLanguage);
            } catch (e) {
                console.warn("Primary transcription failed, trying fallback");
                try {
                    result = await transcribeAudio(audioBlob, "whisper-large-v3-turbo", sttLanguage);
                } catch (e2) {
                    console.error("All transcription attempts failed");
                }
            }

            if (result?.trim()) {
                setContent(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
                    return prev + (needsSpace ? ' ' : '') + result.trim();
                });
                showToast("Transcription complete", "success");
            } else {
                showToast("Could not transcribe audio", "error");
            }
        } catch (e: any) {
            console.error("Transcription error:", e);
            showToast("Transcription failed", "error");
        } finally {
            setIsTranscribing(false);
        }
    }, [voiceRecorder, sttLanguage, showToast]);

    // ============ VOICE NOTE (non-transcription) ============
    const startVoiceNote = useCallback(async () => {
        try {
            await voiceRecorder.start();
            triggerHaptic(ImpactStyle.Medium);
        } catch (e) {
            showToast("Could not start microphone", "error");
        }
    }, [voiceRecorder, showToast, triggerHaptic]);

    const stopVoiceNote = useCallback(async () => {
        try {
            const audioBlob = await voiceRecorder.stop();
            if (audioBlob) {
                await handleVoiceNoteComplete(audioBlob, voiceRecorder.duration);
            }
        } catch (e) {
            showToast("Failed to save voice note", "error");
        }
    }, [voiceRecorder, handleVoiceNoteComplete, showToast]);

    // ============ OCR ============
    const handleOCR = useCallback(async (file: File) => {
        // OFFLINE-CAPABLE: Tesseract runs locally, so we remove the online check.
        // if (!isOnline) { ... }

        setIsProcessingOCR(true);

        try {
            const compressedBlob = await compressImage(file, 1, 1024);
            const { performOCR } = await import("@/utils/ai");
            const ocrFile = new File([compressedBlob], "ocr.webp", { type: compressedBlob.type });
            const result = await performOCR(ocrFile);

            if (result) {
                setContent(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
                    return prev + (needsSpace ? ' ' : '') + result;
                });
                showToast("Text extracted", "success");
            }
        } catch (e: any) {
            console.error("OCR failed:", e);
            showToast("Could not extract text", "error");
        } finally {
            setIsProcessingOCR(false);
        }
    }, [isOnline, showToast]);

    // ============ NATIVE CAMERA ============
    const handleNativePhoto = useCallback(async () => {
        setShowCameraMenu(false);
        const result = await capturePhoto();
        if (result) {
            const file = new File([result.blob], "photo.jpg", { type: result.blob.type });
            await processImageFile(file);
        }
    }, [capturePhoto, processImageFile]);

    const handleNativeOCR = useCallback(async () => {
        setShowCameraMenu(false);

        if (!isOnline) {
            showToast("Internet required for text recognition", "warning");
            return;
        }

        const result = await capturePhoto();
        if (result) {
            const file = new File([result.blob], "ocr.jpg", { type: result.blob.type });
            await handleOCR(file);
        }
    }, [capturePhoto, handleOCR, isOnline, showToast]);

    // ============ BUTTON HANDLERS ============
    const handleMicButtonClick = useCallback(() => {
        if (isGuest && onGuestAction) {
            onGuestAction();
            return;
        }

        // If currently recording transcription, stop it
        if (isTranscriptionRecording) {
            stopTranscription();
            return;
        }

        // If currently recording voice note, stop it
        if (voiceRecorder.isRecording && !isTranscriptionRecording) {
            stopVoiceNote();
            return;
        }

        // Otherwise show menu
        setShowMicMenu(prev => !prev);
        setShowCameraMenu(false);
        triggerHaptic();
    }, [
        isGuest, onGuestAction, isTranscriptionRecording,
        voiceRecorder.isRecording, stopTranscription, stopVoiceNote, triggerHaptic
    ]);

    const handleCameraButtonClick = useCallback(() => {
        if (isGuest && onGuestAction) {
            onGuestAction();
            return;
        }
        setShowCameraMenu(prev => !prev);
        setShowMicMenu(false);
        triggerHaptic();
    }, [isGuest, onGuestAction, triggerHaptic]);

    // ============ FILE INPUT HANDLERS ============
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        processImageFile(e.target.files[0]);
        e.target.value = "";
    };

    const handleOCRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        handleOCR(e.target.files[0]);
        e.target.value = "";
    };

    /*
    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        processVideoFile(e.target.files[0]);
        e.target.value = "";
    };
    */

    // ============ NAVIGATION ============
    const navigateDate = useCallback((direction: 'prev' | 'next') => {
        // Force save before navigating
        if (isDirtyRef.current && userId) {
            saveEntry();
        }
        const newDate = direction === 'prev' ? subDays(date, 1) : addDays(date, 1);
        onDateChange(newDate);
    }, [date, onDateChange, userId, saveEntry]);

    const isToday = isSameDay(date, new Date());
    const isMinDate = minDate && isSameDay(date, minDate);

    // ============ TEXTAREA AUTO-RESIZE ============
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [content, adjustTextareaHeight]);

    // ============ DRAG & DROP ============
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
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith('image/')) {
            processImageFile(file);
        }
    }, [processImageFile]);

    // ============ CLOSE MENUS ON OUTSIDE CLICK ============
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (micMenuRef.current && !micMenuRef.current.contains(e.target as Node)) {
                setShowMicMenu(false);
            }
            if (cameraMenuRef.current && !cameraMenuRef.current.contains(e.target as Node)) {
                setShowCameraMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ============ ACCENT COLOR ============
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverClass = (accentObj as any).hoverTextClass || "group-hover:text-white";

    // ============ RENDER ============
    return (
        <div className="flex flex-col flex-1 max-w-2xl w-full mx-auto mt-12 mb-8 items-center px-4">
            {/* Date Navigation Header */}
            <div className="flex items-center gap-6 mb-12">
                <button
                    onClick={() => navigateDate('prev')}
                    disabled={!!isMinDate}
                    className={cn(
                        "group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all",
                        isMinDate && "opacity-20 cursor-not-allowed"
                    )}
                >
                    <ChevronLeft className={cn("w-5 h-5 text-zinc-500", !isMinDate && hoverClass)} />
                </button>

                <div className="flex flex-col items-center gap-1">
                    <h2 className="text-2xl font-light text-zinc-900 dark:text-white select-none">
                        {isToday ? "Today" : format(date, "MMMM d, yyyy")}
                    </h2>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        {!isOnline && <WifiOff className="w-3 h-3" />}
                        {syncStatus === 'synced' && <span>✓ Synced</span>}
                        {syncStatus === 'local' && <span>○ Saved locally</span>}
                        {syncStatus === 'pending' && <span className="text-amber-500">◐ Pending sync</span>}
                        {syncStatus === 'failed' && <span className="text-red-500">✗ Sync failed</span>}
                    </div>
                </div>

                <button
                    onClick={() => navigateDate('next')}
                    disabled={isToday}
                    className={cn(
                        "group p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all",
                        isToday && "opacity-0 pointer-events-none"
                    )}
                >
                    <ChevronRight className={cn("w-5 h-5 text-zinc-500", !isToday && hoverClass)} />
                </button>
            </div>

            {/* Offline Banner */}
            {!isOnline && (
                <div className="w-full mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-center text-xs text-amber-700 dark:text-amber-400">
                    📡 You're offline. Changes will sync when connected.
                </div>
            )}

            {/* Text Editor */}
            <div
                className={cn(
                    "w-full relative rounded-xl transition-all",
                    isDragging && "bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-300"
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
                    }}
                    onFocus={() => {
                        if (isGuest && onGuestAction) {
                            textareaRef.current?.blur();
                            onGuestAction();
                        }
                    }}
                    placeholder={isDragging ? "Drop image here..." : "One line for today..."}
                    className="w-full bg-transparent text-xl md:text-2xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none outline-none min-h-[150px] text-left md:text-center font-light leading-relaxed p-4"
                    spellCheck={false}
                />

                {/* Status indicator */}
                <div className="flex justify-end px-4 pb-2">
                    <span className="text-xs text-zinc-400">
                        {isLoading ? "Loading..." :
                            isSaving ? "Saving..." :
                                voiceRecorder.isRecording ? `Recording ${Math.floor(voiceRecorder.duration / 60)}:${(voiceRecorder.duration % 60).toString().padStart(2, '0')}` :
                                    isTranscribing ? "Transcribing..." :
                                        ""}
                    </span>
                </div>
            </div>

            {/* Hidden File Inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
            />
            <input
                ref={ocrFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleOCRUpload}
                className="hidden"
            />
            {/* 
            <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
            />
            */}

            {/* Action Buttons */}
            <div className="flex w-full justify-center gap-10 mt-10 mb-4">
                {/* Microphone Button */}
                <div className="relative" ref={micMenuRef}>
                    <button
                        onClick={handleMicButtonClick}
                        disabled={isTranscribing || isProcessingOCR}
                        className={cn(
                            "group p-4 rounded-full transition-all duration-300",
                            isTranscriptionRecording || voiceRecorder.isRecording
                                ? "bg-red-500 scale-110 shadow-lg shadow-red-500/30"
                                : showMicMenu
                                    ? "bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-200 dark:ring-zinc-700"
                                    : "hover:bg-black/5 dark:hover:bg-white/10"
                        )}
                    >
                        {voiceRecorder.isRecording || isTranscriptionRecording ? (
                            <div className="flex items-center gap-2">
                                <Square className="w-5 h-5 text-white fill-current" />
                                <span className="text-white text-xs font-mono">
                                    {Math.floor(voiceRecorder.duration / 60)}:{(voiceRecorder.duration % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                        ) : isTranscribing ? (
                            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                        ) : (
                            <Mic className={cn("w-6 h-6 text-zinc-600", hoverClass)} />
                        )}
                    </button>

                    {/* Microphone Menu */}
                    {showMicMenu && !voiceRecorder.isRecording && !isTranscriptionRecording && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl min-w-[160px] z-50">
                            <button
                                onClick={() => {
                                    setShowMicMenu(false);
                                    startTranscription();
                                }}
                                disabled={!isOnline}
                                className="flex items-center gap-3 p-3 w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center">
                                    <Mic className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">Transcribe</div>
                                    <div className="text-[10px] text-zinc-500">
                                        {isOnline ? "Speech to text" : "Requires internet"}
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setShowMicMenu(false);
                                    startVoiceNote();
                                }}
                                className="flex items-center gap-3 p-3 w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/20 flex items-center justify-center">
                                    <AudioLines className="w-4 h-4 text-red-500" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">Voice Note</div>
                                    <div className="text-[10px] text-zinc-500">
                                        {isOnline ? "Save audio" : "Works offline"}
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Camera Button */}
                <div className="relative" ref={cameraMenuRef}>
                    <button
                        onClick={handleCameraButtonClick}
                        disabled={isUploading || isProcessingOCR || isCameraProcessing}
                        className={cn(
                            "group p-4 rounded-full transition-all duration-300",
                            isProcessingOCR || isCameraProcessing
                                ? "bg-blue-500/20"
                                : showCameraMenu
                                    ? "bg-zinc-100 dark:bg-zinc-800 ring-2 ring-zinc-200 dark:ring-zinc-700"
                                    : "hover:bg-black/5 dark:hover:bg-white/10"
                        )}
                    >
                        {isProcessingOCR || isCameraProcessing || isUploading ? (
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        ) : (
                            <Camera className={cn("w-6 h-6 text-zinc-600", hoverClass)} />
                        )}
                    </button>

                    {/* Camera Menu */}
                    {showCameraMenu && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl min-w-[160px] z-50">
                            <button
                                onClick={() => {
                                    setShowCameraMenu(false);
                                    if (Capacitor.isNativePlatform()) {
                                        handleNativePhoto();
                                    } else {
                                        fileInputRef.current?.click();
                                    }
                                }}
                                className="flex items-center gap-3 p-3 w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/20 flex items-center justify-center">
                                    <Camera className="w-4 h-4 text-orange-500" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">Photo</div>
                                    <div className="text-[10px] text-zinc-500">
                                        {isOnline ? "Capture & upload" : "Save locally"}
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setShowCameraMenu(false);
                                    if (Capacitor.isNativePlatform()) {
                                        handleNativeOCR();
                                    } else {
                                        ocrFileInputRef.current?.click();
                                    }
                                }}
                                disabled={!isOnline}
                                className="flex items-center gap-3 p-3 w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center">
                                    <ScanText className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">Scan Text</div>
                                    <div className="text-[10px] text-zinc-500">
                                        {isOnline ? "Extract text (OCR)" : "Requires internet"}
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    setShowCameraMenu(false);
                                    showToast("Video support coming soon", "info");
                                    // Video feature disabled for now - uncomment to enable
                                    /*
                                    if (Capacitor.isNativePlatform()) {
                                        const result = await captureVideo();
                                        if (result?.blob) {
                                            const file = new File([result.blob], `video.${result.format}`, { type: `video/${result.format}` });
                                            await processVideoFile(file);
                                        }
                                    } else {
                                        videoFileInputRef.current?.click();
                                    }
                                    */
                                }}
                                className="flex items-center gap-3 p-3 w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/20 flex items-center justify-center opacity-50">
                                    <Video className="w-4 h-4 text-purple-500" />
                                </div>
                                <div className="text-left opacity-50">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">Video</div>
                                    <div className="text-[10px] text-zinc-500">
                                        Coming soon
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Rewrite Button */}
            {aiRewriteEnabled && content.trim().length > 20 && isOnline && (
                <button
                    onClick={async () => {
                        if (isRewriting) return;
                        setIsRewriting(true);
                        try {
                            const { performRewrite } = await import("@/utils/ai");
                            const result = await performRewrite(content);
                            if (result) {
                                setContent(result);
                                showToast("Entry polished", "success");
                            }
                        } catch (e: any) {
                            showToast(e.message || "Rewrite failed", "error");
                        } finally {
                            setIsRewriting(false);
                        }
                    }}
                    disabled={isRewriting}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all",
                        isRewriting
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                            : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    )}
                >
                    {isRewriting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className={cn("w-4 h-4", accentObj.class)} />
                    )}
                    <span>{isRewriting ? "Refining..." : "Polish with AI"}</span>
                </button>
            )}

            {/* Media Display */}
            {mediaItems.length > 0 && (
                <div className="w-full mt-8">
                    {/* Images & Videos */}
                    {mediaItems.filter(i => i.type === 'image' || i.type === 'video').length > 0 && (
                        <div className={cn(
                            mediaDisplayMode === 'grid' ? "grid grid-cols-2 gap-3" :
                                mediaDisplayMode === 'swipe' ? "flex overflow-x-auto snap-x gap-4 pb-4" :
                                    "flex flex-col gap-4"
                        )}>
                            {mediaItems.map((item, index) => {
                                if (item.type !== 'image' && item.type !== 'video') return null;
                                return (
                                    <div
                                        key={`${item.url}-${index}`}
                                        className={cn(
                                            "relative group rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800",
                                            mediaDisplayMode === 'grid' ? "aspect-video" :
                                                mediaDisplayMode === 'swipe' ? "min-w-[80vw] aspect-video snap-center" :
                                                    "w-full aspect-video"
                                        )}
                                    >
                                        <MediaItemView item={item} />
                                        <button
                                            onClick={() => removeMedia(index)}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        {item.url.startsWith('local://') && (
                                            <div className="absolute bottom-2 left-2 px-2 py-1 bg-amber-500/80 rounded text-[10px] text-white">
                                                Pending upload
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Audio Items */}
                    <div className="space-y-3 mt-4">
                        {mediaItems.map((item, index) => {
                            if (item.type !== 'audio') return null;
                            return (
                                <div key={`${item.url}-${index}`} className="relative group">
                                    <MediaItemView item={item} accentColor={accentColor} />
                                    <button
                                        onClick={() => removeMedia(index)}
                                        className="absolute top-1/2 -translate-y-1/2 -right-10 p-1.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {item.url.startsWith('local://') && (
                                        <span className="text-[10px] text-amber-500 ml-2">• Pending upload</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
