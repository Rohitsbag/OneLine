import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { JournalEditor } from "@/components/JournalEditor";
import { WeeklyReflection } from "@/components/WeeklyReflection";
import { CalendarOverlay } from "@/components/CalendarOverlay";
import { SettingsOverlay } from "@/components/SettingsOverlay";
import { supabase } from "@/utils/supabase/client";
import { useNavigate } from "react-router-dom";
import { SignInModal } from "@/components/SignInModal";

export function JournalPage() {
    const [showCalendar, setShowCalendar] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [aiEnabled, setAiEnabled] = useState(true);
    const [accentColor, setAccentColor] = useState("bg-indigo-500"); // Default
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) {
                return saved === 'dark';
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });
    const navigate = useNavigate();

    const [minDate, setMinDate] = useState<Date>(new Date()); // Default to today until loaded

    // Calendar persistence refs
    const lastCalendarCloseTime = useRef<number>(0);
    const lastCalendarViewDate = useRef<Date | null>(null);
    const [calendarInitialDate, setCalendarInitialDate] = useState<Date | undefined>(undefined);

    const handleOpenCalendar = () => {
        const now = Date.now();
        // If reopened within 5 seconds, restore the last viewed month
        if (now - lastCalendarCloseTime.current < 5000 && lastCalendarViewDate.current) {
            setCalendarInitialDate(lastCalendarViewDate.current);
        } else {
            setCalendarInitialDate(undefined); // Reset to selectedDate
        }
        setShowCalendar(true);
    };

    const handleCloseCalendar = () => {
        lastCalendarCloseTime.current = Date.now();
        setShowCalendar(false);
    };

    const [isGuest, setIsGuest] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Auth & Initial Data Fetch (OFFLINE-FIRST)
    useEffect(() => {
        const initData = async () => {
            // OFFLINE-FIRST: Try to get cached user first for instant startup
            const cachedUserRaw = localStorage.getItem('cached_user');
            let cachedUser = cachedUserRaw ? JSON.parse(cachedUserRaw) : null;

            // Try to get fresh session
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user || null;

                if (user) {
                    // Cache user for offline use
                    localStorage.setItem('cached_user', JSON.stringify({
                        id: user.id,
                        email: user.email,
                        created_at: user.created_at
                    }));
                    cachedUser = user;
                } else if (!cachedUser) {
                    // No session and no cache = guest mode
                    setIsGuest(true);
                    setIsLoadingAuth(false);
                    return;
                }
                // If we have cachedUser but no fresh session, continue in offline mode
            } catch (error) {
                // Network error - continue with cached user if available
                console.log('Auth check failed (offline?), using cached user');
                if (!cachedUser) {
                    setIsGuest(true);
                    setIsLoadingAuth(false);
                    return;
                }
            }

            // 1. Set Min Date (Account Creation)
            if (cachedUser?.created_at) {
                setMinDate(new Date(cachedUser.created_at));
            }

            // 2. Load User Settings (try from cache first, then server)
            let settings = null;
            const cachedSettings = localStorage.getItem('cached_user_settings');

            try {
                const { data } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', cachedUser.id)
                    .single();

                if (data) {
                    settings = data;
                    localStorage.setItem('cached_user_settings', JSON.stringify(data));
                }
            } catch (error) {
                // Offline - use cached settings
                if (cachedSettings) {
                    settings = JSON.parse(cachedSettings);
                }
            }

            if (settings) {
                setAiEnabled(settings.ai_enabled ?? true);
                const localTheme = localStorage.getItem('theme');
                if (!localTheme && settings.theme) {
                    setIsDark(settings.theme === 'dark');
                }
                if (settings.accent_color) {
                    setAccentColor(settings.accent_color);
                }
            }
            setIsLoadingAuth(false);
        };
        initData();
    }, [navigate]);

    // Theme Toggle & Persistence
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

        // Persist to DB (Fire and forget)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from('user_settings').upsert({
                    user_id: user.id,
                    theme: isDark ? 'dark' : 'light',
                    updated_at: new Date().toISOString()
                }).then(() => { });
            }
        });
    }, [isDark]);

    // AI Toggle Persistence
    const toggleAi = async (enabled: boolean) => {
        setAiEnabled(enabled);
        updateSetting('ai_enabled', enabled);
    };

    const updateAccentColor = (colorClass: string) => {
        setAccentColor(colorClass);
        updateSetting('accent_color', colorClass);
    };

    const updateSetting = async (key: string, value: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('user_settings').upsert({
                user_id: user.id,
                [key]: value,
                updated_at: new Date().toISOString()
            });
        }
    };

    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center w-full font-sans animate-in fade-in duration-700">
            <Header
                onOpenCalendar={handleOpenCalendar}
                onOpenSettings={() => {
                    if (isGuest) {
                        setShowAuthModal(true);
                        return;
                    }
                    setShowSettings(true);
                }}
                isDark={isDark}
                toggleTheme={() => setIsDark(!isDark)}
                accentColor={accentColor}
            />

            <JournalEditor
                date={selectedDate}
                onDateChange={setSelectedDate}
                minDate={minDate}
                accentColor={accentColor}
                isGuest={isGuest}
                onGuestAction={() => setShowAuthModal(true)}
            />

            {aiEnabled && (
                <div className="w-full px-4 pb-12">
                    <WeeklyReflection accentColor={accentColor} />
                </div>
            )}

            <CalendarOverlay
                isOpen={showCalendar}
                onClose={handleCloseCalendar}
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                    setSelectedDate(date);
                    lastCalendarViewDate.current = date;
                }}
                minDate={minDate}
                initialViewDate={calendarInitialDate}
                onMonthChange={(date) => lastCalendarViewDate.current = date}
                accentColor={accentColor}
            />

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                aiEnabled={aiEnabled}
                onToggleAi={toggleAi}
                accentColor={accentColor}
                onAccentChange={updateAccentColor}
            />

            <SignInModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </div>
    );
}
