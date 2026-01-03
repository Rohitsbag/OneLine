"use client";

import { Calendar, Settings, Sun } from "lucide-react";

interface HeaderProps {
    onOpenCalendar: () => void;
    onOpenSettings: () => void;
}

export function Header({ onOpenCalendar, onOpenSettings }: HeaderProps) {
    return (
        <header className="w-full max-w-3xl flex items-center justify-between py-8 px-4">
            <h1 className="text-xl font-semibold tracking-tight text-white/90">OneLine</h1>

            <div className="flex items-center gap-4 text-zinc-400">
                <button
                    onClick={onOpenCalendar}
                    className="hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-900/50"
                >
                    <Calendar className="w-5 h-5" />
                </button>
                <button className="hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-900/50">
                    <Sun className="w-5 h-5" />
                </button>
                <button
                    onClick={onOpenSettings}
                    className="hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-900/50"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}
