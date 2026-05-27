import { useState, useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadAuthPage, loadJournalPage } from '@/App';
import { SpotlightCard } from "@/components/SpotlightCard";
import {
    Camera,
    PenLine,
    ArrowRight,
    Menu,
    X,
    Brain,
    Smartphone,
    Mic,
    Sun,
    Moon,
    Shield,
    Zap,
    Ghost,
    Sparkles
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

    let transformClass = "translate-y-8";
    if (direction === "left") transformClass = "translate-x-8";
    if (direction === "right") transformClass = "-translate-x-8";
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

const Navbar = ({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) => {
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
            scrolled ? 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-zinc-200 dark:border-white/10 py-3' : 'bg-transparent border-transparent py-6'
        )}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:-rotate-6 duration-500 shadow-md">
                            <div className="w-4 h-0.5 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white group-hover:opacity-80 transition-opacity">OneLine</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 bg-black/5 dark:bg-white/5 backdrop-blur-md px-6 py-2 rounded-full border border-black/5 dark:border-white/5">
                        {['Features', 'Philosophy', 'Security'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors relative group">
                                {item}
                                <span className="absolute -bottom-1 left-0 w-0 h-px bg-zinc-900 dark:bg-white transition-all duration-300 group-hover:w-full opacity-50"></span>
                            </a>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-zinc-600 dark:text-zinc-400">
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors px-2">Sign In</Link>
                        <Link to="/app" onMouseEnter={() => { loadAuthPage(); loadJournalPage(); }} className="relative group overflow-hidden bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg">
                            <span className="relative z-10">Start Writing</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-black/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                    </div>

                    <div className="md:hidden flex items-center gap-4">
                        <button onClick={toggleTheme} className="p-2 text-zinc-600 dark:text-zinc-400">
                            {isDark ? <Sun size={24} /> : <Moon size={24} />}
                        </button>
                        <button className="text-zinc-900 dark:text-white p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-6 animate-in slide-in-from-top-4">
                    {['Features', 'Philosophy', 'Security'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsMenuOpen(false)} className="text-xl font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                            {item}
                        </a>
                    ))}
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full"></div>
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="text-xl font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Sign In</Link>
                    <Link to="/app" onClick={() => setIsMenuOpen(false)} className="w-full text-center py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg">Start Writing Free</Link>
                </div>
            )}
        </nav>
    );
};

const Hero = ({ isDark }: { isDark: boolean }) => {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-zinc-50 dark:bg-zinc-950 selection:bg-indigo-500/30 transition-colors duration-700">
            {/* Dynamic Abstract Background */}
            <div className="absolute inset-0 z-0">
                <img 
                    src={isDark ? "/bg-dark.png" : "/bg-light.png"} 
                    alt="Abstract Background" 
                    className="w-full h-full object-cover opacity-80 mix-blend-normal transition-all duration-1000 scale-105"
                />
            </div>
            {/* Soft Gradient Overlay for Readability */}
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-white/40 via-transparent to-white dark:from-zinc-950/60 dark:via-zinc-950/20 dark:to-zinc-950 pointer-events-none transition-colors duration-700" />

            <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
                <FadeIn delay={100} direction="none">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border border-black/5 dark:border-white/10 text-xs font-semibold tracking-wide text-zinc-800 dark:text-zinc-300 mb-8 mx-auto shadow-lg transition-all cursor-default">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Introducing the new OneLine
                    </div>
                </FadeIn>

                <FadeIn delay={200}>
                    <h1 className="text-6xl md:text-8xl lg:text-[8rem] font-bold tracking-tighter text-zinc-900 dark:text-white mb-6 leading-[0.95] drop-shadow-2xl">
                        Clarity,<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-300 dark:to-purple-300">
                            one line at a time.
                        </span>
                    </h1>
                </FadeIn>

                <FadeIn delay={300}>
                    <p className="max-w-2xl mx-auto text-lg md:text-2xl text-zinc-700 dark:text-zinc-300 mb-10 leading-relaxed font-light">
                        The hyper-minimalist journal that respects your focus. 
                        Capture your life in <span className="text-zinc-900 dark:text-white font-medium">30 seconds</span> a day. 
                    </p>
                </FadeIn>

                <FadeIn delay={400} direction="up">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="group relative w-full sm:w-auto px-10 py-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-2xl">
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                Start Your Journal 
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-black/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
};

