import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

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
            const rawData = atob(image.base64String);
            const bytes = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) {
                bytes[i] = rawData.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: `image/${image.format}` });
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
 * Pick a video using native UI
 */
export async function getVideo(): Promise<{ blob: Blob; url: string; format: string } | null> {
    if (!isNative()) return null;

    try {
        const video = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Photos,
            // @ts-ignore - plugin support for video varies
            promptLabelHeader: 'Pick a Video',
            // @ts-ignore
            types: ['video']
        });

        if (video.base64String) {
            const rawData = atob(video.base64String);
            const bytes = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) {
                bytes[i] = rawData.charCodeAt(i);
            }
            const format = video.format || 'mp4';
            const blob = new Blob([bytes], { type: `video/${format}` });
            const url = URL.createObjectURL(blob);
            return { blob, url, format };
        }
        return null;
    } catch (e) {
        console.error('Native video capture failed:', e);
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

    async stop(): Promise<{ blob: Blob; mimeType: string } | null> {
        if (!isNative()) return null;
        const result = await VoiceRecorder.stopRecording();
        if (result.value && result.value.recordDataBase64) {
            const rawData = atob(result.value.recordDataBase64);
            const bytes = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) {
                bytes[i] = rawData.charCodeAt(i);
            }
            const mimeType = result.value.mimeType;
            const blob = new Blob([bytes], { type: mimeType });
            return { blob, mimeType };
        }
        return null;
    }
}
// NOTE: Native OCR (@capacitor-community/text-recognition) can be added here
// after running: npm install @capacitor-community/text-recognition --legacy-peer-deps
// For now, OCR uses Tesseract.js fallback in ai.ts
