/**
 * Media Types for Multi-Media Support
 */

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaItem {
    type: MediaType;
    url: string;
    local_path?: string;
    duration_seconds?: number;
    thumbnail_url?: string;
    migrated?: boolean; // Flag for items migrated from old schema
}

export interface MediaLimits {
    MAX_TOTAL: 10;
    MAX_PHOTOS_VIDEOS: 5;
    MAX_AUDIO: 5;
    MAX_DURATION_SECONDS: 180; // 3 minutes
}

export const MEDIA_LIMITS: MediaLimits = {
    MAX_TOTAL: 10,
    MAX_PHOTOS_VIDEOS: 5,
    MAX_AUDIO: 5,
    MAX_DURATION_SECONDS: 180,
};

/**
 * Validates if adding a new media item would exceed limits
 */
export function canAddMedia(
    currentItems: MediaItem[],
    newType: MediaType
): { canAdd: boolean; reason?: string } {
    const totalCount = currentItems.length;

    if (totalCount >= MEDIA_LIMITS.MAX_TOTAL) {
        return { canAdd: false, reason: 'Maximum 10 media items per entry' };
    }

    const photosVideosCount = currentItems.filter(
        item => item.type === 'image' || item.type === 'video'
    ).length;

    const audioCount = currentItems.filter(
        item => item.type === 'audio'
    ).length;

    if ((newType === 'image' || newType === 'video') && photosVideosCount >= MEDIA_LIMITS.MAX_PHOTOS_VIDEOS) {
        return { canAdd: false, reason: 'Maximum 5 photos/videos per entry' };
    }

    if (newType === 'audio' && audioCount >= MEDIA_LIMITS.MAX_AUDIO) {
        return { canAdd: false, reason: 'Maximum 5 audio notes per entry' };
    }

    return { canAdd: true };
}

/**
 * Counts media items by type
 */
export function countMediaByType(items: MediaItem[], type: MediaType): number {
    return items.filter(item => item.type === type).length;
}
