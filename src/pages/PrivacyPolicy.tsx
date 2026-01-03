import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-indigo-500/30 font-light">
            <nav className="fixed w-full z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
                    <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                        <ArrowLeft size={16} /> Back to OneLine
                    </Link>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 pt-32 pb-20">
                <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
                <p className="text-zinc-500 mb-12 text-sm">Last updated: January 3, 2025</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">1. The "Zero-Knowledge" Philosophy</h2>
                        <p>
                            OneLine is built on a simple principle: <strong>Your thoughts are yours.</strong> We do not sell your data. We do not use your journal entries to train public AI models. We treat your data as a liability, not an asset—meaning we want to know as little as possible.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">2. Data We Collect</h2>
                        <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                            <li><strong>Account Information:</strong> Email address (for authentication via Supabase).</li>
                            <li><strong>Content:</strong> The journal entries, images, and voice notes you explicitly create.</li>
                            <li><strong>Usage Data:</strong> Basic timestamps of when you log in (to ensure service reliability).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">3. AI & Third Parties</h2>
                        <p className="mb-4">
                            We use <strong>Groq</strong> (powered by Llama 3 models) to generate your weekly reflections.
                        </p>
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-sm">
                            <h3 className="text-white font-medium mb-2">How AI Processing Works:</h3>
                            <ol className="list-decimal pl-5 space-y-2 text-zinc-400">
                                <li>Your encrypted text is sent securely to our edge function.</li>
                                <li>The edge function strips personal identifiers where possible.</li>
                                <li>The text is sent to the LLM (Large Language Model) provider for inference <strong>only</strong>.</li>
                                <li>The LLM provider <strong>does not</strong> use your data to train their models.</li>
                                <li>The response (your reflection) is returned to you and saved in our database.</li>
                            </ol>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">4. Security</h2>
                        <p>
                            All data is encrypted in transit (TLS 1.2+) and at rest (AES-256). We use Row Level Security (RLS) in our database to ensure that only your authenticated user ID can access your specific rows.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">5. Your Rights</h2>
                        <p>
                            You have the right to request a full export of your data (JSON format) or a complete deletion of your account at any time. Features for these are available directly in the app settings.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
