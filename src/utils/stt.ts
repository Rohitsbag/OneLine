/**
 * STT Service - Speech-to-Text using Whisper via Edge Function
 * Falls back to browser Web Speech API if edge function fails
 */
import { supabase } from "@/utils/supabase/client";

const AI_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`;

interface TranscriptionResult {
    text: string;
    model: string;
    fallback: boolean;
}

/**
 * Convert Blob to base64 string (without data URL prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Transcribe audio using Whisper models via edge function.
 * Returns fallback: true if API fails (caller should use browser STT).
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const base64Audio = await blobToBase64(audioBlob);

        const response = await fetch(AI_PROXY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token || ""}`,
            },
            body: JSON.stringify({
                action: "transcribe",
                audio: base64Audio,
            }),
        });

        const data = await response.json();

        if (!response.ok || data.fallback) {
            return {
                text: "",
                model: "none",
                fallback: true
            };
        }

        return {
            text: data.text || "",
            model: data.model || "whisper",
            fallback: false
        };
    } catch (error) {
        console.warn("Whisper transcription failed:", error);
        return {
            text: "",
            model: "none",
            fallback: true
        };
    }
}

/**
 * Check if STT API is available (Supabase URL configured)
 */
export function isWhisperAvailable(): boolean {
    return !!import.meta.env.VITE_SUPABASE_URL;
}
