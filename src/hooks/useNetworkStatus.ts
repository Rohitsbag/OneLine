import { useState, useEffect } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export function useNetworkStatus() {
    const [status, setStatus] = useState<{
        connected: boolean;
        connectionType: string;
    }>({
        connected: true,
        connectionType: 'unknown'
    });

    useEffect(() => {
        let mounted = true;

        const updateStatus = (s: ConnectionStatus) => {
            if (mounted) {
                setStatus({
                    connected: s.connected,
                    connectionType: s.connectionType
                });
            }
        };

        // Initial check
        if (Capacitor.isNativePlatform()) {
            Network.getStatus().then(updateStatus);
        } else {
            setStatus({
                connected: navigator.onLine,
                connectionType: 'unknown'
            });
        }

        // Listen for changes
        let handler: any;
        if (Capacitor.isNativePlatform()) {
            handler = Network.addListener('networkStatusChange', updateStatus);
        } else {
            const onlineHandler = () => setStatus(s => ({ ...s, connected: true }));
            const offlineHandler = () => setStatus(s => ({ ...s, connected: false }));
            window.addEventListener('online', onlineHandler);
            window.addEventListener('offline', offlineHandler);
            handler = {
                remove: () => {
                    window.removeEventListener('online', onlineHandler);
                    window.removeEventListener('offline', offlineHandler);
                }
            };
        }

        return () => {
            mounted = false;
            if (handler?.remove) handler.remove();
            else if (handler?.then) handler.then((h: any) => h.remove());
        };
    }, []);

    return status;
}
