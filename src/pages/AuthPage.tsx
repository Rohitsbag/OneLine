import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuthPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                // Auto login or show check email
                // For simplicity assuming successful signup logs in or prompts verification
                // Supabase default is check email.
                alert("Check your email for the confirmation link!");
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/app');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative">
            <Link to="/" className="absolute top-8 left-8 text-zinc-500 hover:text-white flex items-center gap-2 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back
            </Link>

            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-10">
                    <Sparkles className="w-8 h-8 text-white mx-auto mb-4" />
                    <h1 className="text-3xl font-semibold text-white mb-2">
                        {mode === 'signin' ? 'Welcome back' : 'Create an account'}
                    </h1>
                    <p className="text-zinc-500">
                        {mode === 'signin' ? 'Enter your details to continue' : 'Start your journey with OneLine'}
                    </p>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-black/50 border border-zinc-800 py-3 px-4 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-zinc-800 py-3 px-4 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-white text-black font-medium h-12 rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                setMode(mode === 'signin' ? 'signup' : 'signin');
                                setError(null);
                            }}
                            className="text-sm text-zinc-500 hover:text-white transition-colors"
                        >
                            {mode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
