const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

/**
 * Call Google Gemini API (gemini-flash-latest) to generate text content.
 * Fallbacks to the default key provided by user if environment variable is not set.
 */
const LEAKED_KEYS = [
    "AIzaSyCUsT6z1Cmicq1bGEDAmTjwP1KIfq1_kbQ"
];
const DEFAULT_WORKING_KEY = "AIzaSyDas-UU7agAjyQeHDag1yOMU6qyXuxIWBE";

export async function callGemini(prompt: string): Promise<string> {
    let key = import.meta.env.VITE_GEMINI_API_KEY;
    if (!key || LEAKED_KEYS.includes(key.trim())) {
        key = DEFAULT_WORKING_KEY;
    }

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
