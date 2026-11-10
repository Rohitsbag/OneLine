import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// Meta Graph API Message Senders
// ==========================================

async function sendWhatsAppRaw(payload: Record<string, any>) {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.warn('[WhatsApp] Credentials missing. Would send:', JSON.stringify(payload));
        return;
    }
    const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            const errBody = await resp.text();
            console.error('[WhatsApp Send Error]:', resp.status, errBody);
        }
    } catch (err) {
        console.error('[WhatsApp Send Exception]:', err);
    }
}

async function sendTextMessage(to: string, text: string) {
    return sendWhatsAppRaw({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
    });
}

async function sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
) {
    return sendWhatsAppRaw({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
                buttons: buttons.slice(0, 3).map(btn => ({
                    type: 'reply',
                    reply: { id: btn.id, title: btn.title.slice(0, 20) },
                })),
            },
        },
    });
}

async function sendInteractiveList(
    to: string,
    bodyText: string,
    buttonTitle: string,
    sections: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
    }>
) {
    return sendWhatsAppRaw({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'list',
            header: { type: 'text', text: 'OneLine Diary' },
            body: { text: bodyText },
            footer: { text: 'OneLine • One sentence a day' },
            action: {
                button: buttonTitle.slice(0, 20),
                sections: sections.map(s => ({
                    title: s.title.slice(0, 24),
                    rows: s.rows.slice(0, 10).map(r => ({
                        id: r.id,
                        title: r.title.slice(0, 24),
                        description: r.description ? r.description.slice(0, 72) : undefined,
                    })),
                })),
            },
        },
    });
}

async function sendDocumentMessage(to: string, link: string, filename: string, caption?: string) {
    return sendWhatsAppRaw({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
            link,
            filename,
            caption,
        },
    });
}

async function sendMainMenu(to: string, userName?: string) {
    const greeting = userName ? `Hi ${userName}!` : 'Hi there!';
    return sendInteractiveList(
        to,
        `${greeting} What would you like to do? Select an option or simply reply with any thought, photo, or voice memo.`,
        'Choose an Option',
        [
            {
                title: '📝 Write & Capture',
                rows: [
                    { id: 'act_add_today', title: "Add to Today's Note", description: 'Send a quick text, photo, or voice memo' },
                    { id: 'act_replace_today', title: "Replace Today's Note", description: 'Erase today and start fresh' },
                    { id: 'act_write_yesterday', title: 'Write for Yesterday', description: 'Forgot yesterday? Add it here' },
                    { id: 'act_idea_prompt', title: 'Need an Idea to Write?', description: 'Get a fun, friendly question' },
                ],
            },
            {
                title: '📖 Read & Remember',
                rows: [
                    { id: 'act_read_today', title: "Read Today's Note", description: "See what you've saved today" },
                    { id: 'act_read_yesterday', title: "Read Yesterday's Note", description: 'See what you wrote yesterday' },
                    { id: 'act_past_memory', title: 'Time Machine', description: 'What you wrote on this day in the past' },
                    { id: 'act_week_summary', title: 'My Week in 3 Sentences', description: 'Friendly 7-day AI summary' },
                ],
            },
            {
                title: '⭐ Downloads & Streaks',
                rows: [
                    { id: 'act_streak', title: 'My Diary Streak', description: 'See how many days in a row' },
                    { id: 'act_download_pdf', title: 'Download My Diary (PDF)', description: 'Get a printable PDF diary book' },
                ],
            },
            {
                title: '⏰ Reminders & Settings',
                rows: [
                    { id: 'act_change_reminder', title: 'Change Reminder Time', description: 'Pick when we remind you each night' },
                    { id: 'act_unlink', title: 'Disconnect WhatsApp', description: 'Stop linking WhatsApp to OneLine' },
                ],
            },
        ]
    );
}

// ==========================================
// Date & Timezone Helpers
// ==========================================

