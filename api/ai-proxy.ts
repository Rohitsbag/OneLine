import type { VercelRequest, VercelResponse } from '@vercel/node';

// GROQ API Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";



// Allowed models for security
const ALLOWED_CHAT_MODELS = [
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct"
];

const ALLOWED_WHISPER_MODELS = [
    "whisper-large-v3",
    "whisper-large-v3-turbo"
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS - Apply to ALL responses
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle Preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // Check GROQ API key
    if (!GROQ_API_KEY) {
        console.error("GROQ_API_KEY not configured");
        return res.status(500).json({ error: "Server configuration error" });
    }

    try {
        const body = req.body;

        if (body.action === "chat") {
            // Chat Completions (for OCR)
            const requestedModel = body.model;
            const modelToUse = ALLOWED_CHAT_MODELS.includes(requestedModel)
                ? requestedModel
                : "meta-llama/llama-4-maverick-17b-128e-instruct";

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            try {
                const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GROQ_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: modelToUse,
                        messages: body.messages,
                        temperature: body.temperature ?? 0.7,
                        max_tokens: body.max_tokens ?? 500,
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                const data = await response.json();

                if (!response.ok) {
                    console.error("GROQ API Error:", data);
                    return res.status(response.status).json({
                        error: data.error?.message || "GROQ API error"
                    });
                }

                return res.status(200).json({
                    text: data.choices?.[0]?.message?.content || ""
                });
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    return res.status(504).json({ error: "Request timeout" });
                }
                throw fetchError;
            }

        } else if (body.action === "transcribe") {
            // Audio Transcription (for STT)
            if (!body.audio) {
                return res.status(400).json({ error: "No audio provided" });
            }

            // Decode base64 audio
            const audioBuffer = Buffer.from(body.audio, 'base64');

            // Check audio size (max 25MB)
            if (audioBuffer.length > 25 * 1024 * 1024) {
                return res.status(413).json({
                    error: `Audio too large. Max 25MB, yours: ${(audioBuffer.length / (1024 * 1024)).toFixed(1)}MB`
                });
            }

            // Select model
            const model = ALLOWED_WHISPER_MODELS.includes(body.model)
                ? body.model
                : "whisper-large-v3";

            // Create FormData for multipart upload
            const formData = new FormData();
            const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });
            formData.append("file", audioBlob, "audio.webm");
            formData.append("model", model);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GROQ_API_KEY}`,
                    },
                    body: formData,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                const data = await response.json();

                if (!response.ok) {
                    console.error("GROQ Transcription Error:", data);
                    return res.status(response.status).json({
                        error: data.error?.message || "Transcription failed"
                    });
                }

                return res.status(200).json({ text: data.text || "" });
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    return res.status(504).json({ error: "Transcription timeout" });
                }
                throw fetchError;
            }

        } else {
            return res.status(400).json({ error: "Invalid action" });
        }

    } catch (error: any) {
        console.error("API Route Error:", error);
        return res.status(500).json({ error: error.message || "Internal error" });
    }
}
