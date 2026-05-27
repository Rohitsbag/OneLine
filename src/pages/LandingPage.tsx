import { useState, useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadAuthPage, loadJournalPage } from '@/App';
import { SpotlightCard } from "@/components/SpotlightCard";
import { useDropzone } from 'react-dropzone';
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
    Sparkles,
    Lock,
    WifiOff,
    Clock,
    Coins,
    Ban,
    Type,
    Github,
    MessageSquareWarning,
    CloudSun,
    Search,
    BookOpen
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
            scrolled
                ? isDark
                    ? 'bg-zinc-950/80 backdrop-blur-2xl border-white/8 py-3'
                    : 'bg-white/85 backdrop-blur-2xl border-zinc-200/60 py-3'
                : 'bg-transparent border-transparent py-6'
        )}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-14">
                    {/* Logo */}
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:-rotate-6 duration-500",
                            scrolled && !isDark ? 'bg-zinc-900' : 'bg-white/15 backdrop-blur-sm border border-white/20'
                        )}>
                            <div className={cn("w-4 h-0.5 rounded-full", scrolled && !isDark ? 'bg-white' : 'bg-white')}></div>
                        </div>
                        <span className={cn(
                            "text-xl font-bold tracking-tight transition-all",
                            scrolled && !isDark ? 'text-zinc-900' : 'text-white'
                        )}>OneLine</span>
                    </div>

                    {/* Nav links */}
                    <div className="hidden md:flex items-center gap-8 px-6 py-2 rounded-full">
                        {['Features', 'Philosophy', 'Roadmap'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} className={cn(
                                "text-sm font-medium transition-colors",
                                scrolled && !isDark
                                    ? 'text-zinc-500 hover:text-zinc-900'
                                    : 'text-white/60 hover:text-white'
                            )}>
                                {item}
                            </a>
                        ))}
                    </div>

                    {/* Right actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <button onClick={toggleTheme} className={cn(
                            "p-2 rounded-full transition-colors",
                            scrolled && !isDark ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-white/60 hover:text-white hover:bg-white/10'
                        )}>
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className={cn(
                            "text-sm font-medium transition-colors px-2",
                            scrolled && !isDark ? 'text-zinc-500 hover:text-zinc-900' : 'text-white/60 hover:text-white'
                        )}>Sign In</Link>
                        <Link to="/app" onMouseEnter={() => { loadAuthPage(); loadJournalPage(); }} className={cn(
                            "relative group overflow-hidden px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95",
                            scrolled && !isDark
                                ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                                : 'bg-white/15 backdrop-blur-sm border border-white/20 text-white hover:bg-white/25'
                        )}>
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
                    {['Features', 'Philosophy', 'Roadmap'].map((item) => (
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

const VIDEOS = [
    { src: "/hero-3.mp4", label: "☀️ Day" },
    { src: "/hero-1.mp4", label: "🌌 Night" },
];

const Hero = ({ isDark }: { isDark: boolean }) => {
    const [videoIndex, setVideoIndex] = useState(isDark ? 1 : 0);

    useEffect(() => {
        setVideoIndex(isDark ? 1 : 0);
    }, [isDark]);

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-36 pb-24 overflow-hidden selection:bg-indigo-500/30">
            {/* Full-screen looping video background with cross-fade transition */}
            <div className="absolute inset-0 z-0 bg-zinc-950">
                {VIDEOS.map((v, i) => (
                    <video
                        key={v.src}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className={cn(
                            "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out",
                            i === videoIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}
                    >
                        <source src={v.src} type="video/mp4" />
                    </video>
                ))}
            </div>

            {/* Top darkening for navbar readability */}
            <div className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, transparent 70%)' }}
            />

            {/* Bottom fade — custom premium eased gradient for both light & dark mode */}
            <div className="absolute bottom-0 left-0 right-0 h-80 z-10 pointer-events-none hero-bottom-fade" />

            <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
                <FadeIn delay={100} direction="none">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide text-white mb-8 mx-auto shadow-lg cursor-default">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
                        </span>
                        ✦ Now with AI Reflections & Voice Notes
                    </div>
                </FadeIn>

                <FadeIn delay={200}>
                    <h1 className="text-6xl md:text-8xl lg:text-[8rem] font-extrabold mb-6 leading-[0.95] drop-shadow-2xl select-none">
                        <span className="hero-line-1 block">
                            The journal that
                        </span>
                        <span className="hero-line-2 block">
                            fits in one line.
                        </span>
                    </h1>
                </FadeIn>

                <FadeIn delay={300}>
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/90 mb-10 leading-relaxed font-light drop-shadow-md">
                        Most journals die because they demand too much.
                        OneLine asks for just <span className="text-white font-semibold">one thought</span>. That's it.
                        <span className="block mt-2 font-normal text-white">Write it in 10 seconds. Read it in 10 years.</span>
                    </p>
                </FadeIn>

                <FadeIn delay={400} direction="up">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                        <Link to="/auth" onMouseEnter={() => loadAuthPage()} className="group relative w-full sm:w-auto px-10 py-5 bg-white text-black rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-95">
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                → Start Writing (Free)
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-200/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                    </div>
                    <p className="text-white/50 text-sm font-light tracking-wide">No account needed. Works offline.</p>
                </FadeIn>
            </div>
        </section>
    );
};