function getDatesForTimezone(tz = 'Asia/Kolkata') {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const todayStr = formatter.format(now); // yyyy-mm-dd

    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatter.format(yesterdayDate);

    const friendlyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
    const todayFriendly = friendlyFormatter.format(now);
    const yesterdayFriendly = friendlyFormatter.format(yesterdayDate);

    return { todayStr, yesterdayStr, todayFriendly, yesterdayFriendly };
}

// ==========================================
// Gemini Flash AI Assistant
// ==========================================

async function callGemini(prompt: string, inlineMedia?: { mimeType: string; base64: string }): Promise<string> {
    if (!GEMINI_API_KEY) return '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const parts: any[] = [{ text: prompt }];
    if (inlineMedia) {
        parts.push({
            inline_data: {
                mime_type: inlineMedia.mimeType,
                data: inlineMedia.base64,
            },
        });
    }

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] }),
        });
        if (!resp.ok) {
            console.error('[Gemini Error]:', resp.status, await resp.text());
            return '';
        }
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (err) {
        console.error('[Gemini Exception]:', err);
        return '';
    }
}

// ==========================================
// Streak Calculation Helper
// ==========================================

async function calculateStreak(userId: string, todayStr: string): Promise<number> {
    try {
        const { data } = await supabase
            .from('entries')
            .select('date')
            .eq('user_id', userId)
            .lte('date', todayStr)
            .order('date', { ascending: false })
            .limit(60);

        if (!data || data.length === 0) return 0;

        const dates = new Set(data.map(d => d.date));
        let streak = 0;
        let curr = new Date(todayStr + 'T00:00:00Z');

        // Check if today is present, if not check yesterday
        if (!dates.has(todayStr)) {
            curr = new Date(curr.getTime() - 86400000);
            const yestStr = curr.toISOString().split('T')[0];
            if (!dates.has(yestStr)) return 0;
        }

        while (true) {
            const checkStr = curr.toISOString().split('T')[0];
            if (dates.has(checkStr)) {
                streak++;
                curr = new Date(curr.getTime() - 86400000);
            } else {
                break;
            }
        }
        return streak;
    } catch {
        return 1;
    }
}

// ==========================================
// PDF Diary Book Generator
// ==========================================