const BentoFeatures = () => (
    <section id="features" className="py-32 bg-white dark:bg-zinc-950 px-6 relative transition-colors duration-700">
        <div className="max-w-7xl mx-auto relative z-10">
            <FadeIn className="text-center mb-20" direction="up">
                <h2 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">Atomic Features</h2>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 font-light max-w-2xl mx-auto">
                    Powerful technology designed to vanish into the background. No complex formatting, just pure signal.
                </p>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[340px]">
                {/* Feature 1: Thought-Speed Input (Span 2) */}
                <FadeIn delay={100} className="md:col-span-2">
                    <div className="h-full p-10 flex flex-col justify-between group overflow-hidden relative rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 transition-colors shadow-sm hover:shadow-md">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/10 dark:group-hover:bg-indigo-500/20 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/5 flex items-center justify-center text-zinc-800 dark:text-white mb-6 shadow-sm">
                                <PenLine size={24} />
                            </div>
                            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Thought-Speed Input</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-lg font-light max-w-sm">No bold. No italics. No font choices. Just a blinking cursor and your raw thoughts.</p>
                        </div>
                        <div className="relative z-10 mt-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 font-mono text-sm text-zinc-600 dark:text-zinc-500 flex items-center shadow-inner">
                            <span className="text-indigo-500 mr-2 animate-pulse">❯</span> Start typing instantly...
                        </div>
                    </div>
                </FadeIn>

                {/* Feature 2: Voice Notes */}
                <FadeIn delay={200} className="md:col-span-1">
                    <div className="h-full p-10 flex flex-col group overflow-hidden relative rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 transition-colors shadow-sm hover:shadow-md">
                        <div className="absolute right-0 bottom-0 w-40 h-40 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6">
                                <Mic size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Voice Notes</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">Speak freely when walking or driving. Record raw audio natively.</p>
                        </div>
                        <div className="mt-auto flex items-end gap-1.5 h-12 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                            {[1, 3, 2, 5, 4, 2, 3, 1].map((h, i) => (
                                <div key={i} className="flex-1 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-emerald-500 rounded-full transition-all duration-300" style={{ height: `${h * 20}%`, transitionDelay: `${i * 30}ms` }} />
                            ))}
                        </div>
                    </div>
                </FadeIn>

                {/* Feature 3: Vision Scanner */}
                <FadeIn delay={300} className="md:col-span-1">
                    <div className="h-full p-10 flex flex-col group overflow-hidden relative rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 transition-colors shadow-sm hover:shadow-md">
                        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[60px] group-hover:bg-blue-500/10 dark:group-hover:bg-blue-500/20 transition-colors duration-700" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                                <Camera size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Vision Scanner</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">Snap a photo. We extract the text instantly using offline OCR.</p>
                        </div>
                    </div>
                </FadeIn>

                {/* Feature 4: Therapy Lite (AI) */}
                <FadeIn delay={400} className="md:col-span-2">
                    <div className="h-full p-10 flex flex-col sm:flex-row justify-between gap-8 group overflow-hidden relative rounded-3xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800/50 transition-colors shadow-sm hover:shadow-md">
                        <div className="relative z-10 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6">
                                <Brain size={24} />
                            </div>
                            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Therapy Lite</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-lg font-light">Llama 3.3 analyzes your weekly entries to find hidden emotional patterns and triggers.</p>
                        </div>
                        <div className="relative z-10 w-full sm:w-1/2 flex items-center">
                            <div className="w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-lg">
                                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-4 uppercase tracking-wider">
                                    <Sparkles size={12} className="text-amber-500" /> Insight Found
                                </div>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-light leading-relaxed">"You consistently mention 'anxiety' on Sunday nights, but days you exercise correlate with a 40% mood boost."</p>
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </div>
    </section>
);

