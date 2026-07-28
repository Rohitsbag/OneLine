import { Calendar, Settings, Sun, Moon, Clock, Sparkles, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
    onOpenCalendar: () => void;
    onOpenSettings: () => void;
    onOpenTimeline: () => void;
    onOpenReflection: () => void;
    onOpenCinematic?: () => void;
    onOpenStudio?: () => void;
    isDark: boolean;
    toggleTheme: () => void;
    accentColor?: string;
    isGuest?: boolean;
    userEmail?: string | null;
}

export function Header({
    onOpenCalendar,
    onOpenSettings,
    onOpenTimeline,
    onOpenReflection,
    onOpenCinematic,
    onOpenStudio,
    isDark,
    toggleTheme,
    accentColor = "bg-indigo-500",
    isGuest = false,
    userEmail,
}: HeaderProps) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverTextClass = accentObj.hoverTextClass || "group-hover:text-zinc-900";

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const menuItems = [
        { icon: Calendar, label: "Calendar", onClick: onOpenCalendar },
        { icon: Clock, label: "Timeline", onClick: onOpenTimeline },
        ...(onOpenStudio ? [{ icon: Sparkles, label: "Studio", onClick: onOpenStudio }] : []),
        { icon: Settings, label: "Settings", onClick: onOpenSettings },
        { icon: isDark ? Sun : Moon, label: isDark ? "Light Mode" : "Dark Mode", onClick: toggleTheme },
    ];

    return (
        <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-8 px-4 md:px-0 relative z-[60]">
            <h1 className="text-xl font-semibold tracking-tight text-[#18181b] dark:text-white select-none">
                OneLine
            </h1>

            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 md:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative"
                    title={isGuest ? "Not signed in" : `Signed in as ${userEmail || "user"}`}
                >
                    <div className="flex flex-col gap-1">
                        <span className={cn("block w-5 h-0.5 bg-zinc-400 transition-all", showMenu && "rotate-45 translate-y-1.5")} />
                        <span className={cn("block w-5 h-0.5 bg-zinc-400 transition-all", showMenu && "opacity-0")} />
                        <span className={cn("block w-5 h-0.5 bg-zinc-400 transition-all", showMenu && "-rotate-45 -translate-y-1.5")} />
                    </div>

                    {/* Subtle status indicator dot */}
                    <span 
                        className={cn(
                            "absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-zinc-50 dark:ring-[#050505] transition-colors",
                            isGuest ? "bg-rose-500" : "bg-emerald-500"
                        )} 
                    />
                </button>

                {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-2 animate-in fade-in zoom-in-95 duration-150">
                        {/* Subtle non-bold email / sign-in status header */}
                        <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/60 mb-1 flex items-center gap-2">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isGuest ? "bg-rose-500" : "bg-emerald-500")} />
                            <span className="text-[11px] text-zinc-400 font-normal truncate">
                                {isGuest ? "Not signed in" : userEmail || "Signed in"}
                            </span>
                        </div>

                        {menuItems.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => { item.onClick(); setShowMenu(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group cursor-pointer"
                            >
                                <item.icon className={cn("w-4 h-4 text-zinc-400 shrink-0 transition-colors", hoverTextClass)} />
                                <span className="font-medium whitespace-nowrap">{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
}