/* --- SOCIAL PROOF BAR --- */
const SocialProofBar = () => {
    return (
        <section className="border-y border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md relative z-20 py-8 px-6 transition-colors duration-700">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
                    {[
                        { stat: "10 seconds", label: "Average entry time", icon: Clock },
                        { stat: "100% Private", label: "End-to-end encrypted", icon: Lock },
                        { stat: "Works Offline", label: "No internet needed", icon: WifiOff },
                        { stat: "Free Forever", label: "Core features, always", icon: Coins }
                    ].map((item, i) => (
                        <div key={i} className={cn("flex flex-col items-center justify-center", i > 0 && "pt-6 md:pt-0")}>
                            <item.icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mb-2" />
                            <span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">{item.stat}</span>
                            <span className="text-sm text-zinc-500 dark:text-zinc-400 font-light mt-0.5">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* --- THE PARADOX (PHILOSOPHY) --- */
const Philosophy = () => {
    return (
        <section id="philosophy" className="py-32 bg-zinc-50 dark:bg-zinc-900/40 px-6 relative transition-colors duration-700 border-b border-zinc-200 dark:border-zinc-800/80">
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                    {/* Header Side */}
                    <div className="lg:col-span-5">
                        <FadeIn direction="left">
                            <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase block mb-3 font-mono">THE PROBLEM</span>
                            <h2 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.05] mb-8">
                                You want to journal.<br />You never do.
                            </h2>
                            <div className="border-l-2 border-indigo-500 pl-6 py-2 my-6 italic text-lg md:text-xl text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">
                                "The best journal entry is the one you actually write."
                            </div>
                        </FadeIn>
                    </div>

                    {/* Content Side */}
                    <div className="lg:col-span-7 text-zinc-600 dark:text-zinc-400 text-lg font-light leading-relaxed space-y-6">
                        <FadeIn direction="right" delay={150}>
                            <p className="text-zinc-900 dark:text-white font-medium text-xl leading-relaxed">
                                80% of people start a journal. Less than 5% keep one.
                            </p>
                            <p>
                                Not because they're lazy. Because every app makes it feel like homework. Blank pages. Blinking cursors. The pressure to be profound.
                            </p>
                            <p>
                                OneLine breaks the cycle. We don't ask for essays. We ask for one honest thought, whatever's in your head right now. That's the whole thing.
                            </p>
                        </FadeIn>
                    </div>
                </div>
            </div>
        </section>
    );
};

/* --- VISION CARD (DRAG AND DROP) --- */
const VisionCard = () => {
    const [droppedImage, setDroppedImage] = useState<string | null>(null);
    
    const onDrop = (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setDroppedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': []
        },
        multiple: false
    });

    return (
        <SpotlightCard 
            {...getRootProps()}
            className={cn(
                "h-full p-10 flex flex-col justify-between group overflow-hidden relative rounded-3xl transition-all duration-300 border shadow-sm hover:shadow-md cursor-pointer",
                isDragActive 
                    ? "border-blue-500 bg-blue-50/10 dark:bg-blue-950/20 scale-[0.98]" 
                    : "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800/50"
            )}
        >
            {/* Hidden file input from react-dropzone */}
            <input {...getInputProps()} />

            <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[60px] group-hover:bg-blue-500/10 dark:group-hover:bg-blue-500/20 transition-colors duration-700 pointer-events-none" />
            
            <div className="relative z-10 pointer-events-none">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Camera size={24} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-blue-500 bg-blue-500/10 rounded-full px-2.5 py-1 font-mono uppercase">VISION</span>
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Capture a moment</h3>
                <p className="text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">
                    One image per day. That's your visual anchor, the thing that stops the day from blurring together.
                </p>
            </div>

            <div className="mt-auto relative z-10 pointer-events-none">
                <div className="h-28 w-full rounded-2xl relative overflow-hidden border border-zinc-200/80 dark:border-zinc-800/60 shadow-sm bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-center text-center p-4">
                    {droppedImage ? (
                        <>
                            <img
                                src={droppedImage}
                                alt="Visual Anchor"
                                className="absolute inset-0 w-full h-full object-cover filter brightness-95 contrast-95 animate-in fade-in duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                            <div className="absolute bottom-3 left-3 bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide flex items-center gap-1.5 shadow-lg">
                                <Sparkles size={10} className="text-indigo-300" /> Photo Anchored!
                            </div>
                        </>
                    ) : (
                        <>
                            <img
                                src="/visual_anchor.png"
                                alt="Visual Anchor"
                                className="absolute inset-0 w-full h-full object-cover filter brightness-95 contrast-95 transition-transform duration-700 group-hover:scale-105 opacity-40 dark:opacity-30"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                            
                            {/* Drag and Drop Prompt */}
                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <span className={cn(
                                    "text-xs font-semibold tracking-wide shadow-sm rounded-full px-3 py-1 backdrop-blur-md transition-all duration-300",
                                    isDragActive 
                                        ? "bg-blue-500 text-white border border-blue-400 scale-105" 
                                        : "bg-white/80 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-800/50"
                                )}>
                                    {isDragActive ? "Drop your photo here!" : "Drag & drop a photo"}
                                </span>
                                <span className="text-[10px] text-white/70 font-light mt-0.5">or click to choose</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </SpotlightCard>
    );
};

/* --- FEATURES (BENTO GRID) --- */
const BentoFeatures = () => {
    return (
        <section id="features" className="py-32 bg-white dark:bg-zinc-950 px-6 relative transition-colors duration-700">
            <div className="max-w-7xl mx-auto relative z-10">
                <FadeIn className="text-center mb-20" direction="up">
                    <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase block mb-3 font-mono">WHAT IT DOES</span>
                    <h2 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">Atomic Journaling.<br />Built for real life.</h2>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 font-light max-w-2xl mx-auto">
                        Three tools. Each one does exactly one thing, perfectly.
                    </p>
                </FadeIn>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[340px]">
                    {/* Card 1: Write (Large, spans 2 columns) */}
                    <FadeIn delay={100} className="md:col-span-2">
                        <SpotlightCard className="h-full p-10 flex flex-col justify-between group overflow-hidden relative rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 shadow-sm hover:shadow-md">
                            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/10 dark:group-hover:bg-indigo-500/20 transition-colors duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/5 flex items-center justify-center text-zinc-800 dark:text-white shadow-sm">
                                        <PenLine size={24} />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-wider text-indigo-500 bg-indigo-500/10 rounded-full px-2.5 py-1 font-mono uppercase">CORE</span>
                                </div>
                                <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Write in seconds</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-lg font-light max-w-lg">No formatting. No decisions. Open the app, type your thought, close it. Done in 10 seconds. Saved forever.</p>
                            </div>
                            <div className="relative z-10 mt-auto bg-zinc-100/60 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 font-mono text-sm text-zinc-600 dark:text-zinc-500 flex items-center shadow-inner">
                                <span className="text-indigo-500 mr-2 animate-pulse">❯</span> Open the app, type...<span className="inline-block w-1.5 h-4 bg-zinc-600 dark:bg-zinc-400 ml-1 animate-pulse"></span>
                            </div>
                        </SpotlightCard>
                    </FadeIn>

                    {/* Card 2: Speak it out */}
                    <FadeIn delay={200} className="md:col-span-1">
                        <SpotlightCard className="h-full p-10 flex flex-col group overflow-hidden relative rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 shadow-sm hover:shadow-md">
                            <div className="absolute right-0 bottom-0 w-40 h-40 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20 transition-colors duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <Mic size={24} />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-wider text-emerald-500 bg-emerald-500/10 rounded-full px-2.5 py-1 font-mono uppercase">VOICE</span>
                                </div>
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Speak it out</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">Driving? Walking? Tap the mic. Your voice note is saved raw, or transcribed instantly. It's your call.</p>
                            </div>
                            <div className="mt-auto flex items-end gap-1.5 h-12 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                                {[1, 3, 2, 5, 4, 2, 3, 1].map((h, i) => (
                                    <div key={i} className="flex-1 bg-zinc-200 dark:bg-zinc-800 group-hover:bg-emerald-500 rounded-full transition-all duration-300" style={{ height: `${h * 20}%`, transitionDelay: `${i * 30}ms` }} />
                                ))}
                            </div>
                        </SpotlightCard>
                    </FadeIn>

                    {/* Card 3: Capture a moment (Drag and Drop Stateful Component) */}
                    <FadeIn delay={300} className="md:col-span-1">
                        <VisionCard />
                    </FadeIn>

                    {/* Card 4: AI Reflections (Large, spans 2 columns) */}
                    <FadeIn delay={400} className="md:col-span-2">
                        <SpotlightCard className="h-full p-10 flex flex-col sm:flex-row justify-between gap-8 group overflow-hidden relative rounded-3xl bg-gradient-to-br from-zinc-50/50 to-zinc-100/50 dark:from-zinc-900/30 dark:to-zinc-950/30 border border-zinc-200 dark:border-zinc-800/50 shadow-sm hover:shadow-md">
                            <div className="relative z-10 flex-1">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Brain size={24} />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-wider text-amber-500 bg-amber-500/10 rounded-full px-2.5 py-1 font-mono uppercase">AI</span>
                                </div>
                                <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">Your personal pattern detector</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 text-lg font-light">Once a week, our AI reads your entries and finds patterns you missed. Not generic advice. We find your specific themes, moods, and recurring moments.</p>
                            </div>
                            <div className="relative z-10 w-full sm:w-1/2 flex items-center">
                                <div className="w-full bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-lg relative group-hover:scale-102 transition-transform duration-500">
                                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-4 uppercase tracking-wider">
                                        <Sparkles size={12} className="text-amber-500" /> Insight Found
                                    </div>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-light leading-relaxed italic">
                                        "You've mentioned 'tired' every Sunday for a month. Something worth looking at."
                                    </p>
                                </div>
                            </div>
                        </SpotlightCard>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};

/* --- ANTI-FEATURES SECTION --- */
const AntiFeatures = () => {
    return (
        <section className="py-32 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800/80 relative overflow-hidden transition-colors duration-700">
            <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
                <FadeIn direction="up">
                    <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase block mb-3 font-mono">THE ANTI-FEATURES</span>
                    <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">We are proud of what<br />we chose not to build.</h2>
                    <p className="text-lg text-zinc-600 dark:text-zinc-500 font-light mb-16 max-w-2xl mx-auto">
                        Every feature we didn't add was a deliberate choice. Complexity is the enemy of habit. We removed it all.
                    </p>
                </FadeIn>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { icon: Ghost, title: "No Social Feed", desc: "Your thoughts are not content." },
                        { icon: Shield, title: "No Ads, Ever", desc: "Your memories are not inventory." },
                        { icon: Ban, title: "No Streaks", desc: "We don't punish you for living." },
                        { icon: Type, title: "No Rich Text", desc: "No formatting decisions. Just write." }
                    ].map((item, i) => (
                        <FadeIn delay={i * 100} key={i} direction="up" className="group">
                            <div className="h-full p-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 flex flex-col items-center rounded-3xl shadow-sm hover:shadow-md">
                                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:scale-110 transition-all duration-500 mb-4 shadow-inner">
                                    <item.icon size={26} />
                                </div>
                                <h4 className="text-zinc-900 dark:text-white font-bold mb-1 tracking-tight text-lg">{item.title}</h4>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-light leading-relaxed">{item.desc}</p>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* --- TESTIMONIALS SECTION --- */
const Testimonials = () => {
    return (
        <section className="py-32 bg-white dark:bg-zinc-950 px-6 relative transition-colors duration-700 border-t border-zinc-200 dark:border-zinc-800">
            <div className="max-w-7xl mx-auto relative z-10">
                <FadeIn className="text-center mb-20" direction="up">
                    <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase block mb-3 font-mono">REAL PEOPLE</span>
                    <h2 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white tracking-tight mb-6">What a 10-second habit<br />can do in 6 months.</h2>
                </FadeIn>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            quote: "I've tried every journal app. They all felt like school assignments. OneLine is the only one I've actually kept up for more than a week.",
                            author: "Priya",
                            role: "Software Engineer"
                        },
                        {
                            quote: "I use the voice note while driving to work. By the time I park, my thought is saved. It's the first habit I've built in years.",
                            author: "Marcus",
                            role: "Product Designer"
                        },
                        {
                            quote: "Looking back at my entries from 6 months ago is surreal. I had no idea I was going through what I was going through.",
                            author: "Anika",
                            role: "Writer"
                        }
                    ].map((item, i) => (
                        <FadeIn delay={i * 100} key={i} direction="up">
                            <SpotlightCard className="h-full p-8 flex flex-col justify-between rounded-3xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 shadow-sm">
                                <p className="text-zinc-700 dark:text-zinc-300 font-light leading-relaxed text-lg mb-8 italic">
                                    "{item.quote}"
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold font-mono text-sm shadow-inner">
                                        {item.author[0]}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-zinc-900 dark:text-white">{item.author}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-light">{item.role}</div>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* --- ROADMAP SECTION --- */
const Roadmap = () => {
    return (
        <section id="roadmap" className="py-32 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800/80 px-6 relative transition-colors duration-700">
            <div className="max-w-7xl mx-auto relative z-10">
                <FadeIn className="text-center mb-20" direction="up">
                    <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase block mb-3 font-mono">WHAT'S NEXT</span>
                    <h2 className="text-5xl md:text-6xl font-bold text-zinc-900 dark:text-white tracking-tight mb-6">The future of<br />your memory.</h2>
                </FadeIn>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: CloudSun,
                            title: "Mood Weather Map",
                            desc: "See your year as a heatmap of color, one day at a time.",
                            status: "Coming Soon",
                            statusStyle: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20"
                        },
                        {
                            icon: Search,
                            title: "Semantic Search",
                            desc: "Ask \"When was I happiest?\" and actually get an answer.",
                            status: "In Progress",
                            statusStyle: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse"
                        },
                        {
                            icon: BookOpen,
                            title: "Physical Book",
                            desc: "Print your year's entries into a beautiful bound journal.",
                            status: "Planned",
                            statusStyle: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }
                    ].map((item, i) => (
                        <FadeIn delay={i * 100} key={i} direction="up">
                            <SpotlightCard className="h-full p-8 flex flex-col justify-between rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                                <div>
                                    <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 mb-6 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                                        <item.icon size={22} />
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">{item.title}</h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 font-light leading-relaxed mb-6">{item.desc}</p>
                                </div>
                                <span className={cn("text-[10px] font-mono font-bold tracking-wide uppercase px-3 py-1 rounded-full self-start", item.statusStyle)}>
                                    {item.status}
                                </span>
                            </SpotlightCard>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* --- FINAL CTA SECTION --- */
const FinalCTA = () => {
    return (
        <section className="py-36 bg-white dark:bg-zinc-950 px-6 relative overflow-hidden transition-colors duration-700 border-t border-zinc-200 dark:border-zinc-800">
            {/* Glowing background highlights */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="max-w-4xl mx-auto text-center relative z-10">
                <FadeIn direction="up">
                    <h2 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter leading-[0.95] drop-shadow-sm select-none">
                        <span className="hero-line-1 block">One line.</span>
                        <span className="hero-line-2 block">Every day.</span>
                    </h2>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 font-light max-w-lg mx-auto mb-10 leading-relaxed">
                        It takes 10 seconds. Your future self will read these words and thank you.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                        <Link to="/app" onMouseEnter={() => { loadAuthPage(); loadJournalPage(); }} className="group relative w-full sm:w-auto px-10 py-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_35px_rgba(99,102,241,0.2)] active:scale-95">
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                → Begin Your First Entry
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-zinc-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </Link>
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-500 text-sm font-light">No sign-up required to start. Sync later.</p>
                </FadeIn>
            </div>
        </section>
    );
};

/* --- FOOTER --- */
const Footer = () => (
    <footer className="bg-zinc-50 dark:bg-zinc-950 pt-24 pb-12 border-t border-zinc-200 dark:border-white/5 transition-colors duration-700 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5 mb-6 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shadow-md">
                            <div className="w-4 h-0.5 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">OneLine</span>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed max-w-sm font-light">
                        "One thought a day. A life remembered."<br />
                        <span className="text-zinc-400 dark:text-zinc-500 block mt-2 text-xs">Software with soul. Built for people who appreciate the craft of a quiet mind.</span>
                    </p>
                </div>
                <div>
                    <h4 className="text-zinc-900 dark:text-white font-bold text-sm tracking-widest uppercase mb-6 font-mono">Product</h4>
                    <ul className="space-y-4 text-sm text-zinc-500 dark:text-zinc-400 font-light">
                        <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a></li>
                        <li><a href="#philosophy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Philosophy</a></li>
                        <li><a href="#roadmap" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Roadmap</a></li>
                        <li><a href="/docs" className="hover:text-zinc-900 dark:hover:text-white transition-colors">API Docs</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-zinc-900 dark:text-white font-bold text-sm tracking-widest uppercase mb-6 font-mono">Connect</h4>
                    <ul className="space-y-4 text-sm text-zinc-500 dark:text-zinc-400 font-light">
                        <li><Link to="/auth" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Sign In</Link></li>
                        <li><a href="https://github.com/Rohitsbag/OneLine" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white transition-colors">GitHub</a></li>
                        <li><a href="https://github.com/Rohitsbag/OneLine/issues" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1.5"><MessageSquareWarning size={14} /> Report a Bug</a></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-zinc-400 dark:text-zinc-500 text-xs font-light">
                    © {new Date().getFullYear()} OneLine Inc. All rights reserved.
                </p>
                <div className="flex gap-6 text-xs text-zinc-400 dark:text-zinc-500 font-light">
                    <span className="cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy Policy</span>
                    <span className="cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors">Terms of Service</span>
                </div>
            </div>
        </div>
    </footer>
);

export function LandingPage() {
    // Check localStorage or system preference on initial load
    const [isDark, setIsDark] = useState(true);

    // Apply SEO Meta Tags dynamically
    useEffect(() => {
        document.title = "OneLine: The Minimalist Journal That Fits in One Line";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute("content", "OneLine is the fastest journaling app ever made. Write one thought per day in 10 seconds. Voice notes, AI reflections, and offline-first sync included. Free forever.");
        } else {
            const meta = document.createElement('meta');
            meta.name = "description";
            meta.content = "OneLine is the fastest journaling app ever made. Write one thought per day in 10 seconds. Voice notes, AI reflections, and offline-first sync included. Free forever.";
            document.head.appendChild(meta);
        }
    }, []);

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
        <div className="min-h-screen font-sans overflow-x-hidden bg-white dark:bg-zinc-950 transition-colors duration-700 relative">
            {/* Ambient generative abstract backdrop overlays */}
            <div className="absolute top-[18%] left-0 w-full h-[800px] bg-[url('/bg-light.png')] dark:bg-[url('/bg-dark.png')] bg-cover bg-no-repeat bg-center opacity-[0.03] dark:opacity-[0.025] pointer-events-none mix-blend-overlay z-0" />
            <div className="absolute top-[60%] left-0 w-full h-[600px] bg-[url('/bg-light.png')] dark:bg-[url('/bg-dark.png')] bg-cover bg-no-repeat bg-center opacity-[0.02] dark:opacity-[0.015] pointer-events-none mix-blend-overlay z-0" />

            <div className="relative z-10">
                <Navbar isDark={isDark} toggleTheme={toggleTheme} />
                <Hero isDark={isDark} />
                <SocialProofBar />
                <Philosophy />
                <BentoFeatures />
                <AntiFeatures />
                <Testimonials />
                <Roadmap />
                <FinalCTA />
                <Footer />
            </div>
        </div>
    );
}
