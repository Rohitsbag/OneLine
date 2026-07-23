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
    isDark: boolean;
    toggleTheme: () => void;
    accentColor?: string;
}

export function Header({
    onOpenCalendar,
    onOpenSettings,
    onOpenTimeline,
    onOpenReflection,
    onOpenCinematic,
    isDark,
    toggleTheme,
    accentColor = "bg-indigo-500",
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
        { icon: Sparkles, label: "AI Reflection", onClick: onOpenReflection },
        ...(onOpenCinematic ? [{ icon: Film, label: "Cinematic Mode", onClick: onOpenCinematic }] : []),
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
                    className="p-2 md:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    title="Menu"
                >
                    <div className="flex flex-col gap-1">
                        <span className={cn("block w-5 h-0.5 bg-zinc-400 transition-all", showMenu && "rotate-45 translate-y-1.5")} />
                        <span className={cn("block w-5 h-0.5 bg-zinc-400 transition-all", showMenu && "opacity-0")} />
                        <span className={cn("block w-5 h-0.5 bg-zinc-400 transition-all", showMenu && "-rotate-45 -translate-y-1.5")} />
                    </div>
                </button>

                {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-2 animate-in fade-in zoom-in-95 duration-150">
                        {menuItems.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => { item.onClick(); setShowMenu(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
                            >
                                <item.icon className={cn("w-4 h-4 text-zinc-400 transition-colors", hoverTextClass)} />
                                <span className="font-medium">{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
}
