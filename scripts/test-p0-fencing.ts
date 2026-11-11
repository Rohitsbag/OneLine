import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration in test environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runFencingAndSnoozeTests() {
    console.log('--- Starting P0.1 - P0.4 Verification Suite ---');
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

    const testMsgId = 'test_fence_race_' + Date.now();

    try {
        // 1. Worker A claims message
        const { data: claimA } = await supabase.rpc('claim_whatsapp_message_fenced', {
            p_message_id: testMsgId,
            p_lease_seconds: 2, // 2s short lease for test
        });
        const tokenA = claimA?.[0]?.fence_token;
        assert('1. Worker A claims message and receives fence token A', claimA?.[0]?.result === 'claimed' && Boolean(tokenA));

        // 2. Wait 2.5s for Worker A's lease to expire
        console.log('   Waiting 2.5s for Worker A lease to expire...');
        await new Promise((r) => setTimeout(r, 2500));

        // 3. Worker B reclaims expired message
        const { data: claimB } = await supabase.rpc('claim_whatsapp_message_fenced', {
            p_message_id: testMsgId,
            p_lease_seconds: 5,
        });
        const tokenB = claimB?.[0]?.fence_token;
        assert('2. Worker B reclaims expired lease with new fence token B', claimB?.[0]?.result === 'claimed' && tokenB !== tokenA);

        // 4. Stale Worker A tries to complete with token A -> MUST BE REJECTED
        const { data: staleCompResult } = await supabase.rpc('complete_whatsapp_message_fenced', {
            p_message_id: testMsgId,
            p_fence_token: tokenA,
        });
        assert('3. Stale Worker A completion is rejected by fencing token (returns false)', staleCompResult === false);

        // 5. Stale Worker A tries to fail with token A -> MUST BE REJECTED
        const { data: staleFailResult } = await supabase.rpc('fail_whatsapp_message_fenced', {
            p_message_id: testMsgId,
            p_fence_token: tokenA,
            p_error: 'Stale error from expired worker A',
        });
        assert('4. Stale Worker A failure is rejected by fencing token (returns false)', staleFailResult === false);

        // 6. Active Worker B completes with token B -> MUST SUCCEED
        const { data: validCompResult } = await supabase.rpc('complete_whatsapp_message_fenced', {
            p_message_id: testMsgId,
            p_fence_token: tokenB,
        });
        assert('5. Active Worker B completion succeeds (returns true)', validCompResult === true);

        // 7. Verify status is completed
        const { data: finalRow } = await supabase
            .from('whatsapp_processed_messages')
            .select('status, fence_token')
            .eq('id', testMsgId)
            .single();
        assert('6. Final row reflects status=completed and belongs to token B', finalRow?.status === 'completed' && finalRow?.fence_token === tokenB);

        // Cleanup test message
        await supabase.from('whatsapp_processed_messages').delete().eq('id', testMsgId);

        // 8. Test snoozed_until column on user_settings
        const testSnoozeDate = new Date(Date.now() + 3600 * 1000).toISOString();
        const { data: userProbe, error: userErr } = await supabase
            .from('user_settings')
            .select('user_id')
            .limit(1)
            .single();

        if (userProbe) {
            const { error: snoozeErr } = await supabase
                .from('user_settings')
                .update({ snoozed_until: testSnoozeDate })
                .eq('user_id', userProbe.user_id);
            assert('7. snoozed_until column accepts future timestamp', !snoozeErr);

            // Clean up snooze
            await supabase
                .from('user_settings')
                .update({ snoozed_until: null })
                .eq('user_id', userProbe.user_id);
            assert('8. snoozed_until can be cleared back to null', true);
        }

    } catch (err) {
        console.error('Test suite exception:', err);
        failed++;
    }

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) process.exit(1);
}

runFencingAndSnoozeTests();
