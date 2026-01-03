import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabase } from "@/utils/supabase/client";
import { startOfWeek, endOfWeek, format } from 'date-fns';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

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
            return NextResponse.json({ reflection: "No entries found for this week yet. Start writing to unlock insights!" });
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

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama3-8b-8192', // Fast, good quality
            temperature: 0.7,
            max_tokens: 300,
        });

        const reflection = chatCompletion.choices[0]?.message?.content || "Could not generate reflection.";

        return NextResponse.json({ reflection });

    } catch (error) {
        console.error('AI Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
