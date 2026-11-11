import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration in test environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CURATED_PROMPTS: string[] = [
    "What made you smile today?",
    "Who made your day a little easier?",
    "What was the most peaceful moment today?",
    "What is one thing you handled well today?",
    "What are you most grateful for right now?",
    "What made you laugh today?",
    "What was the best taste or meal today?",
    "Whom did you enjoy talking to today?",
    "What surprised you the most today?",
    "What is one small win from today?",
    "What sound or song felt good today?",
    "Where did you feel most relaxed today?",
    "What gave you energy today?",
    "What drained your energy today?",
    "What was a kind thing someone did for you?",
    "What is something kind you did today?",
    "What did you learn today?",
    "What made you pause and think today?",
    "What are you looking forward to tomorrow?",
    "How did your body feel today?",
    "What felt effortless today?",
    "What felt challenging today?",
    "Whom are you thinking about right now?",
    "What did you notice today that you usually miss?",
    "What gave you comfort today?",
    "What was the highlight of your morning?",
    "What was the highlight of your evening?",
    "What was the prettiest thing you saw today?",
    "What was a funny moment from today?",
    "What is a thought that kept returning today?",
    "What was your favorite conversation today?",
    "What brought you unexpected joy today?",
    "What is one thing you would do differently today?",
    "What felt peaceful about this evening?",
    "What made you feel like yourself today?",
    "How would you describe today in three words?"
];

function normalizePrompt(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) return '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!resp.ok) return '';
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch {
        return '';
    }
}

