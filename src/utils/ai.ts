/**
 * AI Service - Direct Integrations for Robustness
 * OCR: Tesseract.js (On-device/Local)
 * STT: Groq / Whisper (Fastest API)
 */
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { supabase } from "@/utils/supabase/client";

// Vercel API route for AI proxy (server-side key)
const AI_PROXY_URL = `https://get-one-line.vercel.app/api/ai-proxy`;

async function callAIProxy(body: any, signal?: AbortSignal): Promise<string> {
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

// Old implementation removed in favor of replacement below

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/**
 * Perform OCR using Tesseract.js (Strictly Local)
 */
export async function performOCR(imageFile: File, language: string = "English"): Promise<string> {
    try {
        console.log(`[OCR] Starting Tesseract.js for ${imageFile.name}...`);

        // 1. Import Tesseract dynamically
        const Tesseract = await import('tesseract.js');

        // 2. Map language to Tesseract code
        const langMap: Record<string, string> = {
            'English': 'eng',
            'Hindi': 'hin',
            'Spanish': 'spa',
            'French': 'fra',
            'German': 'deu',
            'Chinese': 'chi_sim',
            'Japanese': 'jpn'
        };
        const langCode = langMap[language] || 'eng';

        // 3. Run recognition
        const { data: { text } } = await Tesseract.recognize(imageFile, langCode, {
            logger: (m) => console.log(`[OCR Progress]`, m)
        });

        if (!text || text.trim().length === 0) {
            return "No text detected.";
        }

        return text.trim();

    } catch (error: any) {
        console.error("OCR Error:", error);
        throw new Error("Text recognition failed. Please try a clearer image.");
    }
}

/**
 * Transcribe Audio using Groq API (Whisper Large V3)
 * Significantly faster than standard Whisper.
 */
export async function transcribeAudio(audioBlob: Blob, model: string, language: string = "Auto"): Promise<string> {
    if (!GROQ_API_KEY) {
        throw new Error("Missing Groq API Key. Please update settings.");
    }

    try {
        console.log(`[STT] Starting Groq transcription (${audioBlob.size} bytes)...`);

        // 1. Prepare FormData
        const formData = new FormData();
        // Groq requires a filename with an audio extension
        const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });

        formData.append("file", file);
        formData.append("model", "whisper-large-v3");

        // Optional: Language hint (Groq supports ISO codes)
        if (language && language !== "Auto" && language !== "Hinglish") {
            // Simple map for common checks
            const code = language.toLowerCase().slice(0, 2);
            formData.append("language", code);
        }

        // Optional: Prompt for context (e.g. Hinglish)
        if (language === "Hinglish") {
            formData.append("prompt", "Transcribe this audio which may contain a mix of English and Hindi.");
        }

        // 2. Call API
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                // Content-Type is set automatically by fetch for FormData
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
            console.error("[STT] Groq API Error:", err);
            throw new Error(err.error?.message || `Groq API Failed: ${response.status}`);
        }

        const data = await response.json();
        return data.text || "";

    } catch (error: any) {
        console.error("[STT] Transcription Error:", error);
        throw new Error("Transcription failed. Please check your internet connection.");
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



        const callAI = async (model: string, signal: AbortSignal) => {
            const response = await fetch(AI_PROXY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "chat",
                    messages: [{ role: "user", content: prompt }],
                    model: model,
                    temperature: 0.7,
                    max_tokens: 500,
                }),
                signal
            });
            if (!response.ok) throw new Error(`Model ${model} failed`);
            const data = await response.json();
            return data.text;
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            try {
                // TIER 1: Primary Summarization Model
                return await callAI("openai/gpt-oss-20b", controller.signal);
            } catch (error) {
                console.warn("Weekly Reflection main model failed, trying fallback...", error);
                // TIER 2: Fallback Model
                return await callAI("llama-3.1-8b-instant", controller.signal);
            }
        } finally {
            clearTimeout(timeoutId);
        }

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

export async function performRewrite(text: string): Promise<string> {
    if (!text || text.trim().length === 0) return "";

    const prompt = `
    You are a professional editor for a personal journal.
    Task: Refine and polish the provided journal entry.
    Requirements:
    - Improve grammar, flow, and clarity while maintaining the original meaning and emotional tone.
    - Keep it concise (retaining the "OneLine" spirit).
    - If it's already well-written, make only subtle improvements.
    - Do not add new information or remove key details.
    - Output ONLY the polished text. No meta-commentary, no quotes.

    Original Entry:
    "${text}"
    `;

    return await callAIProxy({
        action: "chat",
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
    });
}
