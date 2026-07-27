import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

/** Verify the Supabase JWT from the Authorization header. Returns userId or null. */
async function verifyAuth(req: VercelRequest): Promise<string | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    if (!token) return null;

    try {
        // Use Supabase client to verify the token — it validates the JWT signature internally
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;
        return user.id;
    } catch {
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Security headers on every response
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://oneline.so");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Authenticate every request
    const userId = await verifyAuth(req);
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const body = req.body;

        if (body.action !== "gemini") {
            return res.status(400).json({ error: "Invalid action" });
        }

        if (!GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY not configured on server");
            return res.status(500).json({ error: "AI service not configured" });
        }

        if (!body.prompt || typeof body.prompt !== 'string') {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // Hard cap prompt length to prevent abuse
        if (body.prompt.length > 32000) {
            return res.status(400).json({ error: "Prompt too long" });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(GEMINI_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-goog-api-key": GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: body.prompt }] }],
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                console.error("Gemini API Error:", data);
                return res.status(response.status).json({ error: data.error?.message || "Gemini API error" });
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return res.status(200).json({ text });
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                return res.status(504).json({ error: "AI request timed out. Please try again." });
            }
            throw fetchError;
        }

    } catch (error: any) {
        console.error("API Route Error:", error);
        return res.status(500).json({ error: "Internal error" });
    }
}
