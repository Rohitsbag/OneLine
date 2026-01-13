import { Calendar, Settings, Sun, Moon, Clock, LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
    onOpenCalendar: () => void;
    onOpenSettings: () => void;
    onOpenTimeline: () => void;
    isDark: boolean;
    toggleTheme: () => void;
    accentColor?: string;
}

export function Header({ onOpenCalendar, onOpenSettings, onOpenTimeline, isDark, toggleTheme, accentColor = "bg-indigo-500" }: HeaderProps) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Find the current accent color object to get the specific hover shade
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverTextClass = accentObj.hoverTextClass || "group-hover:text-zinc-200";

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const menuItems = [
        { icon: Calendar, label: "Calendar", onClick: onOpenCalendar },
        { icon: Clock, label: "Timeline", onClick: onOpenTimeline },
        { icon: isDark ? Sun : Moon, label: isDark ? "Light Mode" : "Dark Mode", onClick: toggleTheme },
        { icon: Settings, label: "Settings", onClick: onOpenSettings },
    ];

    return (
        <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-8 px-4 md:px-0 relative z-[60]">
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[#18181b] dark:text-white select-none">
                    OneLine
                </h1>
            </div>

            <div className="flex items-center gap-2 relative" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 md:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                    title="Menu"
                >
                    {showMenu ? (
                        <X className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors duration-300", hoverTextClass)} />
                    ) : (
                        <LayoutGrid className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors duration-300", hoverTextClass)} />
                    )}
                </button>

                {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-2 animate-in fade-in zoom-in-95 duration-200">
                        {menuItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    item.onClick();
                                    setShowMenu(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
                            >
                                <item.icon className={cn("w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-colors group-hover:text-zinc-900 dark:group-hover:text-white", hoverTextClass)} />
                                <span className="font-medium group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
}
