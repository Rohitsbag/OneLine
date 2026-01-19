// MCP Server Edge Function
// Handles SSE connections for AI agent tool access

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// Types
// ============================================================

interface MCPRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

interface Session {
    userId: string;
    scopes: string[];
    keyId: string;
    createdAt: number;
    lastValidated: number;
    toolCalls: number;
}

// ============================================================
// AI Guardrails
// ============================================================

const GUARDRAILS = {
    MAX_TOOL_CALLS_PER_SESSION: 20,
    SESSION_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
    REVALIDATION_INTERVAL_MS: 30 * 1000, // 30 seconds
    SUMMARIZE_MAX_DAYS: 30,
    SUMMARIZE_MAX_TOKENS: 4096,
    SUMMARIZE_COST_CEILING: 0.05, // $0.05
};

// ============================================================
// Tool Definitions
// ============================================================

const TOOLS = {
    search_journal: {
        name: 'search_journal',
        description: 'Search journal entries using full-text search',
        risk: 'low',
        requiredScope: 'read:entries',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Max results (1-10)', default: 5 },
            },
            required: ['query'],
        },
    },
    get_entry: {
        name: 'get_entry',
        description: 'Get a specific journal entry by date',
        risk: 'low',
        requiredScope: 'read:entries',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            },
            required: ['date'],
        },
    },
    append_entry: {
        name: 'append_entry',
        description: 'Append content to a journal entry',
        risk: 'high',
        requiredScope: 'write:entries',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                content: { type: 'string', description: 'Content to append (max 5KB)' },
            },
            required: ['date', 'content'],
        },
    },
    summarize_period: {
        name: 'summarize_period',
        description: 'Generate AI summary of entries over a period',
        risk: 'medium',
        requiredScope: 'read:insights',
        inputSchema: {
            type: 'object',
            properties: {
                start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
                end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
            },
            required: ['start_date', 'end_date'],
        },
    },
};

// ============================================================
// Session Management
// ============================================================

const sessions = new Map<string, Session>();

function createSession(userId: string, scopes: string[], keyId: string): string {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
        userId,
        scopes,
        keyId,
        createdAt: Date.now(),
        lastValidated: Date.now(),
        toolCalls: 0,
    });
    return sessionId;
}

function getSession(sessionId: string): Session | null {
    const session = sessions.get(sessionId);
    if (!session) return null;

    // Check session timeout
    if (Date.now() - session.createdAt > GUARDRAILS.SESSION_TIMEOUT_MS) {
        sessions.delete(sessionId);
        return null;
    }

    return session;
}

// ============================================================
// XSS Sanitization
// ============================================================

function sanitizeContent(content: string): string {
    return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>.*?<\/object>/gi, '')
        .replace(/<embed[^>]*>/gi, '');
}

// ============================================================
// Key Validation
// ============================================================

async function validateApiKey(
    supabase: ReturnType<typeof createClient>,
    authHeader: string | null
): Promise<{ userId: string; scopes: string[]; keyId: string } | null> {
    if (!authHeader?.startsWith('Bearer oline_')) return null;

    const token = authHeader.slice(7);
    const dotIndex = token.indexOf('.', 6);
    if (dotIndex === -1) return null;

    const keyId = token.slice(6, dotIndex);
    const secret = token.slice(dotIndex + 1);

    if (!keyId || !secret || secret.length < 32) return null;

    // Use direct query instead of RPC for reliability
    const { data: keyData, error } = await supabase
        .from('user_api_keys')
        .select('user_id, scopes, revoked_at, expires_at')
        .eq('key_id', keyId)
        .single();

    if (error || !keyData) return null;
    if (keyData.revoked_at) return null;
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return null;

    return { userId: keyData.user_id, scopes: keyData.scopes || ['read:entries'], keyId };
}

// ============================================================
// Tool Executors
// ============================================================

async function executeSearchJournal(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    params: { query: string; limit?: number }
): Promise<unknown> {
    const { data, error } = await supabase.rpc('api_search_journal', {
        p_user_id: userId,
        p_query: params.query,
        p_limit: Math.min(params.limit || 5, 10),
    });

    if (error) throw new Error(error.message);
    return { entries: data };
}

async function executeGetEntry(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    params: { date: string }
): Promise<unknown> {
    const { data, error } = await supabase.rpc('api_get_entries', {
        p_user_id: userId,
        p_start_date: params.date,
        p_end_date: params.date,
        p_limit: 1,
    });

    if (error) throw new Error(error.message);
    return { entry: data?.[0] || null };
}

async function executeAppendEntry(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    params: { date: string; content: string }
): Promise<unknown> {
    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeContent(params.content);

    // Enforce 5KB limit for append
    if (new TextEncoder().encode(sanitizedContent).length > 5120) {
        throw new Error('Content exceeds 5KB limit for append_entry');
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
        throw new Error('Invalid date format. Expected: YYYY-MM-DD');
    }

    // Get existing entry first
    const { data: existing } = await supabase.rpc('api_get_entries', {
        p_user_id: userId,
        p_start_date: params.date,
        p_end_date: params.date,
        p_limit: 1,
    });

    const existingContent = existing?.[0]?.content || '';
    const newContent = existingContent ? `${existingContent}\n\n${sanitizedContent}` : sanitizedContent;

    const { data, error } = await supabase.rpc('api_upsert_entry', {
        p_user_id: userId,
        p_date: params.date,
        p_content: newContent,
    });

    if (error) throw new Error(error.message);
    return { entry: data?.[0] };
}

