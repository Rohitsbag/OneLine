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
    Activity,
    ChevronRight
} from 'lucide-react';
import { cn } from "@/lib/utils";

/* --- UTILS & MICRO-COMPONENTS --- */

const FadeIn = ({ children, delay = 0, className = "", direction = "up" }: { children: ReactNode, delay?: number, className?: string, direction?: "up" | "left" | "right" | "none" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.1, rootMargin: '50px' });

        if (domRef.current) observer.observe(domRef.current);
        return () => observer.disconnect();
    }, []);

    let transformClass = "translate-y-6";
    if (direction === "left") transformClass = "translate-x-6";
    if (direction === "right") transformClass = "-translate-x-6";
    if (direction === "none") transformClass = "scale-95";

    return (
        <div
            ref={domRef}
            className={cn(
                "transition-all duration-1000 ease-out transform",
                isVisible ? 'opacity-100 translate-y-0 translate-x-0 scale-100' : `opacity-0 ${transformClass}`,
                className
            )}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
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
        <nav className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out border-b",
            scrolled ? 'bg-zinc-950/70 backdrop-blur-2xl border-white/10 py-3' : 'bg-transparent border-transparent py-6'
        )}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 bg-gradient-to-tr from-zinc-100 to-zinc-400 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-6 duration-500 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                            <div className="w-4 h-0.5 bg-zinc-900 rounded-full"></div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white group-hover:opacity-80 transition-opacity">OneLine</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 bg-zinc-900/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/5">
                        {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors relative group">
                                {item}
                                <span className="absolute -bottom-1 left-0 w-0 h-px bg-white transition-all duration-300 group-hover:w-full opacity-50"></span>
                            </a>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors px-2">Sign In</Link>
                        <Link to="/app" onMouseEnter={() => { loadAuthPage(); loadJournalPage(); }} className="relative group overflow-hidden bg-white text-black px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                            <span className="relative z-10">Start Writing</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-200 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                    </div>

                    <button className="md:hidden text-white p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 p-6 flex flex-col gap-6 animate-in slide-in-from-top-4">
                    {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsMenuOpen(false)} className="text-xl font-medium text-zinc-400 hover:text-white transition-colors">
                            {item}
                        </a>
                    ))}
                    <div className="h-px bg-zinc-800 w-full"></div>
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="text-xl font-medium text-zinc-400 hover:text-white">Sign In</Link>
                    <Link to="/app" onClick={() => setIsMenuOpen(false)} className="w-full text-center py-4 bg-white text-black rounded-2xl font-bold text-lg">Start Writing Free</Link>
                </div>
            )}
        </nav>
    );
};

