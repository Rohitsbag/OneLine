import { useState, useEffect, useRef, useCallback } from "react";
import { format, subDays } from "date-fns";
import { Header } from "@/components/Header";
import { JournalEditor } from "@/components/JournalEditor";
import { TimelineView } from "@/components/TimelineView";
import { cn } from "@/lib/utils";
import { WeeklyReflection } from "@/components/WeeklyReflection";
import { CalendarOverlay } from "@/components/CalendarOverlay";
import { SettingsOverlay } from "@/components/SettingsOverlay";
import { supabase } from "@/utils/supabase/client";
import { SignInModal } from "@/components/SignInModal";

// NEW INFRASTRUCTURE
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { OfflineQueue } from "@/utils/offlineQueue";
import { WifiOff } from "lucide-react";

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
    // --------------------------------------------------------------------------------
    // INFRASTRUCTURE & SHARED STATE
    // --------------------------------------------------------------------------------
    const { connected: isOnline } = useNetworkStatus();
    const { userId, isGuest, isLoading: isLoadingAuth, createdAt: userCreatedAt } = useAuth(isOnline);
    const { settings, updateSetting, refresh: refreshSettings } = useSettings(userId, isOnline);

    // UI Local State
    const [showCalendar, setShowCalendar] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [pullProgress, setPullProgress] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    const startY = useRef<number | null>(null);
    const PULL_THRESHOLD = 120;

    const [isDark, setIsDark] = useState(() => {
        const saved = Storage.getSync(STORAGE_KEYS.THEME);
        if (saved) return saved === 'dark';
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    const minDate = userCreatedAt ? new Date(userCreatedAt) : new Date();

    // --------------------------------------------------------------------------------
    // SYNC & MUTATIONS
    // --------------------------------------------------------------------------------
    const deepSyncEntries = useCallback(async (uid: string) => {
        if (!isOnline) return;
        try {
            const dates = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
            const { data: entries } = await supabase
                .from('entries')
                .select('id, date, content, media_items, updated_at')
                .eq('user_id', uid)
                .in('date', dates);

            if (entries) {
                for (const entry of entries) {
                    await Storage.setJSON(STORAGE_KEYS.ENTRY_CACHE(uid, entry.date), entry);
                }
            }
        } catch (e) {
            console.error("[JournalPage] Deep sync failed", e);
        }
    }, [isOnline]);

    // Handle background sync when coming online
    useEffect(() => {
        if (isOnline && userId) {
            const flushQueue = async () => {
                const result = await OfflineQueue.flush(userId);
                if (result.success > 0) {
                    setPendingSyncCount(await OfflineQueue.getPendingCount(userId));
                }
                refreshSettings();
                deepSyncEntries(userId);
            };
            flushQueue();
        }
    }, [isOnline, userId, refreshSettings, deepSyncEntries]);

    // Check queue count periodically
    useEffect(() => {
        if (userId) {
            OfflineQueue.getPendingCount(userId).then(setPendingSyncCount);
        }
    }, [userId, refreshTrigger]);

    // Forced PIN Setup flow
    useEffect(() => {
        if (initialPinSetupRequired) {
            setShowSettings(true);
        }
    }, [initialPinSetupRequired]);

    // --------------------------------------------------------------------------------
    // THEME & UX
    // --------------------------------------------------------------------------------
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.toggle('dark', isDark);
        Storage.set(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
        if (userId) {
            updateSetting('theme' as any, isDark ? 'dark' : 'light');
        }
    }, [isDark, userId, updateSetting]);

    // Standard vibration fallback
    const triggerHaptic = (pattern: number = 10) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    const scheduleNotifications = async (enabled: boolean, timeStr?: string) => {
        try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

            if (enabled) {
                const targetTime = timeStr || settings.notification_time;
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

    // --------------------------------------------------------------------------------
    // CALENDAR PERSISTENCE
    // --------------------------------------------------------------------------------
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

    // --------------------------------------------------------------------------------
    // PULL-TO-REFRESH
    // --------------------------------------------------------------------------------
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
        if (pullProgress > PULL_THRESHOLD) {
            setRefreshTrigger(prev => prev + 1);
            triggerHaptic(15);
            if (isOnline && userId) {
                refreshSettings();
                deepSyncEntries(userId);
            }
        }
        setPullProgress(0);
        setIsPulling(false);
        startY.current = null;
    };

    // --------------------------------------------------------------------------------
    // RENDER
    // --------------------------------------------------------------------------------
    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center w-full font-sans animate-in fade-in duration-700">
            {/* Offline/Sync Banner */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500/90 backdrop-blur-md text-white py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-lg">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Working Offline</span>
                    {pendingSyncCount > 0 && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full">
                            {pendingSyncCount} changes to sync
                        </span>
                    )}
                </div>
            )}

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
                accentColor={settings.accent_color}
            />

            <div
                className={cn("flex-1 w-full relative", !isOnline && "mt-8")}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ overscrollBehaviorY: 'contain' }}
            >
                {/* Pull-to-refresh Indicator */}
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
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                pullProgress > PULL_THRESHOLD ? "hidden" : settings.accent_color
                            )} />
                        </div>
                    </div>
                </div>

                <JournalEditor
                    key={selectedDate.toISOString()}
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    minDate={minDate}
                    accentColor={settings.accent_color}
                    isGuest={isGuest}
                    onGuestAction={() => setShowAuthModal(true)}
                    refreshTrigger={refreshTrigger}
                    sttLanguage={settings.stt_language}
                    aiRewriteEnabled={settings.ai_rewrite_enabled}
                    mediaDisplayMode={settings.media_display_mode}
                />

                {settings.ai_enabled && (
                    <div className="w-full px-4 pb-12">
                        <WeeklyReflection
                            accentColor={settings.accent_color}
                            key={`reflection-${refreshTrigger}`}
                            date={selectedDate}
                        />
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
                onMonthChange={(date) => { lastCalendarViewDate.current = date; }}
                accentColor={settings.accent_color}
                userId={userId}
            />

            <SettingsOverlay
                isOpen={showSettings}
                onClose={() => {
                    setShowSettings(false);
                    if (initialPinSetupRequired) onPinSetupComplete?.();
                }}
                aiEnabled={settings.ai_enabled}
                onToggleAi={(v) => updateSetting('ai_enabled', v)}
                aiRewriteEnabled={settings.ai_rewrite_enabled}
                onToggleAiRewrite={(v) => updateSetting('ai_rewrite_enabled', v)}
                accentColor={settings.accent_color}
                onAccentChange={(v) => updateSetting('accent_color', v)}
                sttLanguage={settings.stt_language}
                onLanguageChange={(v) => updateSetting('stt_language', v)}
                lockEnabled={externalLockEnabled}
                onToggleLock={(v) => {
                    onLockToggle?.(v);
                    updateSetting('lock_enabled', v);
                }}
                notificationsEnabled={settings.notifications_enabled}
                onToggleNotifications={(v) => {
                    updateSetting('notifications_enabled', v);
                    scheduleNotifications(v);
                }}
                notificationTime={settings.notification_time}
                onTimeChange={(v) => {
                    updateSetting('notification_time', v);
                    if (settings.notifications_enabled) scheduleNotifications(true, v);
                }}
                pinCode={externalPinCode}
                onPinChange={onPinChange}
                isForcedSetup={initialPinSetupRequired}
                mediaDisplayMode={settings.media_display_mode}
                onMediaDisplayModeChange={(v) => updateSetting('media_display_mode', v)}
            />

            {userId && (
                <TimelineView
                    userId={userId}
                    currentDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onClose={() => setShowTimeline(false)}
                    isOpen={showTimeline}
                    accentColor={settings.accent_color}
                />
            )}

            <SignInModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </div>
    );
}
