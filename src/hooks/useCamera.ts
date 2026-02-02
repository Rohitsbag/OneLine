import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import * as nativeMedia from '@/utils/native-media';

interface CaptureResult {
    blob: Blob;
    format: string;
    base64?: string;
}

export function useCamera() {
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const capturePhoto = useCallback(async (): Promise<CaptureResult | null> => {
        setIsCapturing(true);
        setError(null);

        try {
            if (Capacitor.isNativePlatform()) {
                const result = await nativeMedia.getPhoto('CAMERA');
                if (result) {
                    return {
                        blob: result.blob,
                        format: 'jpeg', // Simplified, actual format in native-media
                        base64: '' // We don't always need base64 here if we have blob
                    };
                }
            }
            return null;
        } catch (e: any) {
            if (e.message !== 'User cancelled photos app') {
                setError(e.message || 'Camera capture failed');
                console.error('Camera error:', e);
            }
            return null;
        } finally {
            setIsCapturing(false);
        }
    }, []);

    const selectFromGallery = useCallback(async (): Promise<CaptureResult | null> => {
        setIsCapturing(true);
        setError(null);

        try {
            if (Capacitor.isNativePlatform()) {
                const result = await nativeMedia.getPhoto('GALLERY');
                if (result) {
                    return {
                        blob: result.blob,
                        format: 'jpeg',
                        base64: ''
                    };
                }
            }
            return null;
        } catch (e: any) {
            if (e.message !== 'User cancelled photos app') {
                setError(e.message || 'Gallery selection failed');
                console.error('Gallery error:', e);
            }
            return null;
        } finally {
            setIsCapturing(false);
        }
    }, []);

    const captureVideo = useCallback(async (): Promise<CaptureResult | null> => {
        setIsCapturing(true);
        setError(null);
        try {
            if (Capacitor.isNativePlatform()) {
                // Use the new VIDEO capture logic
                const result = await nativeMedia.getVideo('CAMERA');
                if (result) {
                    return {
                        blob: result.blob,
                        format: result.format
                    };
                }
            }
            return null;
        } catch (e: any) {
            if (e.message !== 'User cancelled photos app') {
                setError(e.message || 'Video capture failed');
            }
            return null;
        } finally {
            setIsCapturing(false);
        }
    }, []);

    return {
        capturePhoto,
        selectFromGallery,
        captureVideo,
        isCapturing,
        error
    };
}
