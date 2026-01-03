import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Mic, Camera, X, Square, AudioLines } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { compressImage } from "@/utils/image";
import { AudioPlayer } from "./AudioPlayer";
import { ACCENT_COLORS } from "@/constants/colors";
import { extractTextFromImage } from "@/utils/ocr";

interface JournalEditorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    minDate?: Date;
    accentColor?: string;
}

export function JournalEditor({ date, onDateChange, minDate, accentColor = "bg-indigo-500" }: JournalEditorProps) {
    const [content, setContent] = useState("");
    const [imagePath, setImagePath] = useState<string | null>(null);
    const [displayUrl, setDisplayUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hasError, setHasError] = useState(false);

    const [userId, setUserId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // Voice Note State
    const [audioPath, setAudioPath] = useState<string | null>(null);
    const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressRef = useRef(false);

    // OCR State
    const [isOCRMode, setIsOCRMode] = useState(false);
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const ocrFileInputRef = useRef<HTMLInputElement>(null);
    const cameraLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isCameraLongPressRef = useRef(false);

    const currentDate = date;

    // Auth & Initial Fetch
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
            }
        };
        checkUser();
    }, []);

    // Cleanup: Stop any active recordings on unmount
    useEffect(() => {
        return () => {
            // Stop SpeechRecognition if active
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
            // Stop MediaRecorder if active
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // Fetch Entry
    const fetchEntry = useCallback(async () => {
        if (!userId) return;

        setContent("");
        setImagePath(null);
        setDisplayUrl(null);

        setIsLoading(true);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        const { data, error } = await supabase
            .from('entries')
            .select('content, image_url, audio_url')
            .eq('user_id', userId)
            .eq('date', dateStr)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching entry:', error);
        }

        setContent(data?.content || "");
        setImagePath(data?.image_url || null);
        setAudioPath(data?.audio_url || null);
        setIsLoading(false);
    }, [currentDate, userId]);

    useEffect(() => {
        fetchEntry();
    }, [fetchEntry]);

    // Image Signed URL
    useEffect(() => {
        const loadSignedUrl = async () => {
            if (!imagePath) {
                setDisplayUrl(null);
                return;
            }
            if (imagePath.startsWith('http')) {
                setDisplayUrl(imagePath);
                return;
            }
            const { data } = await supabase.storage
                .from('journal-media-private')
                .createSignedUrl(imagePath, 3600 * 24);

            if (data?.signedUrl) {
                setDisplayUrl(data.signedUrl);
            }
        };
        loadSignedUrl();
    }, [imagePath]);

    // Audio Signed URL
    useEffect(() => {
        const loadAudioUrl = async () => {
            if (!audioPath) {
                setAudioDisplayUrl(null);
                return;
            }
            if (audioPath.startsWith('http')) {
                setAudioDisplayUrl(audioPath);
                return;
            }
            const { data } = await supabase.storage
                .from('journal-media-private')
                .createSignedUrl(audioPath, 3600 * 24);

            if (data?.signedUrl) {
                setAudioDisplayUrl(data.signedUrl);
            }
        };
        loadAudioUrl();
    }, [audioPath]);

    // Save Entry (Debounced)
    useEffect(() => {
        if (!userId || isLoading) return;
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            const { error } = await supabase
                .from('entries')
                .upsert({
                    user_id: userId,
                    date: dateStr,
                    content: content,
                    image_url: imagePath,
                    audio_url: audioPath,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, date' });

            if (error) {
                console.error('Error saving:', error);
                setHasError(true);
            } else {
                setHasError(false);
            }
            setIsSaving(false);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [content, imagePath, audioPath, currentDate, userId, isLoading]);

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
            setImagePath(fileName);

        } catch (error) {
            console.error("Image upload failed:", error);
            alert("Failed to upload image.");
            setDisplayUrl(null);
            setImagePath(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        processFile(e.target.files[0]);
        e.target.value = "";
    };

    const removeImage = async () => {
        if (!userId || !imagePath) return;
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
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const fileName = `${userId}/audio-${Date.now()}.webm`;

                const { error } = await supabase.storage
                    .from('journal-media-private')
                    .upload(fileName, audioBlob);

                if (error) {
                    console.error("Audio upload failed:", error);
                } else {
                    // Optimized: If an audio file already exists, delete it to keep "one voice note" rule clean
                    // We do this AFTER successful upload to prevent data loss if upload fails
                    if (audioPath) {
                        await supabase.storage.from('journal-media-private').remove([audioPath]);
                    }
                    setAudioPath(fileName);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecordingAudio(true);
        } catch (error) {
            console.error("Error starting audio:", error);
        }
    };

    const stopAudioRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecordingAudio(false);
    };

    const removeAudio = async () => {
        if (!userId || !audioPath) return;
        const pathToDelete = audioPath;
        setAudioPath(null);
        setAudioDisplayUrl(null);
        await supabase.storage.from('journal-media-private').remove([pathToDelete]);

        const dateStr = format(currentDate, 'yyyy-MM-dd');
        await supabase.from('entries').update({ audio_url: null }).eq('user_id', userId).eq('date', dateStr);
    };

    // --- STT Logic ---
    const toggleRecording = () => {
        if (isRecording) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Voice recognition not supported.");
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => setIsRecording(true);
            recognition.onend = () => {
                setIsRecording(false);
                // Clear the ref when recognition ends naturally
                recognitionRef.current = null;
            };
            recognition.onerror = (e: any) => {
                console.warn('Speech recognition error:', e.error);
                setIsRecording(false);
                recognitionRef.current = null;
            };

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setContent(prev => {
                        const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                        return prev + (needsSpace ? ' ' : '') + finalTranscript;
                    });
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        }
    };

    // --- Interaction Handlers ---
    const handleMicDown = (e: React.PointerEvent) => {
        e.preventDefault();
        isLongPressRef.current = false;

        if (isRecording) {
            toggleRecording();
            return;
        }

        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            startAudioRecording();
        }, 300);
    };

    const handleMicUp = (e: React.PointerEvent) => {
        e.preventDefault();

        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (isLongPressRef.current) {
            stopAudioRecording();
            isLongPressRef.current = false;
        } else {
            if (!isRecording) {
                toggleRecording();
            }
        }
    };

    // --- Camera Interaction Handlers (Tap = Image, Hold = OCR) ---
    const handleCameraDown = (e: React.PointerEvent) => {
        e.preventDefault();
        isCameraLongPressRef.current = false;

        cameraLongPressTimerRef.current = setTimeout(() => {
            isCameraLongPressRef.current = true;
            setIsOCRMode(true);
            ocrFileInputRef.current?.click();
        }, 300);
    };

    const handleCameraUp = (e: React.PointerEvent) => {
        e.preventDefault();

        if (cameraLongPressTimerRef.current) {
            clearTimeout(cameraLongPressTimerRef.current);
            cameraLongPressTimerRef.current = null;
        }

        if (!isCameraLongPressRef.current && !isOCRMode) {
            // Short tap - regular image attach
            fileInputRef.current?.click();
        }
        isCameraLongPressRef.current = false;
    };

    // --- OCR Processing ---
    const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = "";
        setIsOCRMode(false);

        if (!file.type.startsWith('image/')) {
            alert("Please select an image file.");
            return;
        }

        setIsProcessingOCR(true);
        try {
            const result = await extractTextFromImage(file);
            if (result.success && result.text) {
                // Append extracted text to content
                setContent(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
                    return prev + (needsSpace ? '\n\n' : '') + result.text;
                });
            } else {
                alert("Could not extract text from this image.");
            }
        } catch (error) {
            console.error("OCR failed:", error);
            alert("OCR failed. Please try again.");
        } finally {
            setIsProcessingOCR(false);
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

    const navigateDate = (direction: 'prev' | 'next') => {
        const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
        onDateChange(newDate);
    };

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
                        setContent(e.target.value);
                        adjustTextareaHeight();
                    }}
                    placeholder={isDragging ? "Drop image here..." : "One line for today..."}
                    className="w-full bg-transparent text-xl md:text-2xl text-[#18181b] dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none outline-none min-h-[150px] text-left md:text-center font-light leading-relaxed scrollbar-hide p-6 md:p-4 overflow-hidden"
                    spellCheck={false}
                />

                <div className="absolute bottom-[-30px] right-0 text-xs font-mono transition-opacity opacity-0 group-hover:opacity-100 flex items-center gap-2">
                    {hasError ? <span className="text-red-500 font-semibold">Failed to save</span> :
                        isRecording ? <span className="flex items-center gap-2 text-red-500 font-semibold animate-pulse"><span className="w-2 h-2 rounded-full bg-red-500" />Recording...</span> :
                            isLoading ? <span className="flex items-center gap-2 text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />Syncing...</span> :
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
                className="hidden"
            />

            {/* Action Bar */}
            <div className="flex w-full justify-center gap-6 mt-4 select-none">
                <button
                    onPointerDown={handleMicDown}
                    onPointerUp={handleMicUp}
                    onPointerLeave={(e) => {
                        if (isLongPressRef.current) handleMicUp(e);
                        else if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    className={cn(
                        "group p-3 rounded-full transition-all relative",
                        isRecording ? "bg-zinc-200 dark:bg-zinc-800 ring-2 ring-zinc-300 dark:ring-zinc-700" :
                            isRecordingAudio ? "bg-red-500/20 ring-2 ring-red-500 scale-110" :
                                "hover:bg-black/5 dark:hover:bg-white/10"
                    )}
                >
                    {isRecordingAudio ? (
                        <div className="flex items-center gap-1">
                            <AudioLines className="w-5 h-5 text-red-500 animate-pulse" />
                        </div>
                    ) : isRecording ? (
                        <Square className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    ) : (
                        <Mic className={cn("w-5 h-5 text-zinc-600 transition-colors", hoverClass)} />
                    )}

                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Tap to Type • Hold to Record
                    </span>
                </button>
                <button
                    onPointerDown={handleCameraDown}
                    onPointerUp={handleCameraUp}
                    onPointerLeave={(e) => {
                        if (cameraLongPressTimerRef.current) {
                            clearTimeout(cameraLongPressTimerRef.current);
                            cameraLongPressTimerRef.current = null;
                        }
                        isCameraLongPressRef.current = false;
                    }}
                    disabled={isUploading || isProcessingOCR}
                    className={cn(
                        "group p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed relative",
                        isProcessingOCR ? "bg-blue-500/20 ring-2 ring-blue-500" : "hover:bg-black/5 dark:hover:bg-white/10"
                    )}
                >
                    {isProcessingOCR ? (
                        <Camera className="w-5 h-5 text-blue-500 animate-pulse" />
                    ) : (
                        <Camera className={cn("w-5 h-5 text-zinc-600 transition-colors", hoverClass)} />
                    )}

                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                        Tap to Attach • Hold to Scan
                    </span>
                </button>
            </div>
        </div>
    );
}
