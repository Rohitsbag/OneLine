// Supabase Edge Function: AI Proxy
// Securely proxies requests to Groq API without exposing the API key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// === SECURITY: Explicit CORS origin ===
const ALLOWED_ORIGIN = "https://get-one-line.vercel.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === SECURITY: Rate limiting (in-memory, per-user) ===
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // requests per window
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
}

// === SECURITY: Payload size validation ===
// GROQ allows 4MB for base64 images, so we match that limit
const MAX_PAYLOAD_SIZE_BYTES = 4 * 1024 * 1024; // 4MB (GROQ's limit)
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25MB for audio (Whisper limit)

// Helper: Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 45000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

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

    // === SECURITY: Validate JWT token ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
            JSON.stringify({ error: "Missing or invalid authorization header" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const token = authHeader.replace("Bearer ", "");

    // DEBUG: Log environment status
    console.log("=== AI PROXY DEBUG ===");
    console.log("SUPABASE_URL:", SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + "..." : "NOT SET");
    console.log("SUPABASE_ANON_KEY set:", !!SUPABASE_ANON_KEY);
    console.log("Token length:", token.length);

    // Check if env vars are set
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return new Response(
            JSON.stringify({
                error: "Server misconfigured",
                details: `SUPABASE_URL: ${!!SUPABASE_URL}, SUPABASE_ANON_KEY: ${!!SUPABASE_ANON_KEY}`
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // DEBUG: Log auth result
    console.log("Auth error:", authError?.message || "none");
    console.log("User found:", !!user);

    if (authError || !user) {
        return new Response(
            JSON.stringify({
                error: "Invalid or expired token",
                details: authError?.message || "No user returned",
                debug: {
                    supabaseUrlSet: !!SUPABASE_URL,
                    anonKeySet: !!SUPABASE_ANON_KEY,
                    tokenLength: token.length
                }
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // === SECURITY: Rate limit check ===
    if (!checkRateLimit(user.id)) {
        return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please wait before trying again." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        // === SECURITY: Payload size check ===
        const contentLength = req.headers.get("Content-Length");
        if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE_BYTES) {
            return new Response(
                JSON.stringify({ error: "Payload too large. Maximum size is 4MB." }),
                { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const bodyText = await req.text();
        if (bodyText.length > MAX_PAYLOAD_SIZE_BYTES) {
            return new Response(
                JSON.stringify({ error: "Payload too large. Maximum size is 4MB." }),
                { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body: RequestBody = JSON.parse(bodyText);

        if (body.action === "chat") {
            // Chat Completions
            const allowedModels = [
                "llama-3.3-70b-versatile",
                "meta-llama/llama-4-maverick-17b-128e-instruct",
                "meta-llama/llama-4-scout-17b-16e-instruct"
            ];

            const requestedModel = body.model || "llama-3.3-70b-versatile";

            // Allow Llama 4 models or default Llama 3 models
            // Safety check: ensure requested model is in our allowlist
            const modelToUse = allowedModels.includes(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";

            const response = await fetchWithTimeout(`${GROQ_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: modelToUse,
                    messages: body.messages,
                    temperature: body.temperature ?? 0.7,
                    max_tokens: body.max_tokens ?? 300,
                }),
            }, 45000);

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

            // GUARD: Check audio size (max 25MB for Whisper)
            if (audioBytes.length > MAX_AUDIO_SIZE_BYTES) {
                return new Response(
                    JSON.stringify({ error: `Audio too large. Maximum size is 25MB. Your file is ${(audioBytes.length / (1024 * 1024)).toFixed(1)}MB.` }),
                    { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Whisper API expects 'file' part. Blob type is important.
            const audioBlob = new Blob([audioBytes], { type: "audio/webm" });

            // Tiered Model Selection: User requested specific tiers
            // If body.model is provided (e.g. 'whisper-large-v3-turbo' for data saver), use it.
            // Default to high quality 'whisper-large-v3'.
            const model = body.model === "whisper-large-v3-turbo" ? "whisper-large-v3-turbo" : "whisper-large-v3";

            try {
                const formData = new FormData();
                formData.append("file", audioBlob, "audio.webm");
                formData.append("model", model);
                // formData.append("response_format", "text"); // JSON is better for error handling

                const response = await fetchWithTimeout(`${GROQ_BASE_URL}/audio/transcriptions`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GROQ_API_KEY}`,
                    },
                    body: formData,
                }, 60000); // 60s timeout for audio transcription

                const data = await response.json();

                if (response.ok) {
                    return new Response(
                        JSON.stringify({ text: data.text }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                } else {
                    return new Response(
                        JSON.stringify({ error: data.error?.message || "Transcription failed" }),
                        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            } catch (e) {
                console.error(`Transcription with ${model} failed:`, e);
                return new Response(
                    JSON.stringify({ error: "Internal transcription error" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

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
