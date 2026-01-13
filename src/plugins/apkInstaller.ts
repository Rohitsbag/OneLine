import { registerPlugin } from '@capacitor/core';

export interface APKInstallerPlugin {
    install(options: { filePath: string }): Promise<void>;
    canInstall(): Promise<{ canInstall: boolean }>;
    verifyInstall(options: { expectedVersionCode: number }): Promise<{ success: boolean }>;
    deleteFile(options: { filePath: string }): Promise<void>;
    openSettings(): Promise<void>;
}

const APKInstaller = registerPlugin<APKInstallerPlugin>('APKInstaller');

export default APKInstaller;
