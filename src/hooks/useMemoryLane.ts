import { useState, useEffect, useRef, useCallback } from 'react';

export type MemoryLaneTimingMode = 'fixed' | 'smart';

export interface MemoryLaneSettings {
    timingMode: MemoryLaneTimingMode;
    fixedInterval: number; // in seconds
    smartSpeed: number; // chars per second (default 12-15)
}

const DEFAULT_SETTINGS: MemoryLaneSettings = {
    timingMode: 'smart',
    fixedInterval: 5,
    smartSpeed: 13.5 // Average of 12-15
};

const MIN_SLIDE_TIME = 3000; // 3 seconds
const MAX_SLIDE_TIME = 30000; // 30 seconds
const SKIP_TIME = 1000; // 1 second for empty entries
const INTERACTION_PAUSE_MS = 5000;

export function useMemoryLane(
    onNext: () => void,
    contentLength: number,
    isPlaying: boolean,
    onPlayChange: (playing: boolean) => void
) {
    const [settings, setSettings] = useState<MemoryLaneSettings>(() => {
        const saved = localStorage.getItem('memory_lane_settings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });

    const [isInteracting, setIsInteracting] = useState(false);
    const interactionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const slideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Persist settings
    useEffect(() => {
        localStorage.setItem('memory_lane_settings', JSON.stringify(settings));
    }, [settings]);

    // Handle user interaction
    const handleInteraction = useCallback(() => {
        if (!isPlaying) return;

        setIsInteracting(true);

        if (interactionTimerRef.current) {
            clearTimeout(interactionTimerRef.current);
        }

        interactionTimerRef.current = setTimeout(() => {
            setIsInteracting(false);
        }, INTERACTION_PAUSE_MS);
    }, [isPlaying]);

    // Add interaction listeners
    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'touchstart', 'scroll', 'keydown'];
        const handler = () => handleInteraction();

        // Improve performance by throttling if needed
        let throttled = false;
        const throttledHandler = () => {
            if (throttled) return;
            throttled = true;
            handler();
            setTimeout(() => throttled = false, 200);
        };

        events.forEach(event => window.addEventListener(event, throttledHandler, { passive: true }));

        return () => {
            events.forEach(event => window.removeEventListener(event, throttledHandler));
            if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
        };
    }, [handleInteraction]);

    // Calculate duration
    const getDuration = useCallback(() => {
        // Skip empty/very short content quickly
        if (contentLength < 5) return SKIP_TIME;

        if (settings.timingMode === 'fixed') {
            return settings.fixedInterval * 1000;
        }

        // Smart read-time
        const time = (contentLength / settings.smartSpeed) * 1000;
        return Math.min(Math.max(time, MIN_SLIDE_TIME), MAX_SLIDE_TIME);
    }, [settings, contentLength]);

    // Memory Lane loop
    useEffect(() => {
        if (!isPlaying || isInteracting) {
            if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
            return;
        }

        const duration = getDuration();

        slideTimerRef.current = setTimeout(() => {
            onNext();
        }, duration);

        return () => {
            if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
        };
    }, [isPlaying, isInteracting, onNext, getDuration]);

    return {
        isInteracting,
        settings,
        updateSettings: (newSettings: Partial<MemoryLaneSettings>) =>
            setSettings(prev => ({ ...prev, ...newSettings }))
    };
}
