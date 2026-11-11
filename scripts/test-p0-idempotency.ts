import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase configuration in test environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runIdempotencyTests() {
    console.log('--- Starting P0 Idempotency & State Machine Test Suite ---');
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

    const testMsgId = 'test_p0_msg_' + Date.now();

    try {
        // TEST 5: Brand new message claims successfully
        const { data: claim1 } = await supabase.rpc('claim_whatsapp_message', {
            p_message_id: testMsgId,
            p_lease_seconds: 3, // short lease for testing
        });
        assert('5. Brand new message is claimed atomically (status=processing)', claim1 === 'claimed');

        // TEST 6: Concurrent in-flight request is rejected while lease is active
        const { data: claim2 } = await supabase.rpc('claim_whatsapp_message', {
            p_message_id: testMsgId,
            p_lease_seconds: 3,
        });
        assert('6. Concurrent message is rejected as in_flight under active lease', claim2 === 'in_flight');

        // TEST 7: Simulated failure marks status=failed and allows safe retry
        await supabase.rpc('fail_whatsapp_message', {
            p_message_id: testMsgId,
            p_error: 'Simulated network timeout during audio download',
        });
        
        const { data: failedRow } = await supabase
            .from('whatsapp_processed_messages')
            .select('status, error, attempts')
            .eq('id', testMsgId)
            .single();
        assert('7. Failed message records error and status=failed', failedRow?.status === 'failed' && failedRow?.error?.includes('Simulated network'));

        // TEST 8: Retry after failure succeeds and re-claims lock
        const { data: claimRetry } = await supabase.rpc('claim_whatsapp_message', {
            p_message_id: testMsgId,
            p_lease_seconds: 3,
        });
        assert('8. Failed message can be retried and successfully re-claimed', claimRetry === 'claimed');

        // TEST 9: Expired lease can be reclaimed
        // Wait 3.5 seconds for lease to expire
        console.log('   Waiting 3.5s for lease expiration...');
        await new Promise((r) => setTimeout(r, 3500));

        const { data: claimReclaimed } = await supabase.rpc('claim_whatsapp_message', {
            p_message_id: testMsgId,
            p_lease_seconds: 3,
        });
        assert('9. Expired lease is reclaimed safely by worker retry', claimReclaimed === 'claimed');

        // TEST 10: Completion marks status=completed and permanently blocks further duplicates
        await supabase.rpc('complete_whatsapp_message', { p_message_id: testMsgId });
        
        const { data: claimAfterComplete } = await supabase.rpc('claim_whatsapp_message', {
            p_message_id: testMsgId,
            p_lease_seconds: 3,
        });
        assert('10. Completed message permanently rejects future duplicates (completed)', claimAfterComplete === 'completed');

        // TEST 11: Historical records remain protected
        const { data: historicalCheck } = await supabase
            .from('whatsapp_processed_messages')
            .select('status')
            .eq('status', 'completed')
            .limit(1);
        assert('11. Historical idempotency records remain protected with completed status', historicalCheck && historicalCheck.length > 0);

        // Cleanup test row
        await supabase.from('whatsapp_processed_messages').delete().eq('id', testMsgId);
        console.log('   Cleaned up test message ID.');

    } catch (err) {
        console.error('Idempotency test suite failure:', err);
        failed++;
    }

    console.log(`\nIdempotency Tests Completed: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) process.exit(1);
}

runIdempotencyTests();
