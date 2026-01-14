/**
 * AI Service - Calls Groq API through Vercel Serverless Function
 * API key kept secure on server side
 */
import { supabase } from "@/utils/supabase/client";
import { startOfWeek, endOfWeek, format } from 'date-fns';

// Use full URL for Android APK compatibility (relative URLs don't work in Capacitor)
const AI_PROXY_URL = `https://get-one-line.vercel.app/api/ai-proxy`;

interface ChatRequest {
    action: "chat";
    model?: string;
    messages: Array<{ role: string; content: string | Array<any> }>;
    temperature?: number;
    max_tokens?: number;
}

async function callAIProxy(body: ChatRequest, signal?: AbortSignal): Promise<string> {
    // Simple fetch to Vercel API route - no auth needed, key is server-side
    const response = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: signal
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        console.error("AI Proxy Error:", error);
        throw new Error(error.error || `AI Request Failed: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "";
}

// Maximum base64 size before compression (Edge Function accepts 4MB, we use 3.5MB for safety)
const MAX_BASE64_SIZE = 3.5 * 1024 * 1024; // 3.5MB (leaves room for overhead)

export async function performOCR(imageFile: File): Promise<string> {
    try {
        let fileToProcess = imageFile;

        // PRE-FLIGHT: Initial Size Check & Auto-Compression
        // We estimate base64 size (size * 1.33). If > 3.5MB, we compress.
        if (fileToProcess.size * 1.35 > MAX_BASE64_SIZE) {
            console.log("Image large. Compressing for Edge Function...");
            const { compressImage } = await import("./image");
            // Target 2.5MB to stay under 3.5MB base64 with room
            const compressedBlob = await compressImage(fileToProcess, 3000, 2500);
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
                    {
                        type: "text",
                        text: `Task: Extract all readable text from the provided image.

Requirements:
- Preserve original formatting exactly (line breaks, spacing, paragraph structure).
- Maintain reading order (top-to-bottom, left-to-right).
- Include all visible text: headings, body text, captions, footnotes, labels, numbers, symbols.
- Do not summarize, interpret, correct, or rewrite the text.
- Do not add explanations, comments, or metadata.
- If text is partially unclear, transcribe it as-is to the best possible accuracy.
- If no text is present, return an empty response.

Output Rules:
- Return ONLY the extracted text.
- No prefixes, no quotes, no markdown, no conversational filler.`
                    },
                    { type: "image_url", image_url: { url: base64Image } }
                ]
            }
        ],
        temperature: 0.1,
        max_tokens: 1000
    }, controller.signal);

    try {
        // TIER 1: Maverick (Primary)
        return await callOCRModel("meta-llama/llama-4-maverick-17b-128e-instruct");
    } catch (mainError: any) {
        if (mainError.name === 'AbortError') throw new Error("OCR Request Timed Out");
        console.warn("Main OCR model failed, trying fallback...", mainError);

        try {
            // TIER 2: Scout (Faster/Standard)
            return await callOCRModel("meta-llama/llama-4-scout-17b-16e-instruct");
        } catch (scoutError: any) {
            console.warn("Scout OCR failed, using Tesseract fallback...", scoutError);

            // TIER 3: Tesseract.js (Client-side, never fails)
            try {
                // Dynamically import Tesseract to avoid bundle bloat
                const Tesseract = await import('tesseract.js');

                // Convert base64 to blob for Tesseract
                const blob = await fetch(base64Image).then(r => r.blob());

                const { data: { text } } = await Tesseract.recognize(blob, 'eng', {
                    logger: () => { } // Suppress logs
                });

                return text || "No text detected in image.";
            } catch (tesseractError) {
                console.error("Tesseract fallback failed:", tesseractError);
                // Absolute last resort
                return "Unable to extract text from image. Please try a clearer image.";
            }
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function transcribeAudio(audioBlob: Blob, model: string, language: string = "Auto"): Promise<string> {
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

        // Customize prompt based on language
        let systemPrompt = "You are a highly accurate speech-to-text service. Transcribe the audio exactly as spoken.";
        if (language === "Hindi") {
            systemPrompt = "Transcribe the audio and translate it into pure Hindi. If it is already Hindi, just transcribe it. Use Devanagari script.";
        } else if (language === "Hinglish") {
            systemPrompt = "Transcribe the audio as Hinglish (mixture of Hindi and English) as spoken by many young Indians. Use Roman script, but reflect Hindi words correctly.";
        } else if (language === "English") {
            systemPrompt = "Transcribe the audio into pure English. If the speaker is speaking Hindi, translate it to English.";
        }

        // TIMEOUT: 45 seconds strict timeout for transcription
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
            // Simple fetch to Vercel API route - no auth needed
            const response = await fetch(AI_PROXY_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "transcribe",
                    audio: base64Audio,
                    model: model,
                    prompt: systemPrompt
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                console.error("Transcription Error:", error);
                throw new Error(error.error || "Transcription failed");
            }

            const data = await response.json();
            return data.text || "";

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

        const fetchWithRetry = async (retryCount = 0): Promise<string> => {
            try {
                const aiPromise = callAIProxy({
                    action: "chat",
                    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 500,
                });

                const result = await Promise.race([aiPromise, timeoutPromise]);
                if (!result || result.trim() === "") {
                    throw new Error("Empty AI response");
                }
                return result;
            } catch (err) {
                if (retryCount < 1) {
                    console.warn(`AI Summary failed, retrying... (${retryCount + 1})`, err);
                    return fetchWithRetry(retryCount + 1);
                }
                throw err;
            }
        };

        const result = await fetchWithRetry();
        return result;

    } catch (error) {
        console.error('AI Error:', error);
        if (error instanceof Error && (error.message === "AI Request Timed Out" || error.message === "Empty AI response")) {
            return "The AI is taking a moment to breathe. Please check back in a few minutes for your reflection.";
        }
        return "Your reflection is currently resting. Try refreshing the page in a moment.";
    }
}

// NEW: Contextual Summary for "Last 7 Days"
export async function generateContextualSummary(contextText: string): Promise<string> {
    if (!contextText || contextText.trim().length === 0) {
        return "Not enough entries to generate a summary.";
    }

    const systemPrompt = `You are a concise journal assistant. Summarize the provided journal entries in strictly under 3 sentences. The word count must be between 30 and 50 words. Focus ONLY on the text content provided. Ignore any references to audio or images. Write in the first person.`;
    const userPrompt = `Here are my journal entries for the last 7 days:\n\n${contextText}`;

    const callAI = async (model: string, signal: AbortSignal) => {
        const response = await fetch(AI_PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                model: model
            }),
            signal
        });
        if (!response.ok) throw new Error(`Model ${model} failed`);
        const data = await response.json();
        return data.text;
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s total timeout

    try {
        // MAIN: openai/gpt-oss-20b
        try {
            return await callAI("openai/gpt-oss-20b", controller.signal) || "Could not generate summary.";
        } catch (mainError) {
            console.warn("Main AI Summary model failed, trying fallback...", mainError);
            // FALLBACK: llama-3.1-8b-instant
            return await callAI("llama-3.1-8b-instant", controller.signal) || "Could not generate summary.";
        }
    } catch (error) {
        console.error("All AI Summary models failed:", error);
        return "Summary currently unavailable.";
    } finally {
        clearTimeout(timeoutId);
    }
}
