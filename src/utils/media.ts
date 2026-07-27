import imageCompression from 'browser-image-compression';
import { supabase } from './supabase/client';

/**
 * Compresses an image file client-side to be optimized for web.
 * Target: Max 1.5 MB size for sharp, high-resolution photos now that bucket limit is 5MB.
 */
export async function compressImageFile(file: File): Promise<File> {
    const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
    };
    try {
        console.log(`[media] Compressing image: original size ${(file.size / 1024).toFixed(1)} KB`);
        const compressed = await imageCompression(file, options);
        console.log(`[media] Compressed image size: ${(compressed.size / 1024).toFixed(1)} KB`);
        
        // Return compressed File retaining original name
        return new File([compressed], file.name, { type: compressed.type });
    } catch (e) {
        console.warn('[media] Image compression failed, falling back to original:', e);
        return file;
    }
}

/**
 * Uploads a file (photo or audio blob) to the Supabase 'journal-media-private' storage bucket.
 * Organizes files by path: {userId}/{dateStr}/{type}_{timestamp}.{ext}
 */
export async function uploadToSupabase(
    file: File | Blob,
    userId: string,
    dateStr: string,
    type: 'image' | 'audio'
): Promise<string> {
    if (!userId || userId === 'guest') {
        throw new Error('Authentication is required to upload files to Supabase Storage.');
    }

    const contentType = file.type || (type === 'image' ? 'image/jpeg' : 'audio/webm');
    
    // Extract extension safely from mime type
    let ext = type === 'image' ? 'jpg' : 'webm';
    if (contentType.includes('/')) {
        ext = contentType.split('/')[1].split(';')[0]; // handles 'audio/webm;codecs=opus'
        if (ext === 'jpeg') ext = 'jpg';
    }
    
    // File path syntax: user_id/date/type_timestamp.ext
    const filePath = `${userId}/${dateStr}/${type}_${Date.now()}.${ext}`;

    console.log(`[media] Uploading ${type} to Supabase path: ${filePath} (Size: ${(file.size / 1024).toFixed(1)} KB)...`);
    
    const { data, error } = await supabase.storage
        .from('journal-media-private')
        .upload(filePath, file, {
            upsert: true,
            contentType: contentType,
        });

    if (error) {
        console.error(`[media] Supabase storage upload failed for ${type}:`, error);
        
        let limitHint = "";
        if (file.size > 512 * 1024 || error.message?.toLowerCase().includes("limit") || error.message?.toLowerCase().includes("too large")) {
            limitHint = "\n\n(Hint: Your Supabase bucket 'journal-media-private' has a 512 KB file size limit. Please increase the 'File size limit' in your Supabase Dashboard -> Storage Settings -> 'journal-media-private' bucket config to at least 5 MB or 10 MB to allow full media uploads.)";
        }
        
        throw new Error(`Upload failed: ${error.message || 'Make sure the storage configurations are correct.'}${limitHint}`);
    }

    const { data: urlData } = supabase.storage
        .from('journal-media-private')
        .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
        throw new Error('Failed to retrieve the public URL of the uploaded media file.');
    }

    console.log(`[media] Uploaded successfully. Public URL: ${urlData.publicUrl}`);
    return urlData.publicUrl;
}

/**
 * Translates persistent private/public Supabase Storage URLs or path identifiers
 * into temporary, authenticated 7-day signed URLs.
 * Handles both new date-structured paths and legacy unorganized paths,
 * as well as legacy bucket names (e.g., 'journal-media' vs 'journal-media-private').
 */
export async function resolveMediaUrl(url: string): Promise<string> {
    if (!url || typeof url !== 'string') return "";
    
    // Pass local object blobs directly
    if (url.startsWith('blob:')) {
        return url;
    }

    try {
        let bucketName = "journal-media-private";
        let filePath = "";

        // Case 1: Full HTTP(S) URL containing Supabase storage path:
        // matches .../storage/v1/object/(public|authenticated|sign)/<bucket-name>/<file-path>
        const storageMatch = url.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^\/]+)\/(.+)$/i);
        
        if (storageMatch) {
            bucketName = storageMatch[1];
            // Decode URI components and strip query params (like ?t=... or token=...)
            filePath = decodeURIComponent(storageMatch[2].split('?')[0]);
        } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            // Case 2: Relative storage path stored directly in database
            // e.g. "journal-media-private/uid/2026-01-17/img.jpg" or "uid/1767542825574-1000115.jpg"
            const parts = url.split('/');
            if (parts[0] === 'journal-media-private' || parts[0] === 'journal-media') {
                bucketName = parts[0];
                filePath = parts.slice(1).join('/');
            } else {
                filePath = url.split('?')[0];
            }
        } else {
            // Case 3: External HTTP URL (not Supabase storage) — return as-is
            return url;
        }

        if (!filePath) return url;

        // Try candidate buckets starting with detected bucketName, then fallbacks
        const candidateBuckets = Array.from(new Set([
            bucketName,
            "journal-media-private",
            "journal-media"
        ]));

        for (const bName of candidateBuckets) {
            try {
                const { data, error } = await supabase.storage
                    .from(bName)
                    .createSignedUrl(filePath, 604800); // 7 days (604,800 seconds)

                if (!error && data?.signedUrl) {
                    return data.signedUrl;
                }
            } catch {
                // Try next candidate bucket
            }
        }
    } catch (e) {
        console.warn('[media] Dynamic signed URL resolver error:', e);
    }

    return url;
}

