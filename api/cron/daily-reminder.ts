import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendWhatsAppButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
) {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
    const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            }),
        });
    } catch (err) {
        console.error('[Reminder Send Exception]:', err);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Authenticate Cron Caller (Vercel Cron or GitHub Actions secret)
    if (CRON_SECRET) {
        const authHeader = req.headers.authorization;
        const queryKey = req.query.key;
        if (authHeader !== `Bearer ${CRON_SECRET}` && queryKey !== CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        // 2. Fetch users eligible for reminders
        const { data: users, error: userErr } = await supabase
            .from('user_settings')
            .select('user_id, whatsapp_phone, timezone, reminder_enabled, reminder_time, last_reminded_date')
            .eq('reminder_enabled', true)
            .not('whatsapp_phone', 'is', null);

        if (userErr || !users || users.length === 0) {
            return res.status(200).json({ checked: 0, sent: 0, message: 'No eligible users' });
        }

        const now = new Date();
        let sentCount = 0;

        for (const user of users) {
            const tz = user.timezone || 'Asia/Kolkata';
            const reminderTime = user.reminder_time || '21:00'; // HH:mm
            const targetHour = parseInt(reminderTime.split(':')[0], 10);

            // Compute user's local hour and today date string
            const hourFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                hour12: false,
            });
            const currentLocalHour = parseInt(hourFormatter.format(now), 10);

            const dateFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            const todayStr = dateFormatter.format(now);

            // Only trigger if current hour matches target hour and haven't reminded today
            if (currentLocalHour === targetHour && user.last_reminded_date !== todayStr) {
                // Smart Skip: Check if user has already written today
                const { data: entry } = await supabase
                    .from('entries')
                    .select('id, content, media_items')
                    .eq('user_id', user.user_id)
                    .eq('date', todayStr)
                    .single();

                const hasWritten = entry && (entry.content?.trim() || entry.media_items?.length);
                if (hasWritten) {
                    continue; // Skip without spamming
                }

                // Send Interactive Reminder
                await sendWhatsAppButtons(
                    user.whatsapp_phone,
                    "Good evening! 🌙 How was your day? Take 30 seconds to capture one highlight before sleep.",
                    [
                        { id: 'btn_write_now', title: '✍️ Write Now' },
                        { id: 'btn_idea_prompt', title: '💡 Need an Idea?' },
                        { id: 'btn_snooze_1h', title: '⏰ Remind in 1 Hr' },
                    ]
                );

                // Record that reminder was sent for today
                await supabase
                    .from('user_settings')
                    .update({ last_reminded_date: todayStr })
                    .eq('user_id', user.user_id);

                sentCount++;
            }
        }

        return res.status(200).json({ checked: users.length, sent: sentCount, timestamp: new Date().toISOString() });
    } catch (err: any) {
        console.error('[Daily Reminder Cron Exception]:', err);
        return res.status(500).json({ error: err.message || 'Internal error' });
    }
}
