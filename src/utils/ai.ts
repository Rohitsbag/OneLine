import { supabase } from '@/utils/supabase/client';

/**
 * Call Gemini via the secure serverless proxy.
 * The proxy verifies the Supabase JWT — no keys ever reach the client.
 */
export async function callGemini(prompt: string): Promise<string> {
    // Get the current session token to authenticate the proxy request
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
        throw new Error("You must be signed in to use AI features.");
    }

    const res = await fetch("/api/ai-proxy", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "gemini", prompt }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI request failed (${res.status})`);
    }

    const data = await res.json();
    if (!data.text) throw new Error("AI returned an empty response.");
    return data.text;
}
