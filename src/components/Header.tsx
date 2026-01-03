import { Calendar, Settings, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_COLORS } from "@/constants/colors";

interface HeaderProps {
    onOpenCalendar: () => void;
    onOpenSettings: () => void;
    isDark: boolean;
    toggleTheme: () => void;
    accentColor?: string;
}

export function Header({ onOpenCalendar, onOpenSettings, isDark, toggleTheme, accentColor = "bg-indigo-500" }: HeaderProps) {
    // Find the current accent color object to get the specific hover shade
    const accentObj = ACCENT_COLORS.find(c => c.bgClass === accentColor) || ACCENT_COLORS[0];
    const hoverTextClass = accentObj.hoverTextClass || "group-hover:text-zinc-200";

    return (
        <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-8 px-4 md:px-0">
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[#18181b] dark:text-white select-none">
                    OneLine
                </h1>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={onOpenCalendar}
                    className="p-2 md:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                    title="Calendar"
                >
                    <Calendar className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors duration-300", hoverTextClass)} />
                </button>

                <button
                    onClick={toggleTheme}
                    className="p-2 md:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                    title="Toggle Theme"
                >
                    {isDark ? (
                        <Sun className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors duration-300", hoverTextClass)} />
                    ) : (
                        <Moon className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors duration-300", hoverTextClass)} />
                    )}
                </button>

                <button
                    onClick={onOpenSettings}
                    className="p-2 md:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                    title="Settings"
                >
                    <Settings className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-colors duration-300", hoverTextClass)} />
                </button>
            </div>
        </header>
    );
}
