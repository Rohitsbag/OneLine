import { useState, useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadAuthPage, loadJournalPage } from '@/App';
import { SpotlightCard } from "@/components/SpotlightCard";
import AnoAI from "@/components/ui/animated-shader-background";
import {
    Camera,
    Sparkles,
    PenLine,
    Ghost,
    Shield,
    ArrowRight,
    Menu,
    X,
    Brain,
    Smartphone,
    Mic,
    Zap,
    Search,
    Activity
} from 'lucide-react';
import { cn } from "@/lib/utils";

/* --- HOOKS & UTILS --- */



const FadeIn = ({ children, delay = 0, className = "" }: { children: ReactNode, delay?: number, className?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.1, rootMargin: '100px' });

        if (domRef.current) observer.observe(domRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={domRef}
            className={`transition-all duration-700 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                } ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

/* --- MICRO-IO COMPONENTS --- */

// SpotlightCard moved to src/components/SpotlightCard.tsx

const TypingEffect = () => {
    const phrases = [
        "Felt calm after the walk...",
        "Idea for the new project...",
        "Met Sarah for coffee...",
        "Slept better last night..."
    ];
    const [text, setText] = useState("");
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const currentPhrase = phrases[phraseIndex];

            if (isDeleting) {
                setText(currentPhrase.substring(0, text.length - 1));
                if (text.length === 0) {
                    setIsDeleting(false);
                    setPhraseIndex((prev) => (prev + 1) % phrases.length);
                }
            } else {
                setText(currentPhrase.substring(0, text.length + 1));
                if (text.length === currentPhrase.length) {
                    setTimeout(() => setIsDeleting(true), 2000); // Pause before deleting
                    return;
                }
            }
        }, isDeleting ? 50 : 100);

        return () => clearTimeout(timeout);
    }, [text, isDeleting, phraseIndex]);

    return (
        <span className="font-light">
            {text}
            <span className="animate-pulse">|</span>
        </span>
    );
};

/* --- SECTIONS --- */

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b ${scrolled
            ? 'bg-zinc-950/80 backdrop-blur-xl border-white/10 py-2'
            : 'bg-transparent border-transparent py-6'
            }`}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center transition-transform group-hover:rotate-3 duration-300">
                            <div className="w-4 h-0.5 bg-black"></div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white group-hover:opacity-80 transition-opacity">OneLine</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors relative group">
                                {item}
                                <span className="absolute -bottom-1 left-0 w-0 h-px bg-white transition-all duration-300 group-hover:w-full"></span>
                            </a>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Sign In</Link>
                        <Link to="/app" onMouseEnter={() => { loadAuthPage(); loadJournalPage(); }} className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                            Start Writing
                        </Link>
                    </div>

                    <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-zinc-950 border-b border-zinc-800 p-4 flex flex-col gap-4 animate-in slide-in-from-top-4">
                    {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsMenuOpen(false)} className="text-lg font-medium text-zinc-300 hover:text-white">
                            {item}
                        </a>
                    ))}
                    <Link to="/auth" className="btn-primary text-center py-3 bg-white text-black rounded-xl font-bold">Start Writing</Link>
                </div>
            )}
        </nav>
    );
};

