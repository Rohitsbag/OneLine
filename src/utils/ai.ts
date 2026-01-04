/**
 * AI Service - Securely calls Groq API through Supabase Edge Function
 * No API keys exposed in frontend
 */
import { supabase } from "@/utils/supabase/client";
import { startOfWeek, endOfWeek, format } from 'date-fns';

const AI_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`;

interface ChatRequest {
    action: "chat";
    model?: string;
    messages: Array<{ role: string; content: string | Array<any> }>;
    temperature?: number;
    max_tokens?: number;
}

async function callAIProxy(body: ChatRequest, signal?: AbortSignal, retry = true): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const makeRequest = async (authToken: string) => {
        const response = await fetch(AI_PROXY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify(body),
            signal: signal
        });

        if (!response.ok) {
            // Handle 401 specifically
            if (response.status === 401 && retry) {
                console.log("AI Proxy 401. Attempting session refresh...");
                const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

                if (!refreshError && newSession?.access_token) {
                    console.log("Session refreshed. Retrying request...");
                    return callAIProxy(body, signal, false); // Retry once, no recursion
                }
            }

            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `AI Request Failed: ${response.status}`);
        }

        const data = await response.json();
        return data.text || "";
    };

    return makeRequest(token);
}

// Maximum base64 size before sending (Safety Gap: 1MB limit - 100KB overhead = 900KB)
const MAX_BASE64_SIZE = 900 * 1024;

export async function performOCR(imageFile: File): Promise<string> {
    try {
        let fileToProcess = imageFile;

        // PRE-FLIGHT: Initial Size Check & Auto-Compression
        // We estimate base64 size (size * 1.33). If > 900KB, we compress immediately.
        if (fileToProcess.size * 1.35 > MAX_BASE64_SIZE) {
            console.log("Image too large for Edge Function. Auto-compressing...");
            const { compressImage } = await import("./image");
            // Target 600KB to be safe (results in ~800KB base64)
            const compressedBlob = await compressImage(fileToProcess, 2048, 600);
            fileToProcess = new File([compressedBlob], imageFile.name, { type: 'image/jpeg' });
        }

        // Convert image to base64
        const base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileToProcess);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });

        // FINAL SAFETY GUARD: If somehow still too big, brute-force compress again
        if (base64Image.length > MAX_BASE64_SIZE) {
            console.warn("Still too large after compression. Applying emergency downscale.");
            const { compressImage } = await import("./image");
            // Aggressive: 1024px, 400KB target
            const emergencyBlob = await compressImage(fileToProcess, 1024, 400);
            const emergencyFile = new File([emergencyBlob], imageFile.name, { type: 'image/jpeg' });

            // Re-convert
            const emergencyBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(emergencyFile);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });

            // If THIS fails, we really can't send it. But we tried everything.
            if (emergencyBase64.length > MAX_BASE64_SIZE) {
                throw new Error("Image could not be compressed enough to send. Please try a different image.");
            }

            // Proceed with emergency version
            return await executeOCRCall(emergencyBase64);
        }

        return await executeOCRCall(base64Image);

    } catch (error: any) {
        console.error("OCR Error:", error);
        if (error.name === 'AbortError' || error.message === "OCR Request Timed Out") {
            throw new Error("OCR is taking too long. Please try again with a better connection.");
        }
        throw new Error(error instanceof Error ? error.message : "Failed to extract text from image");
    }
}

// Extracted inner logic for clean execution after compression handling
async function executeOCRCall(base64Image: string): Promise<string> {
    // TIMEOUT: 45 seconds strict timeout for the entire operation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    // Helper for calling OCR with specific model
    const callOCRModel = (model: string) => callAIProxy({
        action: "chat",
        model: model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "Extract all text from this image. Preserve the formatting (newlines). Return ONLY the extracted text, do not add any conversational filler." },
                    { type: "image_url", image_url: { url: base64Image } }
                ]
            }
        ],
        temperature: 0.1,
        max_tokens: 1000
    }, controller.signal);

    try {
        // TIER 1: Main (Maverick)
        return await callOCRModel("meta-llama/llama-4-maverick-17b-128e-instruct");
    } catch (mainError: any) {
        if (mainError.name === 'AbortError') throw new Error("OCR Request Timed Out");
        console.warn("Main OCR model failed, trying fallback...", mainError);

        // TIER 2: Fallback (Scout)
        return await callOCRModel("meta-llama/llama-4-scout-17b-16e-instruct");
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function transcribeAudio(audioBlob: Blob, model: string): Promise<string> {
    try {
        // Convert blob to base64
        const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onload = () => {
                const base64 = reader.result as string;
                // Remove data URL prefix (e.g., "data:audio/webm;base64,")
                resolve(base64.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });

        // TIMEOUT: 45 seconds strict timeout for transcription
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
            const performTranscription = async (retry = true): Promise<string> => {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token || "";

                const response = await fetch(AI_PROXY_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        action: "transcribe",
                        audio: base64Audio,
                        model: model
                    }),
                    signal: controller.signal
                });

                if (!response.ok) {
                    if (response.status === 401 && retry) {
                        console.log("Transcription 401. Attempting session refresh...");
                        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

                        if (!refreshError && newSession?.access_token) {
                            console.log("Session refreshed. Retrying transcription...");
                            return performTranscription(false);
                        }
                    }

                    const error = await response.json().catch(() => ({ error: response.statusText }));
                    throw new Error(error.error || "Transcription failed");
                }

                const data = await response.json();
                return data.text || "";
            };

            return await performTranscription();

        } finally {
            clearTimeout(timeoutId);
        }

    } catch (error: any) {
        console.error("Transcription Error:", error);
        if (error.name === 'AbortError') {
            throw new Error("Transcription timed out. Please try a shorter recording.");
        }
        throw error;
    }
}

export async function generateWeeklyReflection(userId: string): Promise<string> {
    try {
        // Get this week's entries
        const now = new Date();
        const start = format(startOfWeek(now), 'yyyy-MM-dd');
        const end = format(endOfWeek(now), 'yyyy-MM-dd');

        const { data: entries, error } = await supabase
            .from('entries')
            .select('date, content')
            .eq('user_id', userId)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: true });

        if (error) throw error;

        if (!entries || entries.length === 0) {
            return "No entries found for this week yet. Start writing to unlock insights!";
        }

        const entriesText = entries.map(e => `[${e.date}]: ${e.content}`).join('\n');

        const prompt = `
        You are a gentle, thoughtful AI assistant for a minimalist journaling app called "OneLine".
        Here are the user's journal entries for this week:

        ${entriesText}

        Please provide a brief, warm, and insightful "Weekly Reflection". 
        - Highlight themes or patterns.
        - Offer a gentle encouragement.
        - Keep it under 100 words.
        - Use a calm, supportive tone.
        `;

        // 15 second timeout for edge function
        const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("AI Request Timed Out")), 15000)
        );

        const aiPromise = callAIProxy({
            action: "chat",
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 300,
        });

        const result = await Promise.race([aiPromise, timeoutPromise]);
        return result || "Could not generate reflection.";

    } catch (error) {
        console.error('AI Error:', error);
        if (error instanceof Error && error.message === "AI Request Timed Out") {
            return "The AI is taking too long to respond. Please try again later.";
        }
        return "Sorry, I couldn't generate a reflection at this time.";
    }
}
