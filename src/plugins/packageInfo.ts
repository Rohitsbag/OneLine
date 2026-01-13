import { registerPlugin } from '@capacitor/core';

export interface PackageInfoPlugin {
    getVersion(): Promise<{ version: string; versionCode: number }>;
}

const PackageInfo = registerPlugin<PackageInfoPlugin>('PackageInfo');

export default PackageInfo;