const Hero = () => {
    const [bgReady, setBgReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setBgReady(true), 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-zinc-950 selection:bg-indigo-500/30">
            {/* Ambient Shader Background */}
            <div className={cn("absolute inset-0 transition-opacity duration-1000 mix-blend-screen", bgReady ? "opacity-30" : "opacity-0")}>
                {bgReady && <AnoAI />}
            </div>
            
            {/* Core Gradient Orbs */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }} />

            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                <FadeIn delay={100} direction="none">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-xs font-semibold tracking-wide text-zinc-300 mb-8 mx-auto shadow-2xl hover:border-white/20 transition-all cursor-default">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Introducing OneLine V2
                    </div>
                </FadeIn>

                <FadeIn delay={200}>
                    <h1 className="text-6xl md:text-8xl lg:text-[8rem] font-bold tracking-tighter text-white mb-6 leading-[0.9] drop-shadow-2xl">
                        Clarity,<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-400 to-zinc-700">
                            one line at a time.
                        </span>
                    </h1>
                </FadeIn>

                <FadeIn delay={300}>
                    <p className="max-w-2xl mx-auto text-lg md:text-2xl text-zinc-400 mb-10 leading-relaxed font-light">
                        The hyper-minimalist journal that respects your focus. 
                        Capture your life in <span className="text-white font-medium">30 seconds</span> a day. Zero bloat. Pure signal.
                    </p>
                </FadeIn>

                <FadeIn delay={400} direction="up">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="group relative w-full sm:w-auto px-10 py-5 bg-white text-black rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]">
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                Start Your Journal 
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-200 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                    </div>
                </FadeIn>

                {/* Conceptual UI Preview */}
                <FadeIn delay={600} direction="up" className="relative mx-auto w-full max-w-4xl rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_100px_rgba(0,0,0,0.8)]">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/80 to-zinc-950 z-20 pointer-events-none" />
                    <div className="bg-zinc-900/50 backdrop-blur-xl p-4 md:p-8 flex flex-col text-left h-[400px]">
                        <div className="flex items-center gap-3 mb-8 opacity-70">
                            <div className="w-3 h-3 rounded-full bg-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/50" />
                        </div>
                        
                        <div className="max-w-2xl mx-auto w-full space-y-6">
                            <div className="space-y-2 opacity-40 blur-[1px]">
                                <div className="text-xs font-mono text-zinc-500 tracking-widest">YESTERDAY</div>
                                <div className="text-lg text-zinc-400 font-light">Late night coding session. Shipped the new landing page.</div>
                            </div>
                            <div className="space-y-3 relative z-30">
                                <div className="flex items-center gap-3">
                                    <div className="text-xs font-mono text-white tracking-widest font-bold">TODAY</div>
                                    <div className="h-px bg-indigo-500 flex-1 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                                </div>
                                <div className="text-2xl md:text-3xl text-white font-light leading-snug flex">
                                    <span>Feeling energized. Ready to tackle the next</span>
                                    <span className="w-1.5 h-8 bg-white ml-1 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
};

const PhilosophySection = () => (
    <section id="philosophy" className="py-32 bg-zinc-950 relative border-t border-white/5 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
                <FadeIn direction="left">
                    <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-zinc-500 uppercase mb-6">
                        <span className="w-2 h-px bg-zinc-500" /> The Problem
                    </div>
                    <h3 className="text-5xl md:text-6xl font-bold text-white mb-8 tracking-tight">
                        You want to journal.<br />
                        <span className="text-zinc-600">Life gets in the way.</span>
                    </h3>
                    <p className="text-xl text-zinc-400 leading-relaxed mb-8 font-light">
                        80% of people aspire to journal. Less than 5% stick with it. Why? Because we treat it as a <span className="text-white font-medium underline decoration-zinc-700 underline-offset-4">performance</span>.
                    </p>
                    <p className="text-lg text-zinc-500 leading-relaxed font-light">
                        When you're exhausted, writing a profound essay feels impossible. You skip a day, feel guilt, and the habit dies. OneLine exists to fix this.
                    </p>
                </FadeIn>

                <div className="relative flex flex-col justify-center items-center gap-8">
                    {/* Top Card (Messy) */}
                    <FadeIn delay={200} direction="right" className="relative z-10 w-full max-w-md">
                        <div className="p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm transform rotate-2 hover:rotate-1 transition-transform duration-500 opacity-60 grayscale hover:grayscale-0">
                            <p className="text-zinc-500 font-serif italic text-xl line-through decoration-zinc-700">
                                Dear Diary, today I was supposed to write but I'm just too exhausted to think clearly...
                            </p>
                            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-zinc-600">
                                <X size={14} /> Entry Abandoned
                            </div>
                        </div>
                    </FadeIn>

                    {/* Bottom Card (Clean) */}
                    <FadeIn delay={400} direction="right" className="relative z-10 w-full max-w-md">
                        <SpotlightCard className="!bg-zinc-900/80 !border-zinc-700/50 transform -rotate-2 hover:rotate-0 hover:scale-105 transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <span className="text-xs font-mono text-zinc-400">SYNCED</span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500">21:42</span>
                                </div>
                                <p className="text-white text-2xl font-light leading-snug">
                                    "Deep work session today. Felt unstoppable."
                                </p>
                            </div>
                        </SpotlightCard>
                    </FadeIn>
                </div>
            </div>
        </div>
    </section>
);