async function generateMonthlyDiaryPdf(userId: string, targetMonthStr: string): Promise<string | null> {
    try {
        const startDate = `${targetMonthStr}-01`;
        const endDate = `${targetMonthStr}-31`;

        const { data: entries } = await supabase
            .from('entries')
            .select('date, content, media_items')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (!entries || entries.length === 0) return null;

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();
        let y = height - 60;

        // Cover / Header
        page.drawText('OneLine Diary Book', { x: 50, y, size: 24, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
        y -= 25;
        page.drawText(`Month: ${targetMonthStr}`, { x: 50, y, size: 14, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 40;

        for (const entry of entries) {
            if (y < 100) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - 60;
            }

            page.drawText(entry.date, { x: 50, y, size: 12, font: boldFont, color: rgb(0.2, 0.2, 0.8) });
            y -= 18;

            const contentText = entry.content || '(Photo / Audio note)';
            const lines = contentText.split('\n');
            for (const line of lines) {
                // simple wrap at 80 chars
                const chunk = line.slice(0, 80);
                page.drawText(chunk, { x: 50, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
                y -= 14;
            }

            if (entry.media_items?.length) {
                page.drawText(`[Attachments: ${entry.media_items.length} media file(s)]`, {
                    x: 50,
                    y,
                    size: 9,
                    font,
                    color: rgb(0.5, 0.5, 0.5),
                });
                y -= 14;
            }

            y -= 16; // spacing between entries
        }

        const pdfBytes = await pdfDoc.save();
        const fileName = `diary-${userId}-${targetMonthStr}-${Date.now()}.pdf`;
        const filePath = `exports/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
            .from('journal-media-private')
            .upload(filePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

        if (uploadErr) {
            console.error('[PDF Storage Upload Error]:', uploadErr);
            return null;
        }

        // Generate Signed URL valid for 7 days
        const { data: signed } = await supabase.storage
            .from('journal-media-private')
            .createSignedUrl(filePath, 60 * 60 * 24 * 7);

        return signed?.signedUrl || null;
    } catch (err) {
        console.error('[PDF Generation Exception]:', err);
        return null;
    }
}

// ==========================================
// Main Webhook Handler
// ==========================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. GET: Webhook Challenge Verification from Meta Console
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Cryptographic HMAC-SHA256 Signature Verification
    if (WHATSAPP_APP_SECRET) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature) {
            console.warn('[WhatsApp Webhook] Missing x-hub-signature-256');
            return res.status(403).json({ error: 'Missing signature' });
        }
        const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const expectedSig = 'sha256=' + createHmac('sha256', WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
        if (signature !== expectedSig) {
            console.error('[WhatsApp Webhook] Invalid signature');
            return res.status(403).json({ error: 'Invalid signature' });
        }
    }

    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];

    // Status updates (delivered, read) or empty pings - acknowledge immediately
    if (!message) {
        return res.status(200).json({ status: 'ok' });
    }

    const messageId = message.id;
    const senderPhone = message.from; // e.g. "919876543210"

    // 3. Idempotency Check (prevent duplicate processing on Meta retries)
    if (messageId) {
        const { data: existingMsg } = await supabase
            .from('whatsapp_processed_messages')
            .select('id')
            .eq('id', messageId)
            .single();

        if (existingMsg) {
            return res.status(200).json({ status: 'already_processed' });
        }

        // Record message ID as processed
        await supabase
            .from('whatsapp_processed_messages')
            .insert({ id: messageId });
    }

    // 4. One-Time Pairing Check: "LINK 123456"
    const textBody = message.text?.body?.trim() || '';
    const linkMatch = textBody.match(/^LINK\s+([0-9]{6})$/i);

    if (linkMatch) {
        const pairCode = linkMatch[1];
        const nowIso = new Date().toISOString();

        const { data: userSettings, error: pairErr } = await supabase
            .from('user_settings')
            .select('user_id, whatsapp_phone, whatsapp_pair_expires_at')
            .eq('whatsapp_pair_code', pairCode)
            .gt('whatsapp_pair_expires_at', nowIso)
            .single();

        if (pairErr || !userSettings) {
            await sendTextMessage(
                senderPhone,
                "⚠️ That pairing code is invalid or has expired.\n\nPlease open OneLine Settings and click 'Connect WhatsApp' to get a fresh 6-digit code."
            );
            return res.status(200).json({ status: 'pair_failed' });
        }

        // Successfully pair phone to user
        await supabase
            .from('user_settings')
            .update({
                whatsapp_phone: senderPhone,
                whatsapp_pair_code: null,
                whatsapp_pair_expires_at: null,
            })
            .eq('user_id', userSettings.user_id);

        await sendTextMessage(
            senderPhone,
            "🎉 Connected to your OneLine diary!\n\nYou're all set. Anything you send here—thoughts, photos, or voice notes—becomes part of your private diary."
        );
        await sendMainMenu(senderPhone);
        return res.status(200).json({ status: 'paired' });
    }

    // 5. Look up User by Phone Number
    const { data: user, error: userErr } = await supabase
        .from('user_settings')
        .select('*')
        .eq('whatsapp_phone', senderPhone)
        .single();

    if (userErr || !user) {
        await sendTextMessage(
            senderPhone,
            "Hi there! 👋 Your WhatsApp number isn't connected to a OneLine account yet.\n\nOpen your OneLine app on your phone or computer, tap Settings, and click 'Connect WhatsApp' to start."
        );
        return res.status(200).json({ status: 'unregistered' });
    }

    const userId = user.user_id;
    const tz = user.timezone || 'Asia/Kolkata';
    const { todayStr, yesterdayStr, todayFriendly, yesterdayFriendly } = getDatesForTimezone(tz);

    // Check pending action (e.g. write_yesterday, replace_today)
    let isYesterday = false;
    let isReplacing = false;

    if (user.whatsapp_pending_action && user.whatsapp_pending_expires_at) {
        const pendingExpired = new Date(user.whatsapp_pending_expires_at).getTime() < Date.now();
        if (!pendingExpired) {
            if (user.whatsapp_pending_action === 'write_yesterday') isYesterday = true;
            if (user.whatsapp_pending_action === 'replace_today') isReplacing = true;
        }
        // Clear pending action
        await supabase
            .from('user_settings')
            .update({ whatsapp_pending_action: null, whatsapp_pending_expires_at: null })
            .eq('user_id', userId);
    }

    const targetDate = isYesterday ? yesterdayStr : todayStr;
    const targetFriendly = isYesterday ? yesterdayFriendly : todayFriendly;

    // 6. Handle Interactive Clicks (Menu & Buttons)
    if (message.type === 'interactive') {
        const interactive = message.interactive;
        const actionId = interactive?.list_reply?.id || interactive?.button_reply?.id;

        switch (actionId) {
            case 'act_add_today':
            case 'btn_write_now':
                await sendTextMessage(
                    senderPhone,
                    "✍️ Just reply right here with any thought, photo, or voice note. I'll add it straight to today's diary!"
                );
                break;

            case 'act_replace_today':
                await supabase
                    .from('user_settings')
                    .update({
                        whatsapp_pending_action: 'replace_today',
                        whatsapp_pending_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    })
                    .eq('user_id', userId);
                await sendTextMessage(
                    senderPhone,
                    "🔄 Ready! Whatever you send next will erase today's previous text and start a fresh note for today."
                );
                break;

            case 'act_write_yesterday':
                await supabase
                    .from('user_settings')
                    .update({
                        whatsapp_pending_action: 'write_yesterday',
                        whatsapp_pending_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    })
                    .eq('user_id', userId);
                await sendTextMessage(
                    senderPhone,
                    `Writing for Yesterday (${yesterdayFriendly}):\n\nJust reply with what happened yesterday, and I will place it safely on yesterday's page!`
                );
                break;

            case 'act_idea_prompt':
            case 'btn_idea_prompt': {
                const prompt = await callGemini(
                    "Give one short, delightful, friendly daily journaling prompt for an ordinary person reflecting on their day. Keep it simple and warm. Max 20 words."
                );
                const question = prompt || "What was the happiest or most surprising moment of your day?";
                await sendTextMessage(
                    senderPhone,
                    `💡 Today's Idea:\n"${question}"\n\nJust reply to this message with your answer, or drop a voice memo!`
                );
                break;
            }

            case 'act_read_today': {
                const { data: entryData } = await supabase
                    .from('entries')
                    .select('content, media_items')
                    .eq('user_id', userId)
                    .eq('date', todayStr)
                    .single();

                if (!entryData || (!entryData.content && !entryData.media_items?.length)) {
                    await sendTextMessage(
                        senderPhone,
                        `📖 Today (${todayFriendly}):\n\nYour page is currently empty! Send me a message or photo to start today's story.`
                    );
                } else {
                    const mediaNote = entryData.media_items?.length ? `\n\n📸 [${entryData.media_items.length} attachment(s)]` : '';
                    await sendTextMessage(
                        senderPhone,
                        `📖 Today (${todayFriendly}):\n\n"${entryData.content || ''}"${mediaNote}`
                    );
                }
                await sendMainMenu(senderPhone);
                break;
            }

            case 'act_read_yesterday': {
                const { data: entryData } = await supabase
                    .from('entries')
                    .select('content, media_items')
                    .eq('user_id', userId)
                    .eq('date', yesterdayStr)
                    .single();

                if (!entryData || (!entryData.content && !entryData.media_items?.length)) {
                    await sendTextMessage(
                        senderPhone,
                        `📖 Yesterday (${yesterdayFriendly}):\n\nNo note was saved. Tap 'Write for Yesterday' if you'd like to add one!`
                    );
                } else {
                    await sendTextMessage(
                        senderPhone,
                        `📖 Yesterday (${yesterdayFriendly}):\n\n"${entryData.content || ''}"`
                    );
                }
                await sendMainMenu(senderPhone);
                break;
            }

            case 'act_past_memory': {
                // Find entry on same day in previous months/years
                const dayMonth = todayStr.slice(5); // "-MM-DD"
                const { data: memories } = await supabase
                    .from('entries')
                    .select('date, content')
                    .eq('user_id', userId)
                    .neq('date', todayStr)
                    .like('date', `%${dayMonth}`)
                    .order('date', { ascending: false })
                    .limit(1);

                if (memories && memories.length > 0) {
                    await sendTextMessage(
                        senderPhone,
                        `🕰️ Time Machine (${memories[0].date}):\n\n"${memories[0].content}"\n\nLook how far you've come!`
                    );
                } else {
                    await sendTextMessage(
                        senderPhone,
                        "🕰️ Time Machine:\n\nNo past entries on this calendar day yet. Keep writing every day to build your time capsule!"
                    );
                }
                break;
            }

            case 'act_week_summary': {
                const { data: recentEntries } = await supabase
                    .from('entries')
                    .select('date, content')
                    .eq('user_id', userId)
                    .order('date', { ascending: false })
                    .limit(7);

                if (!recentEntries || recentEntries.length < 2) {
                    await sendTextMessage(
                        senderPhone,
                        "✨ Write at least 2 entries this week and I'll generate a beautiful 3-sentence summary of your week!"
                    );
                } else {
                    const textLines = recentEntries.map(e => `${e.date}: ${e.content}`).join('\n');
                    const summary = await callGemini(
                        `Summarize these journal entries into exactly 3 warm, uplifting, simple sentences highlighting what they felt and achieved, followed by 'Overall mood: [one or two words with an icon]':\n\n${textLines}`
                    );
                    await sendTextMessage(senderPhone, `✨ Your Week in 3 Sentences:\n\n${summary}`);
                }
                break;
            }

            case 'act_streak': {
                const streak = await calculateStreak(userId, todayStr);
                const emoji = streak >= 7 ? '🔥' : '✨';
                await sendTextMessage(
                    senderPhone,
                    `${emoji} You're on a ${streak}-day streak!\n\nConsistency is how great memories are made. Keep it up!`
                );
                break;
            }

            case 'act_download_pdf': {
                await sendTextMessage(senderPhone, '⏳ Creating your diary book PDF for this month... Please hold on!');
                const currentMonth = todayStr.slice(0, 7); // yyyy-MM
                const pdfUrl = await generateMonthlyDiaryPdf(userId, currentMonth);

                if (pdfUrl) {
                    await sendDocumentMessage(
                        senderPhone,
                        pdfUrl,
                        `OneLine_Diary_${currentMonth}.pdf`,
                        `📖 Here is your OneLine Diary book for ${currentMonth}!`
                    );
                } else {
                    await sendTextMessage(
                        senderPhone,
                        "Couldn't find any entries for this month to create a book. Write a few notes first!"
                    );
                }
                break;
            }

            case 'act_change_reminder': {
                await sendInteractiveList(
                    senderPhone,
                    "When would you like OneLine to check in with you each evening?",
                    "Pick a Time",
                    [
                        {
                            title: 'Reminder Times',
                            rows: [
                                { id: 'remind_2000', title: '8:00 PM', description: 'After dinner relaxation' },
                                { id: 'remind_2100', title: '9:00 PM', description: 'Bedtime reflection (Recommended)' },
                                { id: 'remind_2200', title: '10:00 PM', description: 'Late night winding down' },
                                { id: 'remind_off', title: 'Turn Off Reminders', description: 'Pause all reminder messages' },
                            ],
                        },
                    ]
                );
                break;
            }

            case 'remind_2000':
            case 'remind_2100':
            case 'remind_2200':
            case 'remind_off': {
                const isOff = actionId === 'remind_off';
                const timeMap: Record<string, string> = {
                    remind_2000: '20:00',
                    remind_2100: '21:00',
                    remind_2200: '22:00',
                };
                await supabase
                    .from('user_settings')
                    .update({
                        reminder_enabled: !isOff,
                        reminder_time: isOff ? null : timeMap[actionId],
                    })
                    .eq('user_id', userId);

                await sendTextMessage(
                    senderPhone,
                    isOff
                        ? '✓ Daily reminders turned off. You can re-enable anytime.'
                        : `✓ Reminder set for ${actionId === 'remind_2000' ? '8:00 PM' : actionId === 'remind_2100' ? '9:00 PM' : '10:00 PM'} every night!`
                );
                break;
            }

            case 'act_unlink': {
                await supabase
                    .from('user_settings')
                    .update({ whatsapp_phone: null })
                    .eq('user_id', userId);
                await sendTextMessage(
                    senderPhone,
                    '✓ Your WhatsApp has been disconnected from OneLine. Reconnect anytime in the app Settings.'
                );
                break;
            }

            case 'btn_snooze_1h':
                await sendTextMessage(senderPhone, '⏰ Snoozed! I will remind you again in 1 hour.');
                break;

            default:
                await sendMainMenu(senderPhone);
                break;
        }
        return res.status(200).json({ status: 'interactive_processed' });
    }

    // 7. Handle Text Journal Messages
    if (message.type === 'text') {
        const text = message.text?.body?.trim();
        if (!text) return res.status(200).json({ status: 'empty_text' });

        // Trigger menu on greetings or help keywords
        if (['hi', 'hello', 'hey', 'menu', 'help', 'options', 'start'].includes(text.toLowerCase())) {
            await sendMainMenu(senderPhone);
            return res.status(200).json({ status: 'menu_sent' });
        }

        // Fetch existing entry for target date
        const { data: existing } = await supabase
            .from('entries')
            .select('content, media_items')
            .eq('user_id', userId)
            .eq('date', targetDate)
            .single();

        let updatedContent = text;
        if (!isReplacing && existing?.content) {
            updatedContent = `${existing.content}\n\n${text}`;
        }

        await supabase
            .from('entries')
            .upsert({
                user_id: userId,
                date: targetDate,
                content: updatedContent,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,date' });

        const streak = await calculateStreak(userId, todayStr);
        await sendTextMessage(
            senderPhone,
            `✓ Saved to ${isYesterday ? "yesterday's" : "today's"} diary! (${targetFriendly})\n\n"${text}"\n\n🔥 You're on a ${streak}-day streak!`
        );
        return res.status(200).json({ status: 'text_saved' });
    }

    // 8. Handle Photo Journal Messages
    if (message.type === 'image') {
        const imageId = message.image?.id;
        const caption = message.image?.caption || '';

        if (!imageId) return res.status(200).json({ status: 'no_image_id' });

        try {
            // Get Image URL from Meta Graph API
            const metaMediaResp = await fetch(`https://graph.facebook.com/v19.0/${imageId}`, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
            });
            const metaMediaData = await metaMediaResp.json();
            const downloadUrl = metaMediaData?.url;

            if (downloadUrl) {
                // Download image buffer
                const imgBufferResp = await fetch(downloadUrl, {
                    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
                });
                const imgArrayBuffer = await imgBufferResp.arrayBuffer();
                const buffer = Buffer.from(imgArrayBuffer);

                const storagePath = `photos/${userId}/${targetDate}/${imageId}.jpg`;
                await supabase.storage
                    .from('journal-media-private')
                    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });

                const { data: signed } = await supabase.storage
                    .from('journal-media-private')
                    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

                const photoUrl = signed?.signedUrl || storagePath;

                // Fetch existing entry
                const { data: existing } = await supabase
                    .from('entries')
                    .select('content, media_items')
                    .eq('user_id', userId)
                    .eq('date', targetDate)
                    .single();

                const existingMedia = existing?.media_items || [];
                const newMedia = [...existingMedia, { type: 'image', url: photoUrl }];

                let updatedContent = existing?.content || '';
                if (caption) {
                    updatedContent = updatedContent ? `${updatedContent}\n\n${caption}` : caption;
                }

                await supabase
                    .from('entries')
                    .upsert({
                        user_id: userId,
                        date: targetDate,
                        content: updatedContent,
                        media_items: newMedia,
                        image_url: photoUrl,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,date' });

                await sendTextMessage(
                    senderPhone,
                    `✓ Photo anchored to ${isYesterday ? "yesterday's" : "today's"} diary! 📸${caption ? `\n\n"${caption}"` : ''}`
                );
            }
        } catch (mediaErr) {
            console.error('[Media Process Error]:', mediaErr);
            await sendTextMessage(senderPhone, "Couldn't download that photo, but I've noted your message!");
        }
        return res.status(200).json({ status: 'image_saved' });
    }

    // 9. Handle Voice Memo Messages
    if (message.type === 'audio' || message.type === 'voice') {
        const audioId = message.audio?.id || message.voice?.id;
        if (!audioId) return res.status(200).json({ status: 'no_audio_id' });

        try {
            const metaMediaResp = await fetch(`https://graph.facebook.com/v19.0/${audioId}`, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
            });
            const metaMediaData = await metaMediaResp.json();
            const downloadUrl = metaMediaData?.url;

            if (downloadUrl) {
                const audioBufferResp = await fetch(downloadUrl, {
                    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
                });
                const audioArrayBuffer = await audioBufferResp.arrayBuffer();
                const buffer = Buffer.from(audioArrayBuffer);
                const base64Audio = buffer.toString('base64');

                const storagePath = `audio/${userId}/${targetDate}/${audioId}.ogg`;
                await supabase.storage
                    .from('journal-media-private')
                    .upload(storagePath, buffer, { contentType: 'audio/ogg', upsert: true });

                const { data: signed } = await supabase.storage
                    .from('journal-media-private')
                    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

                const audioUrl = signed?.signedUrl || storagePath;

                // Transcribe audio using Gemini Flash
                const transcription = await callGemini(
                    "Please transcribe this voice recording verbatim. Return only the spoken words without extra commentary.",
                    { mimeType: 'audio/ogg', base64: base64Audio }
                );

                const { data: existing } = await supabase
                    .from('entries')
                    .select('content, media_items')
                    .eq('user_id', userId)
                    .eq('date', targetDate)
                    .single();

                const existingMedia = existing?.media_items || [];
                const newMedia = [...existingMedia, { type: 'audio', url: audioUrl }];

                let updatedContent = existing?.content || '';
                if (transcription) {
                    updatedContent = updatedContent ? `${updatedContent}\n\n${transcription}` : transcription;
                }

                await supabase
                    .from('entries')
                    .upsert({
                        user_id: userId,
                        date: targetDate,
                        content: updatedContent,
                        media_items: newMedia,
                        audio_url: audioUrl,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,date' });

                await sendTextMessage(
                    senderPhone,
                    `✓ Listened and saved to ${isYesterday ? "yesterday's" : "today's"} diary! 🎙️\n\n"${transcription || 'Audio memo recorded.'}"`
                );
            }
        } catch (audioErr) {
            console.error('[Audio Process Error]:', audioErr);
            await sendTextMessage(senderPhone, "Couldn't process that voice memo. Please try again!");
        }
        return res.status(200).json({ status: 'audio_saved' });
    }

    return res.status(200).json({ status: 'unhandled_type' });
}
