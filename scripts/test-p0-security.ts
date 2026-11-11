import fs from 'fs';
import { createHmac } from 'crypto';

// Parse .env.local manually
if (fs.existsSync('.env.local')) {
    const content = fs.readFileSync('.env.local', 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            if (!process.env[k]) {
                process.env[k] = v;
            }
        }
    }
}

import handler from '../api/whatsapp-webhook';

// Test runner for P0 Security Acceptance Criteria
async function runTests() {
    console.log('--- Starting P0 Security & Idempotency Test Suite ---');
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

    // 1. Mock Request / Response helper
    function createMockPair(method: string, headers: Record<string, string>, bodyBuffer: Buffer) {
        const req: any = Buffer.from(bodyBuffer);
        req.method = method;
        req.headers = headers;
        req[Symbol.asyncIterator] = async function* () {
            yield bodyBuffer;
        };

        let statusCode = 200;
        let responseData: any = null;

        const res: any = {
            status: (code: number) => {
                statusCode = code;
                return res;
            },
            json: (data: any) => {
                responseData = data;
                return res;
            },
            send: (data: any) => {
                responseData = data;
                return res;
            },
        };

        return { req, res, getStatus: () => statusCode, getData: () => responseData };
    }

    const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
    if (!APP_SECRET) {
        console.error('WHATSAPP_APP_SECRET missing in env for testing');
        process.exit(1);
    }

    // TEST 1: Missing signature fails closed with 401
    {
        const body = Buffer.from(JSON.stringify({ test: 'hello' }));
        const { req, res, getStatus } = createMockPair('POST', {}, body);
        await handler(req, res);
        assert('1. Missing webhook secret/signature fails closed (401)', getStatus() === 401);
    }

    // TEST 2: Invalid HMAC signature fails with 401
    {
        const body = Buffer.from(JSON.stringify({ test: 'hello' }));
        const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
        const { req, res, getStatus } = createMockPair('POST', { 'x-hub-signature-256': invalidSig }, body);
        await handler(req, res);
        assert('2. Invalid HMAC request returns HTTP 401', getStatus() === 401);
    }

    // TEST 3: Altered body with valid signature on original body fails (Raw body integrity)
    {
        const originalBody = Buffer.from(JSON.stringify({ test: 'original' }));
        const validSig = 'sha256=' + createHmac('sha256', APP_SECRET).update(originalBody).digest('hex');
        
        // Attacker tampered body
        const tamperedBody = Buffer.from(JSON.stringify({ test: 'tampered' }));
        const { req, res, getStatus } = createMockPair('POST', { 'x-hub-signature-256': validSig }, tamperedBody);
        await handler(req, res);
        assert('3. Tampered payload rejected by raw timing-safe comparison (401)', getStatus() === 401);
    }

    // TEST 4: Valid signature succeeds verification and proceeds
    {
        const validBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));
        const validSig = 'sha256=' + createHmac('sha256', APP_SECRET).update(validBody).digest('hex');
        const { req, res, getStatus, getData } = createMockPair('POST', { 'x-hub-signature-256': validSig }, validBody);
        await handler(req, res);
        assert('4. Valid HMAC signature accepted (200 OK)', getStatus() === 200 && getData()?.status === 'ok');
    }

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Unhandled test runner error:', err);
    process.exit(1);
});