const BentoFeatures = () => (
    <section id="features" className="py-32 bg-zinc-950 px-6 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
            <FadeIn className="text-center mb-20" direction="up">
                <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">Atomic Features</h2>
                <p className="text-xl text-zinc-400 font-light">Powerful technology designed to vanish into the background.</p>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[340px]">
                {/* Feature 1: Thought-Speed Input (Span 2) */}
                <FadeIn delay={100} className="md:col-span-2">
                    <SpotlightCard className="h-full p-10 flex flex-col justify-between group overflow-hidden relative">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-zinc-800/30 rounded-full blur-[80px] group-hover:bg-zinc-700/40 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/5 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-500">
                                <PenLine size={24} />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Thought-Speed</h3>
                            <p className="text-zinc-400 text-lg font-light max-w-sm">No bold. No italics. No font choices. Just a blinking cursor and your raw thoughts.</p>
                        </div>
                        <div className="relative z-10 mt-auto bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 font-mono text-sm text-zinc-500 flex items-center shadow-inner">
                            <span className="text-emerald-500 mr-2 animate-pulse">❯</span> Start typing instantly...
                        </div>
                    </SpotlightCard>
                </FadeIn>

                {/* Feature 2: Ramble On (Voice) */}
                <FadeIn delay={200} className="md:col-span-1">
                    <SpotlightCard className="h-full p-10 flex flex-col group overflow-hidden relative">
                        <div className="absolute right-0 bottom-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-[60px] group-hover:bg-indigo-500/20 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                                <Mic size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Voice Notes</h3>
                            <p className="text-zinc-400 font-light leading-relaxed">Speak freely when walking or driving. Record raw audio natively.</p>
                        </div>
                        <div className="mt-auto flex items-end gap-1.5 h-12 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                            {[1, 3, 2, 5, 4, 2, 3, 1].map((h, i) => (
                                <div key={i} className="flex-1 bg-zinc-700 group-hover:bg-indigo-500 rounded-full transition-all duration-300" style={{ height: `${h * 20}%`, transitionDelay: `${i * 30}ms` }} />
                            ))}
                        </div>
                    </SpotlightCard>
                </FadeIn>

                {/* Feature 3: Vision Scanner */}
                <FadeIn delay={300} className="md:col-span-1">
                    <SpotlightCard className="h-full p-10 flex flex-col group overflow-hidden relative">
                        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/20 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                                <Camera size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Vision Scanner</h3>
                            <p className="text-zinc-400 font-light leading-relaxed">Snap a photo. We extract the text instantly using offline OCR.</p>
                        </div>
                    </SpotlightCard>
                </FadeIn>

                {/* Feature 4: Therapy Lite (AI) */}
                <FadeIn delay={400} className="md:col-span-2">
                    <SpotlightCard className="h-full p-10 flex flex-col sm:flex-row justify-between gap-8 group overflow-hidden relative bg-gradient-to-br from-zinc-900 to-zinc-950">
                        <div className="relative z-10 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-zinc-900 transition-all duration-500">
                                <Brain size={24} />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Therapy Lite</h3>
                            <p className="text-zinc-400 text-lg font-light">Llama 3.3 analyzes your weekly entries to find hidden emotional patterns and triggers.</p>
                        </div>
                        <div className="relative z-10 w-full sm:w-1/2 flex items-center">
                            <div className="w-full bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-zinc-800 p-5 shadow-2xl group-hover:border-amber-500/30 transition-colors">
                                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-4 uppercase tracking-wider">
                                    <Sparkles size={12} className="text-amber-400" /> Insight Found
                                </div>
                                <p className="text-sm text-zinc-300 font-light leading-relaxed">"You consistently mention 'anxiety' on Sunday nights, but days you exercise correlate with a 40% mood boost."</p>
                            </div>
                        </div>
                    </SpotlightCard>
                </FadeIn>
            </div>
        </div>
    </section>
);