async function executeSummarizePeriod(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    params: { start_date: string; end_date: string }
): Promise<unknown> {
    const start = new Date(params.start_date);
    const end = new Date(params.end_date);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > GUARDRAILS.SUMMARIZE_MAX_DAYS) {
        throw new Error(`Period cannot exceed ${GUARDRAILS.SUMMARIZE_MAX_DAYS} days`);
    }

    const { data, error } = await supabase.rpc('api_get_entries', {
        p_user_id: userId,
        p_start_date: params.start_date,
        p_end_date: params.end_date,
        p_limit: 100,
    });

    if (error) throw new Error(error.message);

    // For now, return entries - full AI summarization would require Gemini API integration
    return {
        period: { start: params.start_date, end: params.end_date },
        entry_count: data?.length || 0,
        entries: data,
        note: 'AI summarization requires additional Gemini API integration',
    };
}

// ============================================================
// MCP Protocol Handler
// ============================================================

async function handleMCPRequest(
    supabase: ReturnType<typeof createClient>,
    session: Session,
    request: MCPRequest
): Promise<MCPResponse> {
    const baseResponse = { jsonrpc: '2.0' as const, id: request.id };

    // Initialize
    if (request.method === 'initialize') {
        return {
            ...baseResponse,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'oneline-mcp', version: '1.0.0' },
            },
        };
    }

    // List tools
    if (request.method === 'tools/list') {
        const availableTools = Object.values(TOOLS).filter(
            (tool) => session.scopes.includes(tool.requiredScope)
        );
        return {
            ...baseResponse,
            result: { tools: availableTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
        };
    }

    // Call tool
    if (request.method === 'tools/call') {
        const toolName = request.params?.name as string;
        const toolArgs = request.params?.arguments as Record<string, unknown>;

        const tool = TOOLS[toolName as keyof typeof TOOLS];
        if (!tool) {
            return { ...baseResponse, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
        }

        // Check scope
        if (!session.scopes.includes(tool.requiredScope)) {
            return { ...baseResponse, error: { code: -32600, message: `Missing scope: ${tool.requiredScope}` } };
        }

        // Check guardrails
        session.toolCalls++;
        if (session.toolCalls > GUARDRAILS.MAX_TOOL_CALLS_PER_SESSION) {
            return { ...baseResponse, error: { code: -32000, message: 'Tool call limit exceeded for this session' } };
        }

        try {
            let result: unknown;
            switch (toolName) {
                case 'search_journal':
                    result = await executeSearchJournal(supabase, session.userId, toolArgs as { query: string; limit?: number });
                    break;
                case 'get_entry':
                    result = await executeGetEntry(supabase, session.userId, toolArgs as { date: string });
                    break;
                case 'append_entry':
                    result = await executeAppendEntry(supabase, session.userId, toolArgs as { date: string; content: string });
                    break;
                case 'summarize_period':
                    result = await executeSummarizePeriod(supabase, session.userId, toolArgs as { start_date: string; end_date: string });
                    break;
                default:
                    return { ...baseResponse, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
            }
            return { ...baseResponse, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } };
        } catch (err) {
            return { ...baseResponse, error: { code: -32000, message: (err as Error).message } };
        }
    }

    return { ...baseResponse, error: { code: -32601, message: `Unknown method: ${request.method}` } };
}

// ============================================================
// SSE Handler
// ============================================================

serve(async (req: Request) => {
    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate key
    const auth = await validateApiKey(supabase, req.headers.get('Authorization'));
    if (!auth) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/mcp-server', '');

    // SSE endpoint
    if (path === '/sse' && req.method === 'GET') {
        const sessionId = createSession(auth.userId, auth.scopes, auth.keyId);

        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();

                // Send endpoint info
                controller.enqueue(encoder.encode(`event: endpoint\ndata: /mcp-server/message?session_id=${sessionId}\n\n`));

                // Heartbeat every 30s
                const interval = setInterval(async () => {
                    const session = getSession(sessionId);
                    if (!session) {
                        controller.enqueue(encoder.encode('event: session_expired\ndata: {}\n\n'));
                        clearInterval(interval);
                        controller.close();
                        return;
                    }

                    // Revalidate key periodically
                    if (Date.now() - session.lastValidated > GUARDRAILS.REVALIDATION_INTERVAL_MS) {
                        const stillValid = await validateApiKey(supabase, req.headers.get('Authorization'));
                        if (!stillValid) {
                            controller.enqueue(encoder.encode('event: session_revoked\ndata: {}\n\n'));
                            sessions.delete(sessionId);
                            clearInterval(interval);
                            controller.close();
                            return;
                        }
                        session.lastValidated = Date.now();
                    }

                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                }, GUARDRAILS.REVALIDATION_INTERVAL_MS);
            },
        });

        return new Response(stream, {
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    // Message endpoint
    if (path === '/message' && req.method === 'POST') {
        const sessionId = url.searchParams.get('session_id');
        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Missing session_id' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const session = getSession(sessionId);
        if (!session) {
            return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const request = await req.json() as MCPRequest;
        const response = await handleMCPRequest(supabase, session, request);

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
});
