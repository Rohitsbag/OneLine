import { supabase } from "@/utils/supabase/client";

/**
 * Generates a signed URL with a very long expiration (100 years).
 * Useful for caching media URLs in the frontend while keeping the bucket private.
 */
export const getEternalSignedUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    // Return early if it's already a full URL or local path
    if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('local://')) return path;

    try {
        // 100 years expiration
        const year = 365 * 24 * 60 * 60;
        const { data, error } = await supabase.storage
            .from('journal-media-private')
            .createSignedUrl(path, 100 * year);

        if (error) {
            console.error("Error signing URL:", error);
            return null;
        }

        return data?.signedUrl || null;
    } catch (e) {
        console.error("Exception signing URL:", e);
        return null;
    }
};

/**
 * Validates an image file before upload/compression.
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    // 50MB limit (hard cap before compression attempt)
    const MAX_SIZE = 50 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
        return { valid: false, error: "File is too large (max 50MB)" };
    }

    if (!file.type.startsWith('image/')) {
        return { valid: false, error: "File is not a valid image" };
    }

    return { valid: true };
};
