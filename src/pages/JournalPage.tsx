import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { JournalEditor } from "@/components/JournalEditor";
import { TimelineView } from "@/components/TimelineView";
import { cn } from "@/lib/utils";
import { WeeklyReflection } from "@/components/WeeklyReflection";
import { CalendarOverlay } from "@/components/CalendarOverlay";
import { SettingsOverlay } from "@/components/SettingsOverlay";
import { supabase } from "@/utils/supabase/client";
import { useNavigate } from "react-router-dom";
import { SignInModal } from "@/components/SignInModal";

interface JournalPageProps {
    externalPinCode?: string | null;
    externalLockEnabled?: boolean;
    onPinChange?: (pin: string | null) => void;
    onLockToggle?: (enabled: boolean) => void;
    initialPinSetupRequired?: boolean;
    onPinSetupComplete?: () => void;
}

export function JournalPage({
    externalPinCode,
    externalLockEnabled,
    onPinChange,
    onLockToggle,
    initialPinSetupRequired,
    onPinSetupComplete
}: JournalPageProps) {
    const [showCalendar, setShowCalendar] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [userId, setUserId] = useState<string | null>(null);
    const [aiEnabled, setAiEnabled] = useState(false); // DEFAULT: OFF as requested
    const [aiRewriteEnabled, setAiRewriteEnabled] = useState(false); // DEFAULT: OFF
    const [sttLanguage, setSttLanguage] = useState("Auto");
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationTime, setNotificationTime] = useState("20:00");
    const [accentColor, setAccentColor] = useState("bg-indigo-500");
    const [mediaDisplayMode, setMediaDisplayMode] = useState<'grid' | 'swipe' | 'scroll'>('grid');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [pullProgress, setPullProgress] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const startY = useRef<number | null>(null);
    const PULL_THRESHOLD = 120;

    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });
    const navigate = useNavigate();

    const [minDate, setMinDate] = useState<Date>(new Date());
    const [isGuest, setIsGuest] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Calendar persistence refs
    const lastCalendarCloseTime = useRef<number>(0);
    const lastCalendarViewDate = useRef<Date | null>(null);
    const [calendarInitialDate, setCalendarInitialDate] = useState<Date | undefined>(undefined);

    const handleOpenCalendar = () => {
        const now = Date.now();
        if (now - lastCalendarCloseTime.current < 5000 && lastCalendarViewDate.current) {
            setCalendarInitialDate(lastCalendarViewDate.current);
        } else {
            setCalendarInitialDate(undefined);
        }
        setShowCalendar(true);
    };

    const handleCloseCalendar = () => {
        lastCalendarCloseTime.current = Date.now();
        setShowCalendar(false);
    };

    // Forced PIN Setup flow
    useEffect(() => {
        if (initialPinSetupRequired) {
            setShowSettings(true);
        }
    }, [initialPinSetupRequired]);

    // Auth & Initial Data Fetch
    useEffect(() => {
        const initData = async () => {
            const cachedUserRaw = localStorage.getItem('cached_user');
            let cachedUser = cachedUserRaw ? JSON.parse(cachedUserRaw) : null;

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user || null;

                if (user) {
                    localStorage.setItem('cached_user', JSON.stringify({
                        id: user.id,
                        email: user.email,
                        created_at: user.created_at
                    }));
                    cachedUser = user;
                    setUserId(user.id);
                } else if (!cachedUser) {
                    setIsGuest(true);
                    setIsLoadingAuth(false);
                    return;
                }
            } catch (error) {
                if (!cachedUser) {
                    setIsGuest(true);
                    setIsLoadingAuth(false);
                    return;
                }
                setUserId(cachedUser.id);
            }

            if (cachedUser) {
                const { data: settings } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', cachedUser.id)
                    .single();

                if (settings) {
                    if (settings.ai_enabled !== undefined) setAiEnabled(settings.ai_enabled);
                    if (settings.ai_rewrite_enabled !== undefined) setAiRewriteEnabled(settings.ai_rewrite_enabled);
                    if (settings.accent_color) setAccentColor(settings.accent_color);
                    if (settings.stt_language) setSttLanguage(settings.stt_language);
                    if (settings.notifications_enabled !== undefined) setNotificationsEnabled(settings.notifications_enabled);
                    if (settings.notification_time) setNotificationTime(settings.notification_time);
                    if (settings.media_display_mode) setMediaDisplayMode(settings.media_display_mode as any);
                }
                if (cachedUser.created_at) setMinDate(new Date(cachedUser.created_at));
            }
            setIsLoadingAuth(false);
        };
        initData();
    }, [navigate]);

    // Theme Toggle
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }

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

    const updateSetting = async (key: string, value: any) => {
        if (!userId) return;
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                [key]: value,
                updated_at: new Date().toISOString()
            });
        if (error) console.error(`Error updating ${key}:`, error);
    };

    const toggleAi = async (enabled: boolean) => {
        setAiEnabled(enabled);
        updateSetting('ai_enabled', enabled);
    };

    const toggleAiRewrite = async (enabled: boolean) => {
        setAiRewriteEnabled(enabled);
        updateSetting('ai_rewrite_enabled', enabled);
    };

    const updateAccentColor = (colorClass: string) => {
        setAccentColor(colorClass);
        updateSetting('accent_color', colorClass);
    };

    const updateMediaDisplayMode = (mode: 'grid' | 'swipe' | 'scroll') => {
        setMediaDisplayMode(mode);
        updateSetting('media_display_mode', mode);
    };

    const scheduleNotifications = async (enabled: boolean, timeStr?: string) => {
        try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

            if (enabled) {
                const targetTime = timeStr || notificationTime;
                const [hour, minute] = targetTime.split(':').map(Number);
                const permission = await LocalNotifications.requestPermissions();
                if (permission.display === 'granted') {
                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                id: 1,
                                title: "Time for your OneLine",
                                body: "Capture your thought for today.",
                                schedule: { allowWhileIdle: true, every: 'day', on: { hour, minute } },
                                smallIcon: "ic_stat_oneline",
                            }
                        ]
                    });
                }
            }
        } catch (e) {
            console.error("Local Notifications error:", e);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY.current === null) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0 && window.scrollY === 0) {
            const progress = Math.min(diff / 1.5, PULL_THRESHOLD + 20);
            setPullProgress(progress);
            if (diff > 20 && e.cancelable) e.preventDefault();
        } else {
            setPullProgress(0);
            setIsPulling(false);
        }
    };

    const handleTouchEnd = () => {
        if (pullProgress > PULL_THRESHOLD) triggerRefresh();
        setPullProgress(0);
        setIsPulling(false);
        startY.current = null;
    };

    const triggerRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
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
                onOpenTimeline={() => setShowTimeline(true)}
                isDark={isDark}
                toggleTheme={() => setIsDark(!isDark)}
                accentColor={accentColor}
            />

            <div
                className="flex-1 w-full relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Pull to Refresh Indicator */}
                <div
                    className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-40 overflow-hidden transition-all duration-300"
                    style={{
                        height: isPulling ? `${pullProgress}px` : '0',
                        opacity: Math.min(pullProgress / PULL_THRESHOLD, 1)
                    }}
                >
                    <div className={cn(
                        "mt-4 p-2 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-transform duration-200",
                        pullProgress > PULL_THRESHOLD ? "scale-110 rotate-180" : "scale-100"
                    )}>
                        <div className={cn(
                            "w-6 h-6 border-2 border-zinc-300 dark:border-zinc-700 rounded-full flex items-center justify-center",
                            pullProgress > PULL_THRESHOLD && "border-t-transparent animate-spin"
                        )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", pullProgress > PULL_THRESHOLD ? "hidden" : accentColor)} />
                        </div>
                    </div>
                </div>

                <JournalEditor
                    key={selectedDate.toISOString()}
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    minDate={minDate}
                    accentColor={accentColor}
                    isGuest={isGuest}
                    onGuestAction={() => setShowAuthModal(true)}
                    refreshTrigger={refreshTrigger}
                    sttLanguage={sttLanguage}
                    aiRewriteEnabled={aiRewriteEnabled}
                    mediaDisplayMode={mediaDisplayMode}
                />

                {aiEnabled && (
                    <div className="w-full px-4 pb-12">
                        <WeeklyReflection accentColor={accentColor} key={`reflection-${refreshTrigger}`} date={selectedDate} />
                    </div>
                )}
            </div>

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
                userId={userId}
            />

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => {
                    setShowSettings(false);
                    if (initialPinSetupRequired) onPinSetupComplete?.();
                }}
                aiEnabled={aiEnabled}
                onToggleAi={toggleAi}
                aiRewriteEnabled={aiRewriteEnabled}
                onToggleAiRewrite={toggleAiRewrite}
                accentColor={accentColor}
                onAccentChange={updateAccentColor}
                sttLanguage={sttLanguage}
                onLanguageChange={(lang: string) => {
                    setSttLanguage(lang);
                    updateSetting('stt_language', lang);
                }}
                lockEnabled={externalLockEnabled}
                onToggleLock={(enabled) => {
                    onLockToggle?.(enabled);
                    updateSetting('lock_enabled', enabled);
                }}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={(enabled) => {
                    setNotificationsEnabled(enabled);
                    updateSetting('notifications_enabled', enabled);
                    scheduleNotifications(enabled);
                }}
                notificationTime={notificationTime}
                onTimeChange={(time) => {
                    setNotificationTime(time);
                    updateSetting('notification_time', time);
                    if (notificationsEnabled) scheduleNotifications(true, time);
                }}
                pinCode={externalPinCode}
                onPinChange={(val) => {
                    onPinChange?.(val);
                }}
                isForcedSetup={initialPinSetupRequired}
                mediaDisplayMode={mediaDisplayMode}
                onMediaDisplayModeChange={updateMediaDisplayMode}
            />

            {userId && (
                <TimelineView
                    userId={userId}
                    currentDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onClose={() => setShowTimeline(false)}
                    isOpen={showTimeline}
                    accentColor={accentColor}
                />
            )}

            <SignInModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </div>
    );
}
