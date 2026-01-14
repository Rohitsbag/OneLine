import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.oneline.app',
    appName: 'OneLine',
    webDir: 'dist',
    // OFFLINE-FIRST: No server URL = bundle locally in APK
    // App works without internet, syncs when connected
    android: {
        allowMixedContent: false,
        webContentsDebuggingEnabled: true
    }
};

export default config;
