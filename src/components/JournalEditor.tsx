import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Camera, X, Square, AudioLines } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { compressImage } from "@/utils/image";
import { AudioPlayer } from "./AudioPlayer";
import { ACCENT_COLORS } from "@/constants/colors";
import { performOCR } from "@/utils/ai";

interface JournalEditorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    minDate?: Date;
    accentColor?: string;
    isGuest?: boolean;
    onGuestAction?: () => void;
}

export function JournalEditor({
    date,
    onDateChange,
    minDate,
    accentColor = "bg-indigo-500",
    isGuest = false,
    onGuestAction
}: JournalEditorProps) {
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
    const recognitionRef = useRef<any>(null);

    // Voice Note State
    const [audioPath, setAudioPath] = useState<string | null>(null);
    const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Media Menu State
    const [showMicMenu, setShowMicMenu] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);
    const micMenuRef = useRef<HTMLDivElement>(null);
    const cameraMenuRef = useRef<HTMLDivElement>(null);

    // OCR State
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);

    // === BUG FIX REFS ===
    // Prevents data loss on fast navigation - tracks if content needs saving
    const isDirtyRef = useRef(false);
    // Prevents memory leaks - guards async state updates after unmount
    const isMountedRef = useRef(true);
    // Prevents SST duplication - tracks last appended transcript
    const lastAppendedTextRef = useRef("");
    // Recording timer state
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const currentDate = date;

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
        };
    }, []);

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
    }, [userId]);

    const syncPendingData = async () => {
        const pendingRaw = localStorage.getItem('pending_journal_sync');
        if (!pendingRaw || !userId) return;

        setPendingSync(true);
        try {
            const pendingEntries = JSON.parse(pendingRaw) as Record<string, { content: string; image_url?: string; audio_url?: string; updated_at?: string }>;
            const dates = Object.keys(pendingEntries);

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
    };

    // Fetch Entry (OFFLINE-FIRST)
    const fetchEntry = useCallback(async () => {
        if (!userId) return;

        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const cacheKey = `entry_cache_${userId}_${dateStr}`;

        // STEP 1: Load from localStorage cache first (instant)
        const cachedEntry = localStorage.getItem(cacheKey);
        if (cachedEntry) {
            const cached = JSON.parse(cachedEntry);
            setContent(cached.content || "");
            setImagePath(cached.image_url || null);
            setAudioPath(cached.audio_url || null);
        } else {
            // No cache - start fresh
            setContent("");
            setImagePath(null);
            setDisplayUrl(null);
        }
        setIsLoading(true);

        // STEP 2: Try to fetch from server (if online)
        try {
            const { data, error } = await supabase
                .from('entries')
                .select('content, image_url, audio_url, updated_at')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .single();

            if (error && error.code !== 'PGRST116') {
                // Network error or other - we already have cache data
                console.log('Server fetch failed, using cached data');
            } else if (data && isMountedRef.current) {
                // Update cache with server data
                localStorage.setItem(cacheKey, JSON.stringify(data));
                setContent(data.content || "");
                setImagePath(data.image_url || null);
                setAudioPath(data.audio_url || null);
            }
        } catch (error) {
            // Offline - already using cached data
            console.log('Offline mode - using cached entry');
        }

        if (isMountedRef.current) {
            setIsLoading(false);
        }
    }, [currentDate, userId]);

    useEffect(() => {
        fetchEntry();
    }, [fetchEntry]);

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
            const { data } = await supabase.storage
                .from('journal-media-private')
                .createSignedUrl(imagePath, 3600 * 24);

            if (data?.signedUrl && isMountedRef.current && !cancelled) {
                setDisplayUrl(data.signedUrl);
            }
        };
        loadSignedUrl();
        return () => { cancelled = true; };
    }, [imagePath]);

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
                .createSignedUrl(audioPath, 3600 * 24);

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

        // OFFLINE-FIRST: Always update local cache first
        const cacheKey = `entry_cache_${userId}_${dateStr}`;
        const cacheData = {
            content: currentContent,
            image_url: currentImagePath,
            audio_url: currentAudioPath,
            updated_at: new Date().toISOString()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

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
            localStorage.setItem('pending_journal_sync', JSON.stringify(existing));
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

        isDirtyRef.current = true;

        const timeoutId = setTimeout(() => {
            if (isMountedRef.current) setIsSaving(true);
            saveEntry(dateStr, content, imagePath, audioPath);
        }, 1000);

        return () => {
            clearTimeout(timeoutId);
            // CRITICAL: Flush save immediately on cleanup if dirty
            if (isDirtyRef.current && userId) {
                saveEntry(dateStr, content, imagePath, audioPath);
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
    const processFile = async (file: File) => {
        if (!userId) return;

        // MEMORY LEAK: Revoke previous object URL if exists
        if (displayUrl) {
            URL.revokeObjectURL(displayUrl);
        }

        setIsUploading(true);
        const objectUrl = URL.createObjectURL(file);
        setDisplayUrl(objectUrl);

        try {
            const compressedBlob = await compressImage(file);
            const fileName = `${userId}/${Date.now()}-${file.name.split('.')[0]}.webp`;
            const compressedFile = new File([compressedBlob], fileName, { type: 'image/webp' });

            const { error: uploadError } = await supabase.storage
                .from('journal-media-private')
                .upload(fileName, compressedFile);

            if (uploadError) throw uploadError;

            // MEMORY LEAK GUARD: Only update state if still mounted
            if (isMountedRef.current) {
                setImagePath(fileName);
            }

        } catch (error) {
            console.error("Image upload failed:", error);
            if (isMountedRef.current) {
                alert("Failed to upload image.");
                setDisplayUrl(null);
                setImagePath(null);
            }
        } finally {
            if (isMountedRef.current) {
                setIsUploading(false);
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        processFile(e.target.files[0]);
        e.target.value = "";
    };

    const removeImage = async () => {
        if (!userId || !imagePath) return;

        // UX SAFETY: Confirm before deletion
        if (!confirm("Delete this image? This cannot be undone.")) return;

        const pathToDelete = imagePath;
        setImagePath(null);
        setDisplayUrl(null);

        await supabase.storage.from('journal-media-private').remove([pathToDelete]);

        // Force update DB immediately for better UX
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        await supabase.from('entries').update({ image_url: null }).eq('user_id', userId).eq('date', dateStr);
    };

    // --- Audio Logic ---
    const startAudioRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Audio recording not supported.");
            return;
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
                // If none supported, let browser use default
            }

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

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const fileName = `${userId}/audio-${Date.now()}.webm`;

                const { error } = await supabase.storage
                    .from('journal-media-private')
                    .upload(fileName, audioBlob);

                if (error) {
                    console.error("Audio upload failed:", error);
                    // BUG FIX: Make failure visible to user
                    alert("Voice note upload failed. Please check your connection and try again.");
                    if (isMountedRef.current) {
                        setHasError(true);
                    }
                } else {
                    // Optimized: If an audio file already exists, delete it to keep "one voice note" rule clean
                    // We do this AFTER successful upload to prevent data loss if upload fails
                    if (audioPath) {
                        await supabase.storage.from('journal-media-private').remove([audioPath]);
                    }
                    if (isMountedRef.current) {
                        setAudioPath(fileName);
                        setHasError(false);
                    }
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecordingAudio(true);

            // Start recording timer
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                if (isMountedRef.current) {
                    setRecordingDuration(prev => prev + 1);
                }
            }, 1000);
        } catch (error: any) {
            console.error("Error starting audio:", error);
            if (error.name === 'NotAllowedError') {
                alert("Microphone access denied. If you are using the Android app, please ensure Microphone permissions are enabled in the App Settings.");
            } else {
                alert("Could not start microphone: " + error.message);
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

        // UX SAFETY: Confirm before deletion
        if (!confirm("Delete this voice note? This cannot be undone.")) return;

        const pathToDelete = audioPath;
        setAudioPath(null);
        setAudioDisplayUrl(null);
        await supabase.storage.from('journal-media-private').remove([pathToDelete]);

        const dateStr = format(currentDate, 'yyyy-MM-dd');
        await supabase.from('entries').update({ audio_url: null }).eq('user_id', userId).eq('date', dateStr);
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
            if (tier !== "offline") {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) {
                        console.log("No session - using offline STT mode");
                        tier = "offline";
                    }
                } catch (e) {
                    console.log("Auth check failed - using offline STT mode");
                    tier = "offline";
                }
            }

            if (tier === "offline") {
                // === OFFLINE MODE: Web Speech API ===
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    alert("Offline voice recognition not supported on this device.");
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
                recognition.start();

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
                                alert("Session expired. Please sign in again for high-quality transcription, or use offline mode.");
                            } else {
                                alert("Transcription failed. Please try again.");
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
                    alert("Could not access microphone.");
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

    // --- OCR Processing (HYBRID: Online + Offline Fallback) ---
    const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = "";

        // VALIDATION: Supported image types
        const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/bmp'];
        if (!file.type.startsWith('image/')) {
            alert("❌ Please select an image file.\n\nSupported formats: JPG, PNG, GIF, WebP, HEIC, BMP");
            return;
        }
        if (!supportedTypes.includes(file.type) && !file.type.startsWith('image/')) {
            alert(`❌ Unsupported image format: ${file.type}\n\nSupported formats: JPG, PNG, GIF, WebP, HEIC, BMP`);
            return;
        }

        // VALIDATION: Image size limit (50MB max for processing)
        const MAX_IMAGE_SIZE_MB = 50;
        if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
            alert(`❌ Image too large!\n\nYour image: ${(file.size / (1024 * 1024)).toFixed(1)}MB\nMaximum size: ${MAX_IMAGE_SIZE_MB}MB\n\nPlease use a smaller image or compress it first.`);
            return;
        }

        setIsProcessingOCR(true);

        // Check if online for high-quality OCR
        const isOnline = navigator.onLine;

        // RELAXED SECURITY: Trusted ai.ts to handle 401/Refresh
        // We only force offline if there is NO network.
        // If the key is expired, ai.ts will auto-refresh it.

        if (!isOnline) {
            // Show quality notice for offline mode
            alert("📶 Connect to internet for best quality.\n\nUsing offline mode (basic).");
        }

        try {
            let text = "";

            if (isOnline) {
                // ONLINE: Use Groq Vision API (high quality)
                try {
                    const compressedBlob = await compressImage(file);
                    const compressedFile = new File([compressedBlob], file.name, { type: 'image/webp' });
                    text = await performOCR(compressedFile);
                } catch (onlineError: any) {
                    // AUTOMATIC FALLBACK: If online fails for ANY reason, try offline
                    console.warn("Online OCR failed, falling back to offline:", onlineError.message);

                    try {
                        const { extractTextOffline } = await import('@/utils/ocr-offline');
                        text = await extractTextOffline(file);
                        console.log("Offline OCR fallback succeeded");
                    } catch (offlineError) {
                        // Both failed - throw the original online error for better feedback
                        throw onlineError;
                    }
                }
            } else {
                // OFFLINE: Use Tesseract.js (local processing)
                const { extractTextOffline } = await import('@/utils/ocr-offline');
                text = await extractTextOffline(file);
            }

            if (text && isMountedRef.current) {
                setContent(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
                    return prev + (needsSpace ? '\n\n' : '') + text;
                });
            } else if (isMountedRef.current) {
                alert("Could not extract text from this image.");
            }
        } catch (error) {
            console.error("OCR failed:", error);
            if (isMountedRef.current) {
                alert("OCR failed. Please try again.");
            }
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
    }, [userId]);

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
                        <img
                            src={displayUrl}
                            alt="Entry"
                            className="w-full h-auto max-h-[500px] object-contain transition-transform duration-700 hover:scale-[1.02]"
                        />
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
                        onClick={() => {
                            if (isGuest && onGuestAction) {
                                onGuestAction();
                                return;
                            }
                            if (isRecording) { toggleRecording(); return; }
                            if (isRecordingAudio) { stopAudioRecording(); return; }
                            setShowMicMenu(!showMicMenu);
                            setShowCameraMenu(false);
                            triggerHaptic(5);
                        }}
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
                        onClick={() => {
                            if (isGuest && onGuestAction) {
                                onGuestAction();
                                return;
                            }
                            setShowCameraMenu(!showCameraMenu);
                            setShowMicMenu(false);
                            triggerHaptic(5);
                        }}
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
                                    <AudioLines className="w-4 h-4 text-blue-500" />
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
