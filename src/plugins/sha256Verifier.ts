import { registerPlugin } from '@capacitor/core';

export interface SHA256VerifierPlugin {
    verify(options: { filePath: string; expectedHash: string }): Promise<{ isValid: boolean }>;
}

const SHA256Verifier = registerPlugin<SHA256VerifierPlugin>('SHA256Verifier');

export default SHA256Verifier;
