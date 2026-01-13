import type { VersionManifest } from '../utils/appUpdater';

interface UpdateDialogProps {
    manifest: VersionManifest;
    onUpdate: () => void;
    onDismiss: () => void;
    downloadProgress?: number;
    isDownloading?: boolean;
    isVerifying?: boolean;
    isInstalling?: boolean;
    error?: string;
}

export function UpdateDialog({
    manifest,
    onUpdate,
    onDismiss,
    downloadProgress = 0,
    isDownloading = false,
    isVerifying = false,
    isInstalling = false,
    error
}: UpdateDialogProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-4 text-center">
                    <div className="mb-2 text-4xl">🚀</div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                        Update Available
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Version {manifest.version}
                    </p>
                </div>

                {/* Release Notes */}
                <div className="mb-6 max-h-40 overflow-y-auto rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
                    <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                        {manifest.releaseNotes}
                    </p>
                </div>

                {/* Progress Bar (when downloading) */}
                {isDownloading && (
                    <div className="mb-4">
                        <div className="mb-2 flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                            <span>Downloading...</span>
                            <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div
                                className="h-full bg-blue-600 transition-all duration-300"
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

                {/* Actions */}
                <div className="flex gap-3">
                    {!manifest.forceUpdate && (
                        <button
                            onClick={onDismiss}
                            disabled={isDownloading || isInstalling}
                            className="flex-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                            Later
                        </button>
                    )}
                    <button
                        onClick={onUpdate}
                        disabled={isDownloading || isInstalling}
                        className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isDownloading
                            ? 'Downloading...'
                            : isVerifying
                                ? 'Verifying...'
                                : isInstalling
                                    ? 'Installing...'
                                    : error
                                        ? 'Retry'
                                        : 'Update Now'}
                    </button>
                </div>

                {!manifest.forceUpdate && (
                    <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-600">
                        You can update later from Settings
                    </p>
                )}
            </div>
        </div>
    );
}
