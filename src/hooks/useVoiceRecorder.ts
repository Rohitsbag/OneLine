import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import * as nativeMedia from '@/utils/native-media';

interface RecorderState {
    isRecording: boolean;
    duration: number;
    error: string | null;
}

export function useVoiceRecorder() {
    const [state, setState] = useState<RecorderState>({
        isRecording: false,
        duration: 0,
        error: null
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const mimeTypeRef = useRef<string>('audio/webm');
    const resolveStopRef = useRef<((blob: Blob) => void) | null>(null);

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
    }, []);

    const start = useCallback(async (): Promise<void> => {
        setState({ isRecording: false, duration: 0, error: null });

        // Native platform
        if (Capacitor.isNativePlatform() && nativeMedia.isNative()) {
            try {
                const hasPermission = await nativeMedia.nativeVoice.requestPermission();
                if (!hasPermission) {
                    setState(s => ({ ...s, error: 'Microphone permission denied' }));
                    return;
                }
                await nativeMedia.nativeVoice.start();
                setState({ isRecording: true, duration: 0, error: null });

                timerRef.current = setInterval(() => {
                    setState(s => ({ ...s, duration: s.duration + 1 }));
                }, 1000);
                return;
            } catch (e: any) {
                setState(s => ({ ...s, error: e.message || 'Failed to start recording' }));
                return;
            }
        }

        // Web platform
        if (!navigator.mediaDevices?.getUserMedia) {
            setState(s => ({ ...s, error: 'Audio recording not supported' }));
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            streamRef.current = stream;

            // Detect supported mime type
            let mimeType = 'audio/webm';
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    mimeType = 'audio/ogg';
                }
            }
            mimeTypeRef.current = mimeType;

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
                if (resolveStopRef.current) {
                    resolveStopRef.current(blob);
                    resolveStopRef.current = null;
                }
                cleanup();
                setState({ isRecording: false, duration: 0, error: null });
            };

            recorder.start(100);
            setState({ isRecording: true, duration: 0, error: null });

            timerRef.current = setInterval(() => {
                setState(s => ({ ...s, duration: s.duration + 1 }));
            }, 1000);

        } catch (e: any) {
            cleanup();
            setState({ isRecording: false, duration: 0, error: e.message || 'Microphone access denied' });
        }
    }, [cleanup]);

    const stop = useCallback(async (): Promise<Blob | null> => {
        return new Promise(async (resolve) => {
            if (!state.isRecording) {
                resolve(null);
                return;
            }

            // Native platform
            if (Capacitor.isNativePlatform() && nativeMedia.isNative()) {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
                const result = await nativeMedia.nativeVoice.stop();
                setState({ isRecording: false, duration: 0, error: null });
                // Return result directly if it has duration, but here we just return blob for compatibility
                // Logic in JournalEditor handles the duration from native result if needed, 
                // but this hook signature returns Blob | null. 
                // We'll trust the nativeMedia return type.
                resolve(result?.blob || null);
                return;
            }

            // Web platform
            if (mediaRecorderRef.current?.state === 'recording') {
                resolveStopRef.current = resolve;
                mediaRecorderRef.current.stop();
            } else {
                cleanup();
                setState({ isRecording: false, duration: 0, error: null });
                resolve(null);
            }
        });
    }, [state.isRecording, cleanup]);

    const cancel = useCallback(() => {
        cleanup();
        setState({ isRecording: false, duration: 0, error: null });
    }, [cleanup]);

    return {
        isRecording: state.isRecording,
        duration: state.duration,
        error: state.error,
        start,
        stop,
        cancel
    };
}
