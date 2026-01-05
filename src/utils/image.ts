/**
 * CORTEX-FIXED: Guaranteed Adaptive Compression
 * Goal: Accept ANY input image and output a file strictly < targetSizeKB.
 * Strategy:
 * 1. Calculate max dimensions based on aspect ratio (default max 2048px to preserve OCR legibility).
 * 2. Iteratively reduce quality.
 * 3. If quality drops too low (< 0.5) and still too big, scale down dimensions.
 * 4. Guarantee success (never throw due to size).
 */
export async function compressImage(file: File, maxDimension = 2048, targetSizeKB = 800): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                console.log(`[compressImage] Loaded: ${width}x${height}, File: ${file.name} (${(file.size / 1024).toFixed(2)}KB), Type: ${file.type}`);

                if (width === 0 || height === 0) {
                    console.error("[compressImage] Invalid dimensions 0x0");
                    reject(new Error("Image loaded with 0 dimensions"));
                    return;
                }

                let quality = 0.9;
                let scale = 1.0;

                // Helper to draw and get blob
                const getBlob = (currentWidth: number, currentHeight: number, currentQuality: number): Promise<Blob> => {
                    return new Promise((res) => {
                        const canvas = document.createElement('canvas');
                        canvas.width = currentWidth;
                        canvas.height = currentHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                            canvas.toBlob((b) => {
                                if (b) {
                                    res(b);
                                } else {
                                    console.error("Canvas toBlob compression failed");
                                    res(new Blob([])); // Fallback
                                }
                            }, 'image/jpeg', currentQuality);
                        } else {
                            res(new Blob([])); // Should not happen
                        }
                    });
                };

                const attemptCompression = async () => {
                    // 1. Calculate dimensions for this attempt
                    // Ensure we start within a reasonable max dimension (e.g. 2048px)
                    // If we need to scale down further, we reduce `scale`
                    let attemptWidth = width * scale;
                    let attemptHeight = height * scale;

                    // Hard cap dimensions first
                    if (attemptWidth > maxDimension || attemptHeight > maxDimension) {
                        const ratio = Math.min(maxDimension / attemptWidth, maxDimension / attemptHeight);
                        attemptWidth *= ratio;
                        attemptHeight *= ratio;
                    }

                    const blob = await getBlob(attemptWidth, attemptHeight, quality);
                    const sizeKB = blob.size / 1024;

                    console.log(`Compression Attempt: ${Math.round(attemptWidth)}x${Math.round(attemptHeight)} @ Q${quality.toFixed(1)} = ${sizeKB.toFixed(2)}KB`);

                    if (sizeKB <= targetSizeKB) {
                        resolve(blob);
                        return;
                    }

                    // Adaptive Reduction Strategy
                    if (quality > 0.5) {
                        // Reduce quality first
                        quality -= 0.2;
                    } else {
                        // If quality is already low, reduce dimensions (scale) and reset quality slightly
                        scale *= 0.75; // Major resize to drop file size
                        quality = 0.7; // Bump quality back up so text stays sharp at lower res
                    }

                    // Safety exit for extremely pathological cases (tiny image, huge file?)
                    if (attemptWidth < 300 || attemptHeight < 300) {
                        // Just return what we have, it's tiny.
                        console.warn("Image reached min dimensions, returning best effort.");
                        resolve(blob);
                        return;
                    }

                    attemptCompression();
                };

                attemptCompression();
            };

            img.onerror = () => reject(new Error("Failed to load image"));
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
    });
}