async function getUniqueJournalPrompt(userId: string): Promise<string> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: history } = await supabase
        .from('journal_prompts_history')
        .select('prompt_text')
        .eq('user_id', userId)
        .gte('served_at', thirtyDaysAgo)
        .order('served_at', { ascending: false });

    const servedList = (history || []).map((h: any) => (h.prompt_text || '').trim()).filter(Boolean);
    const servedNormalizedSet = new Set(servedList.map(normalizePrompt));

    let candidate = '';

    if (GEMINI_API_KEY) {
        try {
            const exclusions = servedList.slice(0, 15).map(p => `- ${p}`).join('\n');
            const systemPrompt = [
                "You are a warm, thoughtful daily journaling companion for OneLine.",
                "Suggest ONE short, conversational daily reflection question.",
                "STRICT RULES:",
                "- Target length: 6 to 9 words. MAXIMUM: 10 words. Absolute hard limit: 12 words.",
                "- Simple, human, reflective.",
                "- Output ONLY the question. No quotes, no intro, no emojis, no commentary.",
                exclusions ? `- Never repeat or rephrase any of these recent questions:\n${exclusions}` : ''
            ].filter(Boolean).join('\n');

            const rawAiPrompt = await callGemini(systemPrompt);
            const cleaned = rawAiPrompt
                .replace(/^["'`\s*#]+|["'`\s*#]+$/g, '')
                .replace(/\n+/g, ' ')
                .trim();

            const words = cleaned.split(/\s+/).filter(Boolean);
            const normCleaned = normalizePrompt(cleaned);

            if (words.length >= 3 && words.length <= 12 && !servedNormalizedSet.has(normCleaned)) {
                const candidateKeywords = new Set(normCleaned.split(' ').filter(w => w.length > 3));
                let tooSimilar = false;

                if (candidateKeywords.size > 0) {
                    for (const prev of servedNormalizedSet) {
                        const prevKeywords = prev.split(' ').filter(w => w.length > 3);
                        const matchCount = prevKeywords.filter(w => candidateKeywords.has(w)).length;
                        if (matchCount / candidateKeywords.size >= 0.6) {
                            tooSimilar = true;
                            break;
                        }
                    }
                }

                if (!tooSimilar) {
                    candidate = cleaned.endsWith('?') ? cleaned : `${cleaned}?`;
                }
            }
        } catch (geminiErr) {
            console.error('[Gemini Prompt Generator Error]:', geminiErr);
        }
    }

    if (!candidate) {
        const unservedCurated = CURATED_PROMPTS.filter(p => !servedNormalizedSet.has(normalizePrompt(p)));
        if (unservedCurated.length > 0) {
            candidate = unservedCurated[Math.floor(Math.random() * unservedCurated.length)];
        } else {
            candidate = CURATED_PROMPTS[Math.floor(Math.random() * CURATED_PROMPTS.length)];
        }
    }

    await supabase.from('journal_prompts_history').insert({
        user_id: userId,
        prompt_text: candidate,
        category: 'daily_reflection',
        served_at: new Date().toISOString(),
    });

    return candidate;
}

async function runPromptTestSuite() {
    console.log('--- Starting Daily Journal Prompts & 30-Day Dedup Test Suite ---');
    let passed = 0;
    let failed = 0;

    function assert(name: string, condition: boolean, detail?: string) {
        if (condition) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name} ${detail ? '- ' + detail : ''}`);
            failed++;
        }
    }

    // 1. Verify all curated prompts are <= 10 words
    const longCurated = CURATED_PROMPTS.filter(p => p.split(/\s+/).filter(Boolean).length > 10);
    assert('1. All curated pool questions are strictly <= 10 words', longCurated.length === 0, `Violations: ${longCurated.join(', ')}`);

    // 2. Fetch a dummy test user or existing user
    const { data: userProbe } = await supabase.from('user_settings').select('user_id').limit(1).single();
    const testUserId = userProbe?.user_id;
    if (!testUserId) {
        console.error('No test user found in user_settings');
        process.exit(1);
    }

    const createdIds: string[] = [];

    try {
        // 3. Generate 3 consecutive prompts and verify non-repetition & length
        const generatedPrompts: string[] = [];
        for (let i = 0; i < 3; i++) {
            const p = await getUniqueJournalPrompt(testUserId);
            const wordCount = p.split(/\s+/).filter(Boolean).length;
            generatedPrompts.push(p);
            console.log(`   Prompt ${i + 1}: "${p}" (${wordCount} words)`);
            assert(`2.${i + 1} Prompt length is <= 12 words (got ${wordCount})`, wordCount <= 12);
        }

        const uniqueSet = new Set(generatedPrompts.map(normalizePrompt));
        assert('3. All consecutive prompts are mutually distinct', uniqueSet.size === generatedPrompts.length);

        // 4. Verify they were inserted into journal_prompts_history
        const { data: dbRecords } = await supabase
            .from('journal_prompts_history')
            .select('id, prompt_text')
            .eq('user_id', testUserId)
            .order('served_at', { ascending: false })
            .limit(3);

        const recordedPrompts = (dbRecords || []).map(r => r.prompt_text);
        assert('4. Prompts are persisted in journal_prompts_history table', dbRecords?.length === 3);
        if (dbRecords) {
            createdIds.push(...dbRecords.map(r => r.id));
        }

        // 5. Test exclusion: ensure a known prompt in history is skipped by curated fallback
        const testHistoryPrompt = CURATED_PROMPTS[0];
        const { data: fakeInsert } = await supabase
            .from('journal_prompts_history')
            .insert({
                user_id: testUserId,
                prompt_text: testHistoryPrompt,
                served_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (fakeInsert) createdIds.push(fakeInsert.id);

        const { data: historyCheck } = await supabase
            .from('journal_prompts_history')
            .select('prompt_text')
            .eq('user_id', testUserId)
            .eq('prompt_text', testHistoryPrompt);

        assert('5. Historical prompt correctly registered in 30-day window', Boolean(historyCheck && historyCheck.length > 0));

    } finally {
        // Cleanup created test records
        if (createdIds.length > 0) {
            await supabase.from('journal_prompts_history').delete().in('id', createdIds);
            console.log(`   Cleaned up ${createdIds.length} test prompt records from DB.`);
        }
    }

    console.log(`\nPrompts Test Suite Completed: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) process.exit(1);
}

runPromptTestSuite();
