import { useState, useEffect } from 'react';

export function useNetworkStatus() {
    const [status, setStatus] = useState<{
        connected: boolean;
        connectionType: string;
    }>({
        connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
        connectionType: 'unknown'
    });

    useEffect(() => {
        const onlineHandler = () => setStatus(s => ({ ...s, connected: true }));
        const offlineHandler = () => setStatus(s => ({ ...s, connected: false }));

        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        return () => {
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
        };
    }, []);

    return status;
}
