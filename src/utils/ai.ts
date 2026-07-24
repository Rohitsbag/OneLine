/**
 * Call Gemini API via secure serverless proxy (/api/ai-proxy) to protect API keys.
 * Fallbacks to direct client fetch ONLY if VITE_GEMINI_API_KEY environment variable is set.
 */
export async function callGemini(prompt: string): Promise<string> {
    // 1. Try secure serverless proxy first (production standard - keys stay on server)
    try {
        const proxyRes = await fetch("/api/ai-proxy", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                action: "gemini",
                prompt,
            }),
        });

        if (proxyRes.ok) {
            const data = await proxyRes.json();
            if (data.text) {
                return data.text;
            }
        } else {
            console.warn("[ai] Server proxy returned status:", proxyRes.status);
        }
    } catch (proxyError) {
        console.warn("[ai] Proxy request failed, trying environment fallback...", proxyError);
    }

    // 2. Fallback to client environment variable if defined in local .env
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim()) {
        try {
            const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-goog-api-key": envKey.trim(),
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini API returned status ${res.status}: ${errText}`);
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || "";
        } catch (error) {
            console.error("[ai] Direct Gemini API call failed:", error);
            throw error;
        }
    }

    throw new Error("AI service is not configured. Please set GEMINI_API_KEY in Vercel environment variables.");
}
