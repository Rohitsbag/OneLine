import type { VersionManifest } from '../utils/appUpdater';

interface ForceUpdateDialogProps {
    manifest: VersionManifest;
    onUpdate: () => void;
    downloadProgress?: number;
    isDownloading?: boolean;
    isVerifying?: boolean;
    isInstalling?: boolean;
    error?: string;
}

export function ForceUpdateDialog({
    manifest,
    onUpdate,
    downloadProgress = 0,
    isDownloading = false,
    isVerifying = false,
    isInstalling = false,
    error
}: ForceUpdateDialogProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="mx-4 w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl">
                {/* Header - Critical Update */}
                <div className="mb-4 text-center">
                    <div className="mb-2 text-5xl">⚠️</div>
                    <h2 className="text-xl font-bold text-red-600 dark:text-red-500">
                        Update Required
                    </h2>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        This version is no longer supported. Please update to continue using OneLine.
                    </p>
                </div>

                {/* Version Info */}
                <div className="mb-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-4 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">New Version</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {manifest.version}
                    </p>
                </div>

                {/* Release Notes */}
                {manifest.releaseNotes && (
                    <div className="mb-6 max-h-32 overflow-y-auto rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
                        <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                            {manifest.releaseNotes}
                        </p>
                    </div>
                )}

                {/* Progress Bar */}
                {isDownloading && (
                    <div className="mb-4">
                        <div className="mb-2 flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                            <span>Downloading...</span>
                            <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div
                                className="h-full bg-red-600 transition-all duration-300"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-3">
                        <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Action - No Dismiss Option */}
                <button
                    onClick={onUpdate}
                    disabled={isDownloading || isVerifying || isInstalling}
                    className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                    {isDownloading
                        ? 'Downloading...'
                        : isVerifying
                            ? 'Verifying...'
                            : isInstalling
                                ? 'Installing...'
                                : error
                                    ? 'Retry Update'
                                    : 'Update Now'}
                </button>

                <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-600">
                    The app will not function until updated
                </p>
            </div>
        </div>
    );
}
