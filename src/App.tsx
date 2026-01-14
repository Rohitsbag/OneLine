import { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/utils/supabase/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { checkForUpdate, downloadUpdate, verifyChecksum, installUpdate, verifyInstallSuccess, hasActiveDownload, getDownloadState, deleteFile, type VersionManifest } from '@/utils/appUpdater';
import { UpdateDialog } from '@/components/UpdateDialog';
import { ForceUpdateDialog } from '@/components/ForceUpdateDialog';
import { KillSwitchDialog } from '@/components/KillSwitchDialog';
import { PinLock } from '@/components/PinLock';

// Lazy load pages for performance optimization
export const loadAuthPage = () => import('@/pages/AuthPage');
export const loadJournalPage = () => import('@/pages/JournalPage');

const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => loadAuthPage().then(m => ({ default: m.AuthPage })));
const JournalPage = lazy(() => loadJournalPage().then(m => ({ default: m.JournalPage })));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('@/pages/TermsOfService').then(m => ({ default: m.TermsOfService })));

// Minimalist loading placeholder
const PageLoader = () => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
    </div>
);

function App() {
    const navigate = useNavigate();
    const location = useLocation();

    // Security State
    const [isLocked, setIsLocked] = useState(false);
    const [pinCode, setPinCode] = useState<string | null>(null);
    const [lockEnabled, setLockEnabled] = useState(false);
    const [accentColor, setAccentColor] = useState("bg-indigo-500");
    const lastBackgroundTime = useRef<number | null>(null);
    const [isPinSetupRequired, setIsPinSetupRequired] = useState(false);

    // Update system state
    const [updateManifest, setUpdateManifest] = useState<VersionManifest | null>(null);
    const [showUpdate, setShowUpdate] = useState(false);
    const [showForceUpdate, setShowForceUpdate] = useState(false);
    const [showKillSwitch, setShowKillSwitch] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    // Initial Security & Settings Load
    useEffect(() => {
        const loadSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: settings } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (settings) {
                    setPinCode(settings.pin_code);
                    setLockEnabled(!!settings.lock_enabled);
                    setAccentColor(settings.accent_color || "bg-indigo-500");

                    // Production-Grade PIN Logic
                    const cachedPinHash = localStorage.getItem(`pin_hash_${user.id}`);

                    if (settings.lock_enabled) {
                        if (cachedPinHash) {
                            setIsLocked(true);
                        } else {
                            // CASE: App Reinstall or Cache Cleared but Server says Locked
                            setIsPinSetupRequired(true);
                        }
                    }
                }
            }
        };
        loadSettings();
    }, []);

    // Check for updates on app launch (Android only)
    useEffect(() => {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
            // Check for updates
            const performUpdateCheck = async () => {
                try {
                    const updateInfo = await checkForUpdate();
                    if (updateInfo.isKillSwitch) {
                        setUpdateManifest(updateInfo.manifest!);
                        setShowKillSwitch(true);
                    } else if (updateInfo.updateAvailable) {
                        setUpdateManifest(updateInfo.manifest!);
                        if (updateInfo.isForceUpdate) {
                            setShowForceUpdate(true);
                        } else {
                            setShowUpdate(true);
                        }
                    }
                } catch (error) {
                    console.error('Update check failed:', error);
                }
            };

            performUpdateCheck();

            // Resume existing download if active
            const checkActiveDownload = async () => {
                const active = await hasActiveDownload();
                if (active) {
                    const state = await getDownloadState();
                    if (state && state.url) {
                        // Re-fetch manifest to get info
                        const info = await checkForUpdate();
                        if (info.manifest) {
                            setUpdateManifest(info.manifest);
                            setDownloadProgress(Math.round((state.downloaded / state.total) * 100));
                            setIsDownloading(true);
                            // Re-trigger handleUpdate to attach listener and wait for finish
                            handleUpdate(info.manifest.downloadUrl);
                        }
                    }
                }
            };

            checkActiveDownload();
        }
    }, [location, navigate]);

    // Global App Listeners (Updates & Security)
    useEffect(() => {
        const handleAppResume = async () => {
            // 1. Update verification
            const pending = localStorage.getItem('pending_update_verif');
            if (pending) {
                const versionCode = parseInt(pending);
                const success = await verifyInstallSuccess(versionCode);
                if (success) {
                    localStorage.removeItem('pending_update_verif');
                    const state = await getDownloadState();
                    if (state && state.filePath) {
                        await deleteFile(state.filePath);
                    }
                    window.location.reload();
                }
            }

            // 2. Security Re-lock
            if (lockEnabled && pinCode && lastBackgroundTime.current) {
                const now = Date.now();
                const diff = (now - lastBackgroundTime.current) / 1000;
                // Auto-lock if backgrounded for more than 60 seconds (Production Threshold)
                if (diff > 60) {
                    setIsLocked(true);
                }
                lastBackgroundTime.current = null;
            }
        };

        const handleAppStateChange = (state: { isActive: boolean }) => {
            if (!state.isActive) {
                lastBackgroundTime.current = Date.now();
            } else {
                handleAppResume();
            }
        };

        const CapApp = (Capacitor as any).Plugins?.App;
        if (CapApp) {
            const listener = CapApp.addListener('appStateChange', handleAppStateChange);
            return () => {
                listener.remove();
            };
        }
    }, [lockEnabled, pinCode]);

    // Handle update download and installation
    const handleUpdate = async (overrideUrl?: string) => {
        const url = overrideUrl || updateManifest?.downloadUrl;
        if (!url) return;

        try {
            setUpdateError(null);
            setIsDownloading(true);

            // Download APK
            const filePath = await downloadUpdate(url, (progress) => {
                setDownloadProgress(progress);
            });

            setIsDownloading(false);
            setIsVerifying(true);

            // Verify checksum (if provided)
            if (updateManifest?.sha256) {
                const isValid = await verifyChecksum(filePath, updateManifest.sha256);
                if (!isValid) {
                    throw new Error('Checksum verification failed. Please try again.');
                }
            }

            setIsVerifying(false);
            setIsInstalling(true);

            // Store pending verification for after resume
            if (updateManifest?.versionCode) {
                localStorage.setItem('pending_update_verif', updateManifest.versionCode.toString());
            }

            // Install APK
            await installUpdate(filePath);

            // Installation prompt shown by Android - app will close and update
            // Reset state in case user cancels
            setIsInstalling(false);

        } catch (error: any) {
            console.error('Update failed:', error);
            setUpdateError(error.message || 'Update failed. Please try again.');
            setIsDownloading(false);
            setIsVerifying(false);
            setIsInstalling(false);
        }
    };

    useEffect(() => {
        if (Capacitor.isNativePlatform() && location.pathname === '/') {
            navigate('/app');
        }
    }, [location, navigate]);

    return (
        <ErrorBoundary>
            {/* PIN Lock Overlay - Global Security */}
            {isLocked && lockEnabled && pinCode && (
                <PinLock onUnlock={() => setIsLocked(false)} accentColor={accentColor} storedPin={pinCode} />
            )}

            {/* Kill Switch Dialog - Blocks everything */}
            {showKillSwitch && updateManifest && (
                <KillSwitchDialog />
            )}

            {/* Force Update Dialog - Blocks app usage */}
            {showForceUpdate && updateManifest && !showKillSwitch && (
                <ForceUpdateDialog
                    manifest={updateManifest}
                    onUpdate={() => handleUpdate()}
                    downloadProgress={downloadProgress}
                    isDownloading={isDownloading}
                    isVerifying={isVerifying}
                    isInstalling={isInstalling}
                    error={updateError || undefined}
                />
            )}

            {/* Normal Update Dialog - Dismissible */}
            {showUpdate && updateManifest && !showKillSwitch && !showForceUpdate && (
                <UpdateDialog
                    manifest={updateManifest}
                    onUpdate={() => handleUpdate()}
                    onDismiss={() => setShowUpdate(false)}
                    downloadProgress={downloadProgress}
                    isDownloading={isDownloading}
                    isVerifying={isVerifying}
                    isInstalling={isInstalling}
                    error={updateError || undefined}
                />
            )}

            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route
                        path="/app"
                        element={
                            <JournalPage
                                externalPinCode={pinCode}
                                externalLockEnabled={lockEnabled}
                                onPinChange={(pin: string | null) => setPinCode(pin)}
                                onLockToggle={(enabled: boolean) => setLockEnabled(enabled)}
                                initialPinSetupRequired={isPinSetupRequired}
                                onPinSetupComplete={() => setIsPinSetupRequired(false)}
                            />
                        }
                    />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                </Routes>
            </Suspense>
        </ErrorBoundary>
    );
}

export default App;
