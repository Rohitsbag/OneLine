/**
 * OCR Service - Extract text from images using Tesseract.js
 * Runs entirely in the browser, no API calls needed
 */
import Tesseract from 'tesseract.js';

interface OCRResult {
    text: string;
    confidence: number;
    success: boolean;
}

/**
 * Extract text from an image using Tesseract.js OCR
 * @param imageFile - The image file to process
 * @param onProgress - Optional callback for progress updates
 */
export async function extractTextFromImage(
    imageFile: File,
    onProgress?: (progress: number) => void
): Promise<OCRResult> {
    try {
        const result = await Tesseract.recognize(
            imageFile,
            'eng', // English language - can be extended to support more languages
            {
                logger: (m) => {
                    if (m.status === 'recognizing text' && onProgress) {
                        onProgress(m.progress * 100);
                    }
                }
            }
        );

        const text = result.data.text.trim();
        const confidence = result.data.confidence;

        if (!text || text.length === 0) {
            return {
                text: '',
                confidence: 0,
                success: false
            };
        }

        return {
            text,
            confidence,
            success: true
        };
    } catch (error) {
        console.error('OCR failed:', error);
        return {
            text: '',
            confidence: 0,
            success: false
        };
    }
}

/**
 * OCR is always available since it runs in the browser
 */
export function isOCRAvailable(): boolean {
    return true;
}
