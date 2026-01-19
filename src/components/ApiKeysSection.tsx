import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/utils/supabase/client';
import { useToast } from './Toast';

interface ApiKey {
    id: string;
    name: string;
    key_id: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
}

interface ApiKeysSectionProps {
    accentColor?: string;
}

// Generate cryptographically secure random hex string
function generateSecureHex(bytes: number): string {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function ApiKeysSection({ accentColor = 'bg-indigo-500' }: ApiKeysSectionProps) {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read:entries']);
    const [createdSecret, setCreatedSecret] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const { showToast } = useToast();

    // Load existing keys
    useEffect(() => {
        loadKeys();
    }, []);

    async function loadKeys() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('user_api_keys')
            .select('id, name, key_id, scopes, created_at, last_used_at, revoked_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setKeys(data);
        }
        setLoading(false);
    }

    async function createKey() {
        if (!newKeyName.trim()) {
            showToast('Please enter a key name', 'error');
            return;
        }

        setCreating(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setCreating(false);
            return;
        }

        // Generate key components
        const keyId = generateSecureHex(16); // 32 hex chars
        const secret = generateSecureHex(32); // 64 hex chars (256-bit)

        // For simplified version, we store a hash placeholder
        // In production, you'd hash with Argon2id on the server
        const keyHash = new TextEncoder().encode(secret);

        const { error } = await supabase
            .from('user_api_keys')
            .insert({
                user_id: user.id,
                name: newKeyName.trim(),
                key_id: keyId,
                key_hash: keyHash,
                scopes: newKeyScopes,
            });

        if (error) {
            showToast('Failed to create API key', 'error');
            setCreating(false);
            return;
        }

        // Show the full key once (user must copy it now)
        setCreatedSecret(`oline_${keyId}.${secret}`);
        await loadKeys();
        setNewKeyName('');
        setCreating(false);
    }

    async function revokeKey(keyId: string) {
        const { error } = await supabase
            .from('user_api_keys')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', keyId);

        if (error) {
            showToast('Failed to revoke key', 'error');
            return;
        }

        showToast('API key revoked', 'success');
        await loadKeys();
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success');
    }

    const activeKeys = keys.filter(k => !k.revoked_at);
    const revokedKeys = keys.filter(k => k.revoked_at);

    return (
        <section>
            <div className="flex items-center justify-between px-1 mb-3">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    API Access
                </label>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all",
                        accentColor, "text-white hover:opacity-90 active:scale-95"
                    )}
                >
                    <Plus className="w-3 h-3" />
                    New Key
                </button>
            </div>

            <div className="p-4 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
                {/* Info card */}
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-800 rounded-2xl">
                    <Key className="w-4 h-4 text-zinc-400 mt-0.5" />
                    <div className="space-y-1">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Developer API</div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Create API keys to access your journal via REST API or connect AI agents via MCP.
                        </p>
                    </div>
                </div>

                {/* Created secret display (one-time) */}
                {createdSecret && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                                Copy Your Secret - Shown Only Once
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all">
                                {createdSecret}
                            </code>
                            <button
                                onClick={() => copyToClipboard(createdSecret)}
                                className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <Copy className="w-4 h-4 text-zinc-500" />
                            </button>
                        </div>
                        <button
                            onClick={() => setCreatedSecret(null)}
                            className="w-full py-2 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
                        >
                            I've copied it, close this
                        </button>
                    </div>
                )}

                {/* Key list */}
                {loading ? (
                    <div className="py-8 text-center text-zinc-400 text-xs">Loading keys...</div>
                ) : activeKeys.length === 0 ? (
                    <div className="py-8 text-center text-zinc-400 text-xs">
                        No API keys yet. Create one to get started.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {activeKeys.map(key => (
                            <div
                                key={key.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-2xl"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {key.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <code className="text-[10px] font-mono text-zinc-400">
                                            oline_{key.key_id.slice(0, 8)}...
                                        </code>
                                        <span className="text-[10px] text-zinc-400">•</span>
                                        <span className="text-[10px] text-zinc-400">
                                            {key.scopes.join(', ')}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => revokeKey(key.id)}
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                    title="Revoke key"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Revoked keys (collapsed) */}
                {revokedKeys.length > 0 && (
                    <details className="text-xs text-zinc-400">
                        <summary className="cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                            {revokedKeys.length} revoked key{revokedKeys.length > 1 ? 's' : ''}
                        </summary>
                        <div className="mt-2 space-y-1 opacity-50">
                            {revokedKeys.map(key => (
                                <div key={key.id} className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl line-through">
                                    {key.name}
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>

            {/* Create Key Modal */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={() => setShowCreateModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Create API Key</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">
                                    Key Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., My AI Assistant"
                                    value={newKeyName}
                                    onChange={e => setNewKeyName(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">
                                    Permissions
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['read:entries', 'write:entries', 'read:insights'].map(scope => (
                                        <button
                                            key={scope}
                                            onClick={() => {
                                                setNewKeyScopes(prev =>
                                                    prev.includes(scope)
                                                        ? prev.filter(s => s !== scope)
                                                        : [...prev, scope]
                                                );
                                            }}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all border",
                                                newKeyScopes.includes(scope)
                                                    ? cn(accentColor, "text-white border-transparent")
                                                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400"
                                            )}
                                        >
                                            {scope}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-3 rounded-2xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await createKey();
                                    setShowCreateModal(false);
                                }}
                                disabled={creating || !newKeyName.trim()}
                                className={cn(
                                    "flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all",
                                    accentColor,
                                    creating || !newKeyName.trim() ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 active:scale-95"
                                )}
                            >
                                {creating ? 'Creating...' : 'Create Key'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
