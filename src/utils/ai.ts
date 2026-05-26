const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

/**
 * Call Google Gemini API (gemini-flash-latest) to generate text content.
 * Fallbacks to the default key provided by user if environment variable is not set.
 */
export async function callGemini(prompt: string): Promise<string> {
    const key = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCUsT6z1Cmicq1bGEDAmTjwP1KIfq1_kbQ";

    try {
        const res = await fetch(`${GEMINI_URL}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": key,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API returned status ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.warn("[ai] Gemini response was empty or malformed:", data);
            return "";
        }
        return text;
    } catch (error) {
        console.error("[ai] callGemini failed:", error);
        throw error;
    }
}