const AntiFeatures = () => (
    <section className="py-24 bg-zinc-950 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <FadeIn direction="up">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">What we left out.</h2>
                <p className="text-lg text-zinc-500 font-light mb-16 max-w-2xl mx-auto">We are extremely proud of what OneLine DOESN'T do. We degraded the complexity to elevate the reliability.</p>
            </FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                {[
                    { icon: Ghost, label: "No Social Feeds", desc: "No performing." },
                    { icon: Shield, label: "No Ads", desc: "Your data is yours." },
                    { icon: X, label: "No Streaks", desc: "No guilt trips." },
                    { icon: Zap, label: "No Bloat", desc: "Loads in 1 second." },
                ].map((item, i) => (
                    <FadeIn delay={i * 100} key={i} direction="up" className="group">
                        <div className="h-full p-8 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 hover:bg-zinc-900 transition-all duration-300 flex flex-col items-center">
                            <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:scale-110 transition-all duration-500 shadow-inner mb-4">
                                <item.icon size={24} />
                            </div>
                            <h4 className="text-white font-medium mb-1">{item.label}</h4>
                            <p className="text-xs text-zinc-500 font-light">{item.desc}</p>
                        </div>
                    </FadeIn>
                ))}
            </div>
        </div>
    </section>
);

const CTA = () => (
    <section className="py-32 bg-zinc-950 relative border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
            <FadeIn direction="up">
                <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tighter drop-shadow-lg">
                    Clear your mind.
                </h2>
                <p className="text-xl md:text-2xl text-zinc-400 font-light mb-12">
                    Your future self will thank you for starting today.
                </p>
                <Link to="/auth" className="group inline-flex items-center justify-center gap-2 px-12 py-5 bg-white text-black rounded-full font-bold text-xl hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]">
                    Get OneLine Free <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <p className="mt-8 text-sm text-zinc-600 font-light">No credit card required. Works offline.</p>
            </FadeIn>
        </div>
    </section>
);

const Footer = () => (
    <footer className="bg-zinc-950 pt-20 pb-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                            <div className="w-3 h-0.5 bg-black"></div>
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">OneLine</span>
                    </div>
                    <p className="text-zinc-500 text-sm leading-relaxed max-w-sm font-light">
                        Software with soul. Built for people who appreciate the craft of a quiet mind and value simplicity over complexity.
                    </p>
                </div>
                <div>
                    <h4 className="text-white font-medium mb-6">Product</h4>
                    <ul className="space-y-4 text-sm text-zinc-500 font-light">
                        <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                        <li><a href="#philosophy" className="hover:text-white transition-colors">Philosophy</a></li>
                        <li><a href="/docs" className="hover:text-white transition-colors">API Docs</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-medium mb-6">Connect</h4>
                    <ul className="space-y-4 text-sm text-zinc-500 font-light">
                        <li><Link to="/auth" className="hover:text-white transition-colors">Sign In</Link></li>
                        <li><a href="https://github.com/Rohitsbag/OneLine" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                        <li className="flex items-center gap-2">
                            <Smartphone size={14} /> Web App Only
                        </li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-zinc-900 pt-8 flex items-center justify-between">
                <p className="text-zinc-600 text-xs font-light">
                    © {new Date().getFullYear()} OneLine Inc. All rights reserved.
                </p>
                <div className="flex gap-4 text-xs text-zinc-600 font-light">
                    <span>Privacy</span>
                    <span>Terms</span>
                </div>
            </div>
        </div>
    </footer>
);

export function LandingPage() {
    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
            <Navbar />
            <Hero />
            <PhilosophySection />
            <BentoFeatures />
            <AntiFeatures />
            <CTA />
            <Footer />
        </div>
    );
}
