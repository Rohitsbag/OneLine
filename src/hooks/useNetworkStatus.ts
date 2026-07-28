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
        let isMounted = true;

        const checkHeartbeat = async () => {
            if (!navigator.onLine) {
                if (isMounted) setStatus(s => ({ ...s, connected: false }));
                return;
            }

            try {
                // Lightweight ping with 3s timeout to verify internet reachability
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const res = await fetch('/index.html', { 
                    method: 'HEAD', 
                    cache: 'no-store',
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                
                if (isMounted) {
                    setStatus(s => ({ ...s, connected: res.ok }));
                }
            } catch {
                if (isMounted) {
                    setStatus(s => ({ ...s, connected: false }));
                }
            }
        };

        const onlineHandler = () => {
            checkHeartbeat();
        };

        const offlineHandler = () => {
            if (isMounted) setStatus(s => ({ ...s, connected: false }));
        };

        window.addEventListener('online', onlineHandler);
        window.addEventListener('offline', offlineHandler);

        // Periodically verify reachability every 30 seconds
        const interval = setInterval(checkHeartbeat, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);
        };
    }, []);

    return status;
}
