import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Base64 to Blob conversion helper
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

/**
 * Capture or pick a photo using native UI
 */
export async function getPhoto(source: 'CAMERA' | 'GALLERY'): Promise<{ blob: Blob; url: string } | null> {
    if (!isNative()) return null;

    try {
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: source === 'CAMERA' ? CameraSource.Camera : CameraSource.Photos
        });

        if (image.base64String) {
            const blob = base64ToBlob(image.base64String, `image/${image.format}`);
            const url = URL.createObjectURL(blob);
            return { blob, url };
        }
        return null;
    } catch (e) {
        console.error('Native photo capture failed:', e);
        return null;
    }
}

/**
 * Capture or pick a video using native UI
 */
export async function getVideo(source: 'CAMERA' | 'GALLERY' = 'GALLERY'): Promise<{ blob: Blob; url: string; format: string } | null> {
    if (!isNative()) return null;

    try {
        const result = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: source === 'CAMERA' ? CameraSource.Camera : CameraSource.Photos,
            direction: 'REAR',
            presentationStyle: 'fullscreen',
            mediaType: 'VIDEO' // Critical for video mode
        });

        if (result.base64String) {
            const format = result.format || 'mp4';
            const blob = base64ToBlob(result.base64String, `video/${format}`);
            const url = URL.createObjectURL(blob);
            return { blob, url, format };
        }
        return null;
    } catch (e) {
        if ((e as any).message !== 'User cancelled photos app') {
            console.error('Native video capture failed:', e);
        }
        return null;
    }
}

/**
 * Handle native voice recording
 */
export const nativeVoice = {
    async requestPermission() {
        if (!isNative()) return true;
        const result = await VoiceRecorder.requestAudioRecordingPermission();
        return result.value;
    },

    async start() {
        if (!isNative()) return;
        const { value } = await VoiceRecorder.canDeviceVoiceRecord();
        if (value) {
            await VoiceRecorder.startRecording();
        }
    },

    async stop(): Promise<{ blob: Blob; mimeType: string; duration: number } | null> {
        if (!isNative()) return null;
        const result = await VoiceRecorder.stopRecording();
        if (result.value && result.value.recordDataBase64) {
            const blob = base64ToBlob(result.value.recordDataBase64, result.value.mimeType);
            return {
                blob,
                mimeType: result.value.mimeType,
                duration: Math.round(result.value.msDuration / 1000)
            };
        }
        return null;
    }
}
// NOTE: Native OCR (@capacitor-community/text-recognition) can be added here
// after running: npm install @capacitor-community/text-recognition --legacy-peer-deps
// For now, OCR uses Tesseract.js fallback in ai.ts