const Hero = ({ downloadUrl }: { downloadUrl: string }) => {
    const [bgReady, setBgReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setBgReady(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-zinc-950">
            <div className={cn("absolute inset-0 transition-opacity duration-1000", bgReady ? "opacity-40" : "opacity-0")}>
                {bgReady && <AnoAI />}
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />

            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                <FadeIn delay={100}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-8 mx-auto hover:bg-zinc-800 transition-colors cursor-default">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Version 1.0 is now live
                    </div>
                </FadeIn>

                <FadeIn delay={200}>
                    <h1 className="text-5xl md:text-7xl lg:text-9xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
                        Clarity, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-600">
                            one line at a time.
                        </span>
                    </h1>
                </FadeIn>

                <FadeIn delay={300}>
                    <p className="max-w-xl mx-auto text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed">
                        The minimalist journal that turns writing into a habit.
                        Capture your life in 30 seconds a day.
                    </p>
                </FadeIn>

                <FadeIn delay={400}>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="group relative w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                            <span className="relative z-10 flex items-center justify-center gap-2">Start Your Line <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-200 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="group w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white border border-zinc-800 rounded-full font-medium text-lg hover:bg-zinc-800 transition-all hover:border-zinc-700 flex items-center justify-center gap-2 hover:scale-105 active:scale-95">
                            <Smartphone size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
                            Download Android
                        </a>
                    </div>
                </FadeIn>

                {/* Hero Phone Mockup */}
                <FadeIn delay={600} className="relative mx-auto w-full max-w-[320px]">
                    <div className="relative border-zinc-800 bg-zinc-950 border-[8px] rounded-[3rem] h-[640px] shadow-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-700">
                        <div className="h-[32px] w-[3px] bg-zinc-800 absolute -left-[11px] top-[72px] rounded-l-lg" />
                        <div className="h-[46px] w-[3px] bg-zinc-800 absolute -left-[11px] top-[124px] rounded-l-lg" />
                        <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-zinc-900 via-zinc-900/50 to-transparent z-20 pointer-events-none" />

                        <div className="p-8 h-full flex flex-col text-left">
                            <div className="mt-12 mb-8 flex items-center justify-center">
                                <span className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Today</span>
                            </div>

                            <div className="space-y-6 flex-1">
                                <div className="space-y-2 opacity-50 blur-[1px]">
                                    <div className="flex items-center gap-4">
                                        <span className="text-zinc-600 text-[10px] font-mono">20 OCT</span>
                                        <div className="h-px bg-zinc-800 flex-1"></div>
                                    </div>
                                    <p className="text-zinc-400 text-sm font-light">Long run in the rain. Felt alive.</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-4">
                                        <span className="text-white text-[10px] font-mono font-bold">TODAY</span>
                                        <div className="h-px bg-indigo-500 flex-1 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                    </div>
                                    <p className="text-white text-lg font-light leading-relaxed">
                                        <TypingEffect />
                                    </p>
                                </div>
                            </div>

                            <div className="mt-auto flex justify-between px-2 text-zinc-600">
                                <Mic size={24} className="hover:text-white transition-colors cursor-pointer hover:scale-110 duration-300" />
                                <Camera size={24} className="hover:text-white transition-colors cursor-pointer hover:scale-110 duration-300" />
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
};

const ParadoxSection = () => (
    <section id="philosophy" className="py-32 bg-zinc-950 relative border-t border-white/5 overflow-hidden [content-visibility:auto]">
        <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
                <FadeIn>
                    <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase mb-4">The Paradox</h2>
                    <h3 className="text-5xl font-bold text-white mb-8">
                        You want to journal.<br />
                        <span className="text-zinc-600">Life gets in the way.</span>
                    </h3>
                    <p className="text-xl text-zinc-400 leading-relaxed mb-6">
                        80% of people aspire to journal. Less than 5% stick with it.<br />
                        Why? Because we treat it as a <span className="text-white font-medium decoration-indigo-500 underline underline-offset-4">performance</span>.
                    </p>
                </FadeIn>

                <div className="relative h-[600px] flex flex-col justify-center items-center">
                    {/* Connecting Line */}
                    <div className="absolute left-1/2 top-10 bottom-10 w-px bg-gradient-to-b from-red-500/20 via-zinc-800 to-green-500/50 -translate-x-1/2"></div>

                    {/* Top Card (Messy) */}
                    <FadeIn delay={200} className="relative z-10 w-full max-w-md">
                        <div className="p-8 rounded-2xl bg-gradient-to-br from-red-950/10 to-zinc-950 border border-red-500/10 backdrop-blur-sm transform rotate-2 hover:rotate-1 transition-transform duration-500 group cursor-default">
                            <div className="flex gap-2 mb-4">
                                <div className="w-2 h-2 rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors"></div>
                                <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
                            </div>
                            <p className="text-zinc-500 font-serif italic text-lg line-through decoration-red-500/30">
                                Dear Diary, today I was supposed to write but I'm just too exhausted to think clearly...
                            </p>
                            <div className="mt-4 text-xs font-mono text-red-500/50 flex items-center gap-2">
                                <X size={12} /> Entry Abandoned
                            </div>
                        </div>
                    </FadeIn>

                    {/* Bottom Card (Clean) */}
                    <FadeIn delay={400} className="relative z-10 w-full max-w-md mt-12">
                        <SpotlightCard className="!bg-zinc-900/80 !border-zinc-700/50 transform -rotate-1 hover:rotate-0 hover:scale-105 transition-all duration-500 shadow-2xl">
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500">21:42</span>
                                </div>
                                <p className="text-white text-xl font-medium leading-relaxed">
                                    "Deep work session today. Felt unstoppable."
                                </p>
                                <div className="mt-6 flex items-center gap-2">
                                    <div className="h-1 w-20 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full w-2/3 bg-green-500"></div>
                                    </div>
                                </div>
                            </div>
                        </SpotlightCard>
                    </FadeIn>
                </div>
            </div>
        </div>
    </section>
);

const Features = () => (
    <section id="features" className="py-32 bg-zinc-950 px-6 [content-visibility:auto]">
        <div className="max-w-7xl mx-auto">
            <FadeIn className="text-center mb-24">
                <h2 className="text-5xl font-bold text-white mb-6">Atomic Journaling</h2>
                <p className="text-xl text-zinc-400">Features designed to vanish.</p>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Magic Input */}
                <div className="md:col-span-2">
                    <SpotlightCard className="h-full min-h-[320px] p-10 flex flex-col justify-between group">
                        <div className="relative">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center text-white mb-6 group-hover:bg-white group-hover:text-black transition-colors duration-500">
                                <PenLine size={28} />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-3">Thought-Speed</h3>
                            <p className="text-zinc-400 text-lg">No formatting. No fonts. No decisions. Just raw text.</p>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mt-8 font-mono text-sm text-zinc-500">
                            <span className="text-green-500 animate-pulse">_</span> cursor_blink
                        </div>
                    </SpotlightCard>
                </div>

                {/* Voice */}
                <div className="md:col-span-1">
                    <SpotlightCard className="h-full min-h-[320px] p-10 group">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center text-white mb-6 group-hover:bg-indigo-500 transition-colors duration-500">
                            <Mic size={28} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">Ramble On</h3>
                        <p className="text-zinc-400">Speak freely. We clean up the mess.</p>
                        <div className="mt-8 flex gap-1 items-end h-10">
                            {[1, 2, 3, 4, 5, 4, 3, 2].map((h, i) => (
                                <div key={i} className="flex-1 bg-zinc-700 rounded-full group-hover:bg-indigo-500 transition-colors duration-500" style={{ height: `${h * 20}%`, transitionDelay: `${i * 50}ms` }}></div>
                            ))}
                        </div>
                    </SpotlightCard>
                </div>

                {/* AI */}
                <div className="md:col-span-1">
                    <SpotlightCard className="h-full min-h-[320px] p-10 group bg-gradient-to-b from-zinc-900 to-black">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center text-white mb-6 group-hover:text-amber-400 transition-colors duration-300">
                            <Brain size={28} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">Therapy Lite</h3>
                        <p className="text-zinc-400 mb-6">Weekly patterns detected by AI.</p>

                        {/* AI Analysis Visual */}
                        <div className="bg-zinc-950/50 rounded-xl border border-zinc-800/50 p-4 relative overflow-hidden group-hover:border-zinc-700/50 transition-colors">
                            <div className="flex justify-between items-end gap-1 h-12 mb-2">
                                {[30, 50, 40, 70, 50, 80, 60].map((h, i) => (
                                    <div key={i} className="w-full bg-zinc-800 rounded-t-sm relative group-hover:bg-amber-500/20 transition-colors duration-500 overflow-hidden">
                                        <div className="absolute bottom-0 w-full bg-amber-500/80 transition-all duration-700 delay-100" style={{ height: `${h}%`, transform: 'translateY(100%)', animation: 'rise 1s forwards', animationDelay: `${i * 100}ms` }}></div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                                <Sparkles size={10} className="text-amber-400" />
                                <span>Mood Trend: <span className="text-zinc-300">Positive</span></span>
                            </div>
                        </div>
                    </SpotlightCard>
                </div>

                {/* Scanner */}
                <div className="md:col-span-2">
                    <SpotlightCard className="h-full min-h-[320px] p-10 group">
                        <div className="flex flex-row gap-8 items-center justify-between h-full">
                            <div className="w-full md:w-1/2">
                                <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center text-white mb-6 group-hover:bg-emerald-500 transition-colors duration-500">
                                    <Camera size={28} />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-3">Vision Scanner</h3>
                                <p className="text-zinc-400 text-lg">OCR extracts text from photos instantly.</p>
                            </div>
                            <div className="w-full md:w-1/2 h-[240px] relative perspective-1000">
                                {/* The Paper Note */}
                                <div className="absolute inset-0 bg-zinc-950 rounded-xl border border-zinc-800 transform rotate-3 transition-transform duration-700 group-hover:rotate-0 flex items-center justify-center overflow-hidden">

                                    {/* Paper Content (Handwritten style mock) */}
                                    <div className="w-2/3 h-3/4 bg-zinc-900/50 rounded-lg p-6 space-y-3 border border-white/5">
                                        <div className="h-2 w-1/3 bg-zinc-700/50 rounded-full"></div>
                                        <div className="h-2 w-full bg-zinc-700/50 rounded-full"></div>
                                        <div className="h-2 w-5/6 bg-zinc-700/50 rounded-full"></div>
                                        <div className="h-2 w-4/5 bg-zinc-700/50 rounded-full"></div>
                                    </div>

                                    {/* Scanning Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent -translate-y-[150%] group-hover:translate-y-[150%] transition-transform duration-[2s] ease-in-out"></div>

                                    {/* Laser Line */}
                                    <div className="absolute inset-x-0 h-[2px] bg-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.6)] top-1/2 -translate-y-[150%] group-hover:translate-y-[200px] transition-transform duration-[2s] ease-in-out"></div>
                                </div>

                                {/* Floating "Extracted" Bubble */}
                                <div className="absolute -right-6 top-1/2 bg-zinc-900 border border-emerald-500/30 px-4 py-2 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 translate-y-4 transition-all duration-700 delay-300 z-10 backdrop-blur-md">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[10px] font-mono text-emerald-400 tracking-wider">TEXT_EXTRACTED</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SpotlightCard>
                </div>
            </div>
        </div>
    </section>
);

const AntiFeatures = () => (
    <section className="py-24 bg-zinc-950 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold text-white mb-16">The "Anti-Features"</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                    { icon: Ghost, label: "No Social" },
                    { icon: Shield, label: "No Ads" },
                    { icon: X, label: "No Streaks" },
                    { icon: Zap, label: "No Bloat" },
                ].map((item, i) => (
                    <FadeIn delay={i * 100} key={i} className="group">
                        <div className="w-20 h-20 mx-auto bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:scale-110 transition-all duration-300 border border-zinc-800 group-hover:border-white/20">
                            <item.icon size={32} />
                        </div>
                        <p className="mt-4 text-zinc-500 font-medium group-hover:text-zinc-300">{item.label}</p>
                    </FadeIn>
                ))}
            </div>
        </div>
    </section>
);

const Roadmap = () => (
    <section id="roadmap" className="py-24 bg-zinc-900 border-y border-zinc-800 relative overflow-hidden [content-visibility:auto]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-900 to-zinc-900 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
            <FadeIn>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400 mb-6">
                    <Sparkles size={12} /> Coming Soon
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-16">The Future of Memory</h2>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6 text-left">
                {[
                    {
                        title: "Mood Weather Map",
                        desc: "Visualize your year in pixels. Detect burnout before it hits.",
                        icon: <Brain size={20} className="text-indigo-400" />
                    },
                    {
                        title: "Semantic Search",
                        desc: "Don't just search keywords. Search meanings. 'When was I happiest?'",
                        icon: <Search size={20} className="text-emerald-400" />
                    },
                    {
                        title: "Bio-Sync",
                        desc: "Correlate your journal entries with sleep and heart rate data.",
                        icon: <Activity size={20} className="text-red-400" />
                    }
                ].map((item, i) => (
                    <FadeIn delay={i * 100} key={i}>
                        <div className="h-full p-8 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all hover:-translate-y-1 group">
                            <div className="mb-4 p-3 bg-zinc-900 rounded-lg w-fit group-hover:bg-white/10 transition-colors">
                                {item.icon}
                            </div>
                            <h4 className="text-white font-bold mb-2 text-lg">{item.title}</h4>
                            <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                        </div>
                    </FadeIn>
                ))}
            </div>
        </div>
    </section>
);

const Footer = ({ downloadUrl }: { downloadUrl: string }) => {
    return (
        <footer className="relative bg-zinc-950 pt-20 pb-10 border-t border-white/5 overflow-hidden">
            <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-1 text-left">
                        <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                            <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                                <div className="w-3 h-0.5 bg-black"></div>
                            </div>
                            <span className="text-lg font-bold text-white">OneLine</span>
                        </div>
                        <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                            Software with soul. Built for people who appreciate the craft of a quiet mind.
                        </p>
                    </div>

                    <div className="text-left">
                        <h4 className="text-white font-semibold mb-4">Product</h4>
                        <ul className="space-y-3 text-sm text-zinc-500">
                            <li><Link to="/" className="hover:text-white transition-colors">Manifesto</Link></li>
                            <li><Link to="/" className="hover:text-white transition-colors">Roadmap</Link></li>
                            <li><Link to="/auth" className="hover:text-white transition-colors">Sign In</Link></li>
                        </ul>
                    </div>

                    <div className="text-left">
                        <h4 className="text-white font-semibold mb-4">Legal</h4>
                        <ul className="space-y-3 text-sm text-zinc-500">
                            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div className="text-left">
                        <h4 className="text-white font-semibold mb-4">Get the App</h4>
                        <div className="flex flex-col gap-3">
                            <Link to="/auth" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm">
                                <Smartphone size={16} /> Web App
                            </Link>
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm">
                                <Activity size={16} /> Android APK
                            </a>
                        </div>
                    </div>
                </div>

                <div className="border-t border-zinc-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-zinc-600 text-xs">
                        © {new Date().getFullYear()} OneLine Inc. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export function LandingPage() {
    const [downloadUrl, setDownloadUrl] = useState("/oneline.apk"); // Fallback

    useEffect(() => {
        // Fetch latest version info for the download link
        fetch('/version.json')
            .then(res => res.json())
            .then(data => {
                if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
            })
            .catch(err => console.error("Failed to fetch version info:", err));
    }, []);

    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
            <Navbar />
            <Hero downloadUrl={downloadUrl} />
            <ParadoxSection />
            <Features />
            <AntiFeatures />
            <Roadmap />

            {/* Big CTA */}
            <section className="py-32 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none"></div>
                <div className="relative z-10 max-w-2xl mx-auto px-6">
                    <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tighter">Start Today.</h2>
                    <p className="text-xl text-zinc-400 mb-10">Your future self will thank you.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/auth" className="w-full sm:w-auto px-12 py-5 bg-white text-black rounded-full font-bold text-xl hover:bg-zinc-200 hover:scale-105 transition-all shadow-xl">
                            Get OneLine Free
                        </Link>
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-12 py-5 bg-zinc-900 text-white border border-zinc-800 rounded-full font-bold text-xl hover:bg-zinc-800 transition-all hover:scale-105 shadow-xl flex items-center justify-center gap-3">
                            <Smartphone size={24} className="text-zinc-400" />
                            Download App
                        </a>
                    </div>
                </div>
            </section>

            <Footer downloadUrl={downloadUrl} />
        </div>
    );
}
