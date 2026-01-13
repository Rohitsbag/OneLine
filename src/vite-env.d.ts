/// <reference types="vite/client" />

declare module '@capacitor/app' {
    export const App: {
        exitApp: () => Promise<void>;
        addListener: (eventName: 'appStateChange', listenerFunc: (state: { isActive: boolean }) => void) => Promise<{ remove: () => Promise<void> }>;
    };
}
