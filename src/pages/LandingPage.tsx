import { useState, useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
    History,
    Smartphone,
    Mic
} from 'lucide-react';

/**
 * UTILITY: Fade In Component for Scroll Animations
 */
const FadeIn = ({ children, delay = 0, className = "" }: { children: ReactNode, delay?: number, className?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => setIsVisible(entry.isIntersecting));
        });
        if (domRef.current) observer.observe(domRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={domRef}
            className={`transition-all duration-1000 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                } ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

/**
 * COMPONENT: Navigation
 */
const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-zinc-950/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                            <div className="w-4 h-0.5 bg-black"></div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">OneLine</span>
                    </div>

                    {/* Desktop Links */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-8">
                            {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                                <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                                    {item}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/auth" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            Sign In
                        </Link>
                        <Link to="/auth" className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors">
                            Start Writing
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-zinc-400 hover:text-white p-2">
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-zinc-950 border-b border-zinc-800 absolute w-full">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsOpen(false)} className="text-zinc-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">
                                {item}
                            </a>
                        ))}
                        <Link to="/auth" className="text-zinc-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">
                            Sign In
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
};

/**
 * COMPONENT: Hero Section
 */
const Hero = () => {
    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-zinc-950">
            {/* Abstract Background Gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                <FadeIn delay={100}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-8 max-w-fit mx-auto">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Version 2.0 is now live
                    </div>
                </FadeIn>

                <FadeIn delay={200}>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-6">
                        Clarity, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
                            one line at a time.
                        </span>
                    </h1>
                </FadeIn>

                <FadeIn delay={300}>
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed">
                        The minimalist journal that turns writing into a habit, not a chore.
                        Capture your life in 30 seconds a day with AI-powered reflections.
                    </p>
                </FadeIn>

                <FadeIn delay={400}>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/auth" className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-zinc-200 transition-all transform hover:scale-105 flex items-center justify-center gap-2">
                            Start Your Line <ArrowRight size={20} />
                        </Link>
                        <a href="#philosophy" className="w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white border border-zinc-800 rounded-full font-medium text-lg hover:bg-zinc-800 transition-all">
                            The Philosophy
                        </a>
                    </div>
                </FadeIn>

                {/* App Mockup */}
                <FadeIn delay={600} className="mt-20 relative flex justify-center">
                    <div className="relative border-zinc-800 bg-zinc-950 border-[8px] rounded-[2.5rem] h-[600px] w-[320px] shadow-2xl flex flex-col overflow-hidden">
                        <div className="h-[32px] w-[3px] bg-zinc-800 absolute -left-[10px] top-[72px] rounded-l-lg"></div>
                        <div className="h-[46px] w-[3px] bg-zinc-800 absolute -left-[10px] top-[124px] rounded-l-lg"></div>
                        <div className="h-[46px] w-[3px] bg-zinc-800 absolute -left-[10px] top-[178px] rounded-l-lg"></div>
                        <div className="h-[64px] w-[3px] bg-zinc-800 absolute -right-[10px] top-[142px] rounded-r-lg"></div>

                        {/* Screen Content */}
                        <div className="flex-1 bg-zinc-950 w-full h-full rounded-[2rem] p-6 flex flex-col relative overflow-hidden text-left">
                            {/* Dynamic Gradient Top */}
                            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-zinc-900 to-transparent opacity-50 pointer-events-none" />

                            <div className="mt-8 mb-8 text-center">
                                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">October 24</p>
                            </div>

                            {/* Entries */}
                            <div className="space-y-8 flex-1">
                                <div className="group cursor-pointer">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-zinc-600 text-xs font-mono">MON 21</span>
                                        <div className="h-px bg-zinc-900 flex-1"></div>
                                    </div>
                                    <p className="text-zinc-300 text-sm leading-relaxed font-light text-left">
                                        Finally finished the marathon. My legs are destroyed, but my mind is oddly quiet.
                                    </p>
                                </div>

                                <div className="group cursor-pointer opacity-80">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-zinc-600 text-xs font-mono">TUE 22</span>
                                        <div className="h-px bg-zinc-900 flex-1"></div>
                                    </div>
                                    <p className="text-zinc-300 text-sm leading-relaxed font-light text-left">
                                        Dinner with Sarah. We laughed about the old apartment. I need to call her more.
                                    </p>
                                </div>

                                {/* Active Input */}
                                <div className="relative mt-8">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-white text-xs font-mono">TODAY</span>
                                        <div className="h-px bg-indigo-500/50 flex-1"></div>
                                    </div>
                                    <div className="text-white text-lg font-light animate-pulse text-left">
                                        Started the new project today. Felt...<span className="w-0.5 h-5 bg-white inline-block ml-1 animate-pulse"></span>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Actions */}
                            <div className="mt-auto flex justify-between items-center text-zinc-500">
                                <Mic size={20} className="hover:text-white transition-colors cursor-pointer" />
                                <Camera size={20} className="hover:text-white transition-colors cursor-pointer" />
                            </div>
                        </div>
                    </div>

                    {/* Decorative Glow behind phone */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[650px] bg-white/5 blur-[80px] -z-10 rounded-full"></div>
                </FadeIn>
            </div>
        </div>
    );
};

/**
 * COMPONENT: Philosophy / Problem
 */
const Philosophy = () => {
    return (
        <section id="philosophy" className="py-32 bg-zinc-950 relative border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <FadeIn>
                        <h2 className="text-zinc-500 text-sm font-semibold tracking-widest uppercase mb-4">The Paradox</h2>
                        <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                            You want to journal.<br />
                            <span className="text-zinc-600">But life gets in the way.</span>
                        </h3>
                        <div className="space-y-6 text-lg text-zinc-400 text-left">
                            <p>
                                80% of us aspire to keep a journal. Less than 5% stick with it. Why? Because we treat it as a <span className="text-white">performance</span>.
                            </p>
                            <p>
                                We feel the need to write profound essays. When we're tired, we skip it. When we skip, we feel guilt. The habit dies.
                            </p>
                            <p className="text-white font-medium pt-4">
                                OneLine solves this by lowering the bar. One line. 30 seconds. No excuses.
                            </p>
                        </div>
                    </FadeIn>

                    <FadeIn delay={200} className="relative">
                        <div className="aspect-square rounded-3xl bg-zinc-900 border border-white/5 p-8 relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-zinc-950 opacity-40"></div>

                            {/* Visualizing "Data Rot" vs "Clarity" */}
                            <div className="relative z-10 h-full flex flex-col justify-between">
                                <div className="bg-zinc-950/50 p-6 rounded-2xl border border-dashed border-zinc-800 backdrop-blur-sm">
                                    <div className="flex gap-2 mb-3">
                                        <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                                        <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                                    </div>
                                    <p className="text-zinc-600 text-sm font-mono line-through text-left">
                                        Today was okay I guess. I tried to do the thing...
                                    </p>
                                </div>

                                <div className="text-center">
                                    <div className="w-0.5 h-16 bg-gradient-to-b from-transparent via-zinc-700 to-white mx-auto"></div>
                                </div>

                                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl transform hover:scale-105 transition-transform duration-500">
                                    <div className="flex gap-2 mb-3">
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    </div>
                                    <p className="text-white text-lg font-medium text-left">
                                        "Deep work session. Felt unstoppable."
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};

/**
 * COMPONENT: Bento Grid Features
 */
const Features = () => {
    return (
        <section id="features" className="py-32 bg-zinc-950 relative">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <FadeIn>
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Atomic Journaling</h2>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                            Features designed to reduce friction and amplify reflection.
                        </p>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">
                    {/* Card 1: Large - Thought Speed */}
                    <FadeIn className="md:col-span-2 row-span-1">
                        <div className="h-full min-h-[300px] rounded-3xl bg-zinc-900 border border-white/5 p-8 relative overflow-hidden group hover:border-white/10 transition-colors text-left">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50"></div>
                            <div className="relative z-10 flex flex-col justify-between h-full">
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 text-white border border-white/5">
                                        <PenLine size={24} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Thought-Speed Input</h3>
                                    <p className="text-zinc-400">Stripped of formatting. No bold, no italics, no decision fatigue. Just you and the cursor.</p>
                                </div>
                                <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 mt-8">
                                    <span className="text-zinc-500 font-mono text-xs mr-3">10:42 PM</span>
                                    <span className="text-white">The interface disappears. Only the thought remains.</span>
                                </div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Card 2: Voice */}
                    <FadeIn className="md:col-span-1 row-span-1">
                        <div className="h-full min-h-[300px] rounded-3xl bg-zinc-900 border border-white/5 p-8 relative overflow-hidden group hover:border-white/10 transition-colors text-left">
                            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 text-white border border-white/5">
                                <Mic size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Ramble On</h3>
                            <p className="text-zinc-400">Talk while you drive. AI cleans the "ums" but keeps the soul.</p>

                            {/* Audio Wave Visual */}
                            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end h-8 gap-1">
                                {[40, 70, 30, 80, 50, 90, 40, 60, 30].map((h, i) => (
                                    <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ height: `${h}%`, opacity: 0.5 + (i / 20) }}></div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>

                    {/* Card 3: AI Reflections */}
                    <FadeIn className="md:col-span-1 row-span-2">
                        <div className="h-full min-h-[400px] rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-white/5 p-8 relative overflow-hidden group hover:border-white/10 transition-colors text-left">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 text-white border border-white/5">
                                <Brain size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Therapy Lite</h3>
                            <p className="text-zinc-400 mb-8">Weekly insights connecting your dots.</p>

                            <div className="space-y-4">
                                <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                                        <Sparkles size={12} /> Insight
                                    </div>
                                    <p className="text-sm text-zinc-300">"You often mention 'anxiety' on Sunday nights. The 'Sunday Scaries' are real for you."</p>
                                </div>
                                <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm opacity-60">
                                    <div className="flex items-center gap-2 mb-2 text-green-400 text-xs font-bold uppercase tracking-wider">
                                        <History size={12} /> Time Travel
                                    </div>
                                    <p className="text-sm text-zinc-300">"On this day last year, you were worried about the merger. Today, sent."</p>
                                </div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Card 4: Vision */}
                    <FadeIn className="md:col-span-2 row-span-1">
                        <div className="h-full min-h-[300px] rounded-3xl bg-zinc-900 border border-white/5 p-8 relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col md:flex-row gap-8 items-center text-left">
                            <div className="flex-1">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 text-white border border-white/5">
                                    <Camera size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">The Digital Scanner</h3>
                                <p className="text-zinc-400">Snap a wine label or a handwritten note. OCR makes your physical world searchable forever.</p>
                            </div>
                            <div className="w-full md:w-1/3 aspect-video bg-zinc-950 rounded-xl border border-zinc-800 p-2 rotate-3 group-hover:rotate-0 transition-all duration-500">
                                <div className="w-full h-full bg-zinc-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-cover bg-center opacity-30 grayscale" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=300")' }}></div>
                                    <div className="relative bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 text-xs text-white">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        Text Extracted
                                    </div>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};

/**
 * COMPONENT: Anti-Features
 */
const AntiFeatures = () => {
    return (
        <section className="py-24 bg-zinc-950 border-y border-white/5">
            <div className="max-w-7xl mx-auto px-6">
                <FadeIn>
                    <div className="text-center mb-16">
                        <h2 className="text-2xl md:text-3xl font-bold text-white">The "Anti-Features"</h2>
                        <p className="text-zinc-500 mt-2">Marketing gold is what we <span className="text-white italic">left out</span>.</p>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        { icon: <Ghost size={32} />, title: "No Social", desc: "No likes. No performance." },
                        { icon: <Shield size={32} />, title: "No Ads", desc: "Your mind is not for sale." },
                        { icon: <X size={32} />, title: "No Streaks", desc: "No guilt for missing a day." },
                        { icon: <PenLine size={32} />, title: "No Rich Text", desc: "No formatting decisions." },
                    ].map((item, idx) => (
                        <FadeIn key={idx} delay={idx * 100} className="text-center group">
                            <div className="w-20 h-20 mx-auto bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 mb-6 group-hover:text-white group-hover:bg-zinc-800 border border-zinc-800 transition-colors">
                                {item.icon}
                            </div>
                            <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                            <p className="text-sm text-zinc-500 px-4">{item.desc}</p>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

/**
 * COMPONENT: Footer
 */
const Footer = () => {
    return (
        <footer className="bg-zinc-950 pt-20 pb-10 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
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
                            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                        </ul>
                    </div>

                    <div className="text-left">
                        <h4 className="text-white font-semibold mb-4">Get the App</h4>
                        <div className="flex flex-col gap-3">
                            <Link to="/auth" className="flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-white py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors text-sm w-fit">
                                <Smartphone size={16} /> Web App
                            </Link>
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
    return (
        <div className="bg-zinc-950 min-h-screen text-zinc-50 selection:bg-indigo-500/30 font-sans overflow-x-hidden">
            <Navbar />
            <Hero />
            <Philosophy />
            <Features />
            <AntiFeatures />

            {/* Roadmap Teaser */}
            <section id="roadmap" className="py-24 bg-zinc-900 px-6 border-y border-zinc-800 relative">
                <div className="max-w-4xl mx-auto text-center">
                    <FadeIn>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/20 border border-indigo-500/20 text-xs font-medium text-indigo-400 mb-6">
                            <Sparkles size={12} /> Coming Soon
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-12">The Future of Memory</h2>

                        <div className="grid md:grid-cols-3 gap-6 text-left">
                            {[
                                { title: "Mood Weather Map", desc: "Visualize your year in pixels. Detect burnout before it hits." },
                                { title: "Time Travel Mode", desc: "What were you doing exactly 2 years ago today?" },
                                { title: "Physical Book", desc: "Export your year into a beautiful hardbound keepsake." }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col gap-4 p-8 rounded-2xl bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                    <div>
                                        <h4 className="text-white font-bold mb-2">{item.title}</h4>
                                        <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-zinc-900"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <FadeIn>
                        <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tighter">
                            Your life.<br />
                            Saved from the void.
                        </h2>
                        <p className="text-xl text-zinc-400 mb-10 max-w-xl mx-auto">
                            Join the "Atomic Journaling" movement.
                            No ads. No social feeds. Just your thoughts.
                        </p>
                        <Link to="/auth" className="inline-block px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-zinc-200 transition-all transform hover:scale-105 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
                            Start Your Free Trial
                        </Link>
                    </FadeIn>
                </div>
            </section>

            <Footer />
        </div>
    );
}
