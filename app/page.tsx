"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { JournalEditor } from "@/components/JournalEditor";
import { WeeklyReflection } from "@/components/WeeklyReflection";
import { CalendarOverlay } from "@/components/CalendarOverlay";
import { SettingsOverlay } from "@/components/SettingsOverlay";

export default function Home() {
    const [showCalendar, setShowCalendar] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    // Ideally lift selectedDate to here so Calendar can change it
    // For MVP speed, we'll keep it simple or implement the lift now.
    // Let's rely on default behavior for now, but a lift would be better.
    // Actually JournalEditor has its own state. 
    // Let's pass a key to JournalEditor to force re-render if we wanted, 
    // or better: Lift the state.

    // LIFTING STATE
    const [selectedDate, setSelectedDate] = useState(new Date());

    return (
        <main className="flex min-h-screen flex-col items-center w-full bg-[#050505] selection:bg-zinc-800">
            <Header
                onOpenCalendar={() => setShowCalendar(true)}
                onOpenSettings={() => setShowSettings(true)}
            />

            <JournalEditor
                date={selectedDate}
                onDateChange={setSelectedDate}
            />

            <div className="w-full px-4 pb-12">
                <WeeklyReflection />
            </div>

            <CalendarOverlay
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
            />

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </main>
    );
}
