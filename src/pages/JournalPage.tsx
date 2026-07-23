import { useState, useEffect } from "react";
import { addDays, subDays } from "date-fns";
import { Header } from "@/components/Header";
import { JournalEditor } from "@/components/JournalEditor";
import { TimelineView } from "@/components/TimelineView";
import { CalendarOverlay } from "@/components/CalendarOverlay";
import { SettingsOverlay } from "@/components/SettingsOverlay";
import { SignInModal } from "@/components/SignInModal";
import { ReflectionOverlay } from "@/components/ReflectionOverlay";
import { CinematicOverlay } from "@/components/CinematicOverlay";
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { WifiOff } from "lucide-react";

export function JournalPage() {
    const { connected: isOnline } = useNetworkStatus();
    const { userId, isGuest, isLoading: isLoadingAuth, createdAt: userCreatedAt } = useAuth();
    const { settings, updateSetting } = useSettings(userId, isOnline);

    const [showCalendar, setShowCalendar] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [showReflection, setShowReflection] = useState(false);
    const [showCinematic, setShowCinematic] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [isDark, setIsDark] = useState(() => {
        const saved = Storage.getSync(STORAGE_KEYS.THEME);
        if (saved) return saved === "dark";
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    // Keyboard Shortcuts (Cmd/Ctrl + Left/Right/T/K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (!isMod) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setSelectedDate(prev => subDays(prev, 1));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setSelectedDate(prev => {
                    const next = addDays(prev, 1);
                    return next > new Date() ? prev : next;
                });
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                setSelectedDate(new Date());
            } else if (e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                setShowTimeline(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // The earliest date a user can navigate to
    const minDate = userCreatedAt
        ? new Date(userCreatedAt)
        : new Date(new Date().setFullYear(new Date().getFullYear() - 10));

    useEffect(() => {
        document.documentElement.classList.toggle("dark", isDark);
        Storage.set(STORAGE_KEYS.THEME, isDark ? "dark" : "light");
    }, [isDark]);

    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center w-full font-sans animate-in fade-in duration-500">

            {/* Offline banner */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500/90 backdrop-blur-md text-white py-2 text-xs font-medium flex items-center justify-center gap-2">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Working Offline — changes saved locally</span>
                </div>
            )}

            <Header
                onOpenCalendar={() => setShowCalendar(true)}
                onOpenSettings={() => setShowSettings(true)}
                onOpenTimeline={() => setShowTimeline(true)}
                onOpenReflection={() => setShowReflection(true)}
                onOpenCinematic={() => setShowCinematic(true)}
                isDark={isDark}
                toggleTheme={() => setIsDark(!isDark)}
                accentColor={settings.accent_color}
            />

            <div className={`flex-1 w-full ${!isOnline ? "mt-8" : ""}`}>
                <JournalEditor
                    key={selectedDate.toISOString()}
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    minDate={minDate}
                    accentColor={settings.accent_color}
                />
            </div>

            <CalendarOverlay
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                minDate={minDate}
                accentColor={settings.accent_color}
                userId={userId}
            />

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                accentColor={settings.accent_color}
                onAccentChange={(v) => updateSetting("accent_color", v)}
            />

            <TimelineView
                userId={userId || ""}
                currentDate={selectedDate}
                onDateSelect={setSelectedDate}
                onClose={() => setShowTimeline(false)}
                isOpen={showTimeline}
                accentColor={settings.accent_color}
                isGuest={isGuest}
            />

            <ReflectionOverlay
                isOpen={showReflection}
                onClose={() => setShowReflection(false)}
                userId={userId || ""}
                isGuest={isGuest}
                accentColor={settings.accent_color}
            />

            <CinematicOverlay
                isOpen={showCinematic}
                onClose={() => setShowCinematic(false)}
                userId={userId || ""}
                isGuest={isGuest}
            />

            <SignInModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </div>
    );
}
