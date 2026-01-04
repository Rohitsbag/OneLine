// Supabase Edge Function: AI Proxy
// Securely proxies requests to Groq API without exposing the API key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
    action: "chat" | "transcribe";
    // For chat completions
    model?: string;
    messages?: Array<{ role: string; content: string | Array<any> }>;
    temperature?: number;
    max_tokens?: number;
    // For transcription
    audio?: string; // base64 encoded audio
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (!GROQ_API_KEY) {
        return new Response(
            JSON.stringify({ error: "GROQ_API_KEY not configured" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const body: RequestBody = await req.json();

        if (body.action === "chat") {
            // Chat Completions
            const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: body.model || "llama-3.3-70b-versatile",
                    messages: body.messages,
                    temperature: body.temperature ?? 0.7,
                    max_tokens: body.max_tokens ?? 300,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                return new Response(
                    JSON.stringify({ error: data.error?.message || "Groq API error" }),
                    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({ text: data.choices?.[0]?.message?.content || "" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );

        } else if (body.action === "transcribe") {
            // Audio Transcription with Whisper
            if (!body.audio) {
                return new Response(
                    JSON.stringify({ error: "No audio provided" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Decode base64 audio
            const audioBytes = Uint8Array.from(atob(body.audio), c => c.charCodeAt(0));
            const audioBlob = new Blob([audioBytes], { type: "audio/webm" });

            // Try whisper models in order
            const models = ["whisper-large-v3", "whisper-large-v3-turbo"];

            for (const model of models) {
                try {
                    const formData = new FormData();
                    formData.append("file", audioBlob, "audio.webm");
                    formData.append("model", model);
                    formData.append("response_format", "text");

                    const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${GROQ_API_KEY}`,
                        },
                        body: formData,
                    });

                    if (response.ok) {
                        const text = await response.text();
                        return new Response(
                            JSON.stringify({ text, model }),
                            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }
                } catch (e) {
                    console.error(`Model ${model} failed:`, e);
                    continue;
                }
            }

            // All models failed
            return new Response(
                JSON.stringify({ error: "Transcription failed", fallback: true }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );

        } else {
            return new Response(
                JSON.stringify({ error: "Invalid action" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

    } catch (error) {
        console.error("Edge function error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
