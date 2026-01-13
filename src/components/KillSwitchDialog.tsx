import { Capacitor } from '@capacitor/core';

interface KillSwitchDialogProps {
    message?: string;
}

export function KillSwitchDialog({ message }: KillSwitchDialogProps) {
    const defaultMessage = "OneLine is temporarily unavailable for maintenance. Please check back soon or reinstall from our website.";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="mx-4 w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl text-center">
                {/* Icon */}
                <div className="mb-4 text-6xl">🛑</div>

                {/* Title */}
                <h2 className="mb-3 text-xl font-bold text-zinc-900 dark:text-white">
                    Service Unavailable
                </h2>

                {/* Message */}
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {message || defaultMessage}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <a
                        href="https://github.com/Rohitsbag/OneLine"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full rounded-2xl bg-zinc-800 dark:bg-zinc-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-600"
                    >
                        Visit Website
                    </a>
                    <button
                        onClick={() => {
                            if (Capacitor.isNativePlatform()) {
                                (Capacitor as any).Plugins?.App?.exitApp();
                            } else {
                                window.close();
                            }
                        }}
                        className="w-full rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        Close App
                    </button>
                </div>

                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-600">
                    We apologize for the inconvenience
                </p>
            </div>
        </div>
    );
}
