/**
 * Offline OCR using Tesseract.js
 * Used as fallback when internet is unavailable
 */
import Tesseract from 'tesseract.js';

interface TesseractLogMessage {
    status: string;
    progress: number;
}

export async function extractTextOffline(imageFile: File): Promise<string> {
    try {
        const imageUrl = URL.createObjectURL(imageFile);

        const result = await Tesseract.recognize(
            imageUrl,
            'eng',
            {
                logger: (m: TesseractLogMessage) => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );

        URL.revokeObjectURL(imageUrl);

        return result.data.text.trim();
    } catch (error) {
        console.error('Offline OCR failed:', error);
        throw new Error('Failed to extract text offline');
    }
}
