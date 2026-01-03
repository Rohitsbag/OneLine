import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsOfService() {
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
                <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
                <p className="text-zinc-500 mb-12 text-sm">Last updated: January 3, 2025</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">1. Introduction</h2>
                        <p>
                            By accessing OneLine ("the Service"), you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">2. Use License</h2>
                        <p>
                            OneLine grants you a personal, non-exclusive, non-transferable license to use the software for personal journaling purposes. You must not use the Service for any illegal or unauthorized purpose.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">3. Content Ownership</h2>
                        <p>
                            <strong>You own your content.</strong> We claim no intellectual property rights over the material you provide to the Service. Your profile and materials uploaded remain yours.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">4. AI Features Disclaimer</h2>
                        <p>
                            The Service includes features powered by Artificial Intelligence ("AI Reflections").
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-4 text-zinc-400">
                            <li><strong>Accuracy:</strong> AI is probabilistic. Reflections are generated for entertainment and introspection purposes only.</li>
                            <li><strong>Not Medical Advice:</strong> OneLine is not a mental health professional. AI insights should never replace professional medical advice, diagnosis, or treatment.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">5. Termination</h2>
                        <p>
                            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">6. Limitation of Liability</h2>
                        <p>
                            In no event shall OneLine, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
