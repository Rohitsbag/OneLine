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
 * Translates persistent private Supabase Storage URLs into temporary, authenticated signed URLs.
 * Bypasses private bucket HTTP download blocks.
 */
export async function resolveMediaUrl(url: string): Promise<string> {
    if (!url) return "";
    
    // Pass local object blobs or already signed links directly
    if (url.startsWith('blob:') || url.includes('token=')) {
        return url;
    }

    // Check if URL belongs to your private Supabase storage bucket
    if (url.includes('/storage/v1/object/public/journal-media-private/')) {
        try {
            const filePath = url.split('/storage/v1/object/public/journal-media-private/')[1];
            
            // Create a signed URL valid for 7 days
            const { data, error } = await supabase.storage
                .from('journal-media-private')
                .createSignedUrl(filePath, 86400 * 7);
                
            if (!error && data?.signedUrl) {
                return data.signedUrl;
            } else {
                console.warn('[media] Supabase createSignedUrl error:', error);
            }
        } catch (e) {
            console.error('[media] Dynamic signed URL resolver crashed:', e);
        }
    }

    return url;
}
