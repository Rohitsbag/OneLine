/**
 * App Update Service - Production Grade
 * 
 * Features:
 * - GitHub Releases hosting (resumable downloads)
 * - SHA-256 integrity verification
 * - Force update enforcement
 * - Kill switch detection
 * - Android permission handling
 * - Exponential backoff retry
 */

import { Capacitor } from '@capacitor/core';
import PackageInfo from '@/plugins/packageInfo';
import FileDownload from '@/plugins/fileDownload';
import APKInstaller from '@/plugins/apkInstaller';
import SHA256Verifier from '@/plugins/sha256Verifier';

// Version manifest structure
export interface VersionManifest {
    version: string;
    versionCode: number;
    downloadUrl: string;
    sha256: string;
    releaseNotes: string;
    minimumVersion: string;
    forceUpdate: boolean;
    killSwitch: boolean;
}

export interface UpdateInfo {
    updateAvailable: boolean;
    manifest?: VersionManifest;
    isForceUpdate?: boolean;
    isKillSwitch?: boolean;
}

const VERSION_CHECK_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

/**
 * Get current app version from package info
 */
async function getAppVersion(): Promise<{ version: string; versionCode: number }> {
    if (!Capacitor.isNativePlatform()) {
        return { version: '0.0.0', versionCode: 0 };
    }

    const info = await PackageInfo.getVersion();
    return info;
}

/**
 * Check for available updates with timeout and retry
 */
export async function checkForUpdate(retryCount = 0): Promise<UpdateInfo> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return { updateAvailable: false };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT);

        const response = await fetch('./version.json', {
            cache: 'no-cache',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Version check failed: ${response.status}`);
        }

        const manifest: VersionManifest = await response.json();
        const localVersion = await getAppVersion();

        // CRITICAL: Check kill switch first
        if (manifest.killSwitch) {
            return {
                updateAvailable: false,
                isKillSwitch: true,
                manifest
            };
        }

        // Check if force update required
        const isForceUpdate = compareVersions(localVersion.version, manifest.minimumVersion) < 0;

        // Check if update available
        const updateAvailable = manifest.versionCode > localVersion.versionCode;

        return {
            updateAvailable,
            manifest,
            isForceUpdate
        };

    } catch (error: any) {
        console.error('Update check failed:', error);

        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES && error.name !== 'AbortError') {
            const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return checkForUpdate(retryCount + 1);
        }

        return { updateAvailable: false };
    }
}

/**
 * Download APK with progress tracking
 * 
 * PRODUCTION NOTE: This requires a custom Capacitor plugin for:
 * 1. Downloading files with progress tracking
 * 2. Saving to external storage (accessible by package installer)
 * 3. Resumable downloads (byte-range requests)
 * 
 * For now, this is a placeholder that shows the intended API
 */
export async function downloadUpdate(
    url: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Downloads only supported on native platforms');
    }

    if (onProgress) {
        await FileDownload.addListener('downloadProgress', (info) => {
            onProgress(info.progress);
        });
    }

    const result = await FileDownload.download({ url }) as any;
    return result.path || '';
}

/**
 * Verify SHA-256 checksum of downloaded file
 * Note: SHA-256 verification requires native implementation or web crypto
 * For production, implement native SHA-256 in Android plugin
 */
export async function verifyChecksum(filePath: string, expectedSha256: string): Promise<boolean> {
    if (!expectedSha256) {
        return true;
    }

    try {
        const result = await SHA256Verifier.verify({
            filePath,
            expectedHash: expectedSha256
        });
        return result.isValid;
    } catch (error) {
        console.error('Checksum verification failed:', error);
        return false;
    }
}

/**
 * Install APK with proper permission handling
 */
export async function installUpdate(filePath: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        throw new Error('Installation only supported on Android');
    }

    const { canInstall } = await APKInstaller.canInstall();

    if (!canInstall) {
        await APKInstaller.openSettings();
        throw new Error('Please enable install permission and try again');
    }

    await APKInstaller.install({ filePath });
}

/**
 * Compare semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }

    return 0;
}

/**
 * Open Android settings for install permissions
 */
export async function openInstallSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return;
    }

    await APKInstaller.openSettings();
}

export async function hasActiveDownload(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return false;
    }
    const { hasActive } = await FileDownload.hasActiveDownload();
    return hasActive;
}

export async function getDownloadState(): Promise<any> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return null;
    }
    return await FileDownload.getDownloadState();
}

export async function deleteFile(filePath: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return;
    }
    await APKInstaller.deleteFile({ filePath });
}

export async function verifyInstallSuccess(expectedVersionCode: number): Promise<boolean> {
    const result = await APKInstaller.verifyInstall({ expectedVersionCode });
    return result.success;
}
