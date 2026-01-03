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
    messages: Array<{ role: string; content: string }>;
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
