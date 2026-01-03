import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-center p-6 relative overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="z-10 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="flex items-center justify-center gap-2 mb-8 text-zinc-400">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium tracking-wide uppercase">Your daily companion</span>
                </div>

                <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter text-white mb-6">
                    OneLine
                </h1>

                <p className="text-xl md:text-2xl text-zinc-400 font-light mb-12 leading-relaxed">
                    Capture your life, one day at a time. <br />
                    Minimalist journaling for a clearer mind.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link to="/auth" className="group relative px-8 py-4 bg-white text-black rounded-full font-medium text-lg hover:bg-zinc-200 transition-all flex items-center gap-2">
                        Start Writing
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-lg opacity-0 group-hover:opacity-50 transition-opacity" />
                    </Link>
                    <Link to="/auth" className="text-zinc-500 hover:text-white transition-colors text-sm font-medium px-6 py-4">
                        Sign In
                    </Link>
                </div>
            </div>

            <footer className="absolute bottom-8 text-zinc-700 text-xs">
                © {new Date().getFullYear()} OneLine. Simplicity first.
            </footer>
        </div>
    );
}