const AntiFeatures = () => (
    <section id="philosophy" className="py-32 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/5 relative overflow-hidden transition-colors duration-700">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <FadeIn direction="up">
                <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">What we left out.</h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-500 font-light mb-16 max-w-2xl mx-auto">
                    We are extremely proud of what OneLine DOESN'T do. We degraded the complexity to elevate the reliability.
                </p>
            </FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                {[
                    { icon: Ghost, label: "No Social Feeds", desc: "No performing." },
                    { icon: Shield, label: "No Ads", desc: "Your data is yours." },
                    { icon: X, label: "No Streaks", desc: "No guilt trips." },
                    { icon: Zap, label: "No Bloat", desc: "Loads in 1 second." },
                ].map((item, i) => (
                    <FadeIn delay={i * 100} key={i} direction="up" className="group">
                        <div className="h-full p-8 bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:bg-zinc-900 transition-all duration-300 flex flex-col items-center shadow-sm hover:shadow-md">
                            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-950 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:scale-110 transition-all duration-500 shadow-inner mb-4">
                                <item.icon size={24} />
                            </div>
                            <h4 className="text-zinc-900 dark:text-white font-medium mb-1">{item.label}</h4>
                            <p className="text-xs text-zinc-500 font-light">{item.desc}</p>
                        </div>
                    </FadeIn>
                ))}
            </div>
        </div>
    </section>
);

const Footer = () => (
    <footer className="bg-white dark:bg-zinc-950 pt-20 pb-10 border-t border-zinc-200 dark:border-white/5 transition-colors duration-700">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shadow-md">
                            <div className="w-4 h-0.5 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">OneLine</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-500 text-sm leading-relaxed max-w-sm font-light">
                        Software with soul. Built for people who appreciate the craft of a quiet mind and value simplicity over complexity.
                    </p>
                </div>
                <div>
                    <h4 className="text-zinc-900 dark:text-white font-medium mb-6">Product</h4>
                    <ul className="space-y-4 text-sm text-zinc-600 dark:text-zinc-500 font-light">
                        <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a></li>
                        <li><a href="#philosophy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Philosophy</a></li>
                        <li><a href="/docs" className="hover:text-zinc-900 dark:hover:text-white transition-colors">API Docs</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-zinc-900 dark:text-white font-medium mb-6">Connect</h4>
                    <ul className="space-y-4 text-sm text-zinc-600 dark:text-zinc-500 font-light">
                        <li><Link to="/auth" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Sign In</Link></li>
                        <li><a href="https://github.com/Rohitsbag/OneLine" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white transition-colors">GitHub</a></li>
                        <li className="flex items-center gap-2">
                            <Smartphone size={14} /> Web App Only
                        </li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-900 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-zinc-500 dark:text-zinc-600 text-xs font-light">
                    © {new Date().getFullYear()} OneLine Inc. All rights reserved.
                </p>
                <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-600 font-light">
                    <span>Privacy</span>
                    <span>Terms</span>
                </div>
            </div>
        </div>
    </footer>
);

export function LandingPage() {
    // Check localStorage or system preference on initial load
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            setIsDark(false);
            document.documentElement.classList.remove('dark');
        } else {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        setIsDark(!isDark);
        if (!isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <div className="min-h-screen font-sans overflow-x-hidden bg-white dark:bg-zinc-950 transition-colors duration-700">
            <Navbar isDark={isDark} toggleTheme={toggleTheme} />
            <Hero isDark={isDark} />
            <BentoFeatures />
            <AntiFeatures />
            <Footer />
        </div>
    );
}
