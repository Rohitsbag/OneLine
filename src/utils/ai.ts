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

async function callAIProxy(body: ChatRequest): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI request failed");
    }

    const data = await response.json();
    return data.text || "";
}

// Maximum base64 size before sending (slightly under 1MB to account for JSON overhead)
const MAX_BASE64_SIZE = 900 * 1024; // ~900KB

export async function performOCR(imageFile: File): Promise<string> {
    try {
        // Convert image to base64
        const base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });

        // SECURITY: Validate base64 size before sending
        if (base64Image.length > MAX_BASE64_SIZE) {
            throw new Error("Image too large. Please use a smaller image or compress it further.");
        }

        // 30 second timeout for OCR (longer due to vision model processing)
        const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("OCR Request Timed Out")), 30000)
        );

        const ocrPromise = callAIProxy({
            action: "chat",
            model: "llama-3.2-11b-vision-preview",
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
        });

        const result = await Promise.race([ocrPromise, timeoutPromise]);
        return result;
    } catch (error) {
        console.error("OCR Error:", error);
        if (error instanceof Error && error.message === "OCR Request Timed Out") {
            throw new Error("OCR is taking too long. Please try again with a smaller image.");
        }
        throw new Error(error instanceof Error ? error.message : "Failed to extract text from image");
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
