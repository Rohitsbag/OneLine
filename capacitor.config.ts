import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.oneline.app',
    appName: 'OneLine',
    webDir: 'dist',
    server: {
        // Load the live Vercel deployment
        url: 'https://get-one-line.vercel.app',
        cleartext: false
    },
    android: {
        allowMixedContent: false,
        webContentsDebuggingEnabled: false
    }
};

export default config;
