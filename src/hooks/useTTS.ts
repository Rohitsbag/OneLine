import { useState, useEffect, useCallback, useRef } from 'react';

export interface TTSSettings {
    enabled: boolean;
    rate: number; // 0.8 - 1.2
    voiceURI: string | null;
}

const DEFAULT_SETTINGS: TTSSettings = {
    enabled: false,
    rate: 1.0,
    voiceURI: null
};

export function useTTS(
    text: string,
    isPlaying: boolean, // Slideshow state
    isPaused: boolean // User interaction pause state
) {
    const [settings, setSettings] = useState<TTSSettings>(() => {
        const saved = localStorage.getItem('tts_settings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });

    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const synthesisRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Initialize voices
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            synthesisRef.current = window.speechSynthesis;

            const loadVoices = () => {
                const available = window.speechSynthesis.getVoices();
                setVoices(available);
            };

            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }, []);

    // Persist settings
    useEffect(() => {
        localStorage.setItem('tts_settings', JSON.stringify(settings));
    }, [settings]);

    const stop = useCallback(() => {
        if (synthesisRef.current) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    const speak = useCallback((textToSpeak: string) => {
        if (!synthesisRef.current || !settings.enabled || !textToSpeak.trim()) return;

        // Cancel any current speech
        synthesisRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utteranceRef.current = utterance;

        utterance.rate = settings.rate;
        if (settings.voiceURI) {
            const voice = voices.find(v => v.voiceURI === settings.voiceURI);
            if (voice) utterance.voice = voice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        synthesisRef.current.speak(utterance);
    }, [settings, voices]);

    // React to text changes or play state
    useEffect(() => {
        if (isPlaying && !isPaused && settings.enabled) {
            // New slide or resumed
            speak(text);
        } else {
            // Paused or stopped
            if (synthesisRef.current?.speaking) {
                synthesisRef.current.cancel();
                setIsSpeaking(false);
            }
        }

        return () => {
            if (synthesisRef.current?.speaking) {
                synthesisRef.current.cancel();
            }
        };
    }, [text, isPlaying, isPaused, settings.enabled, speak]);

    return {
        voices,
        isSpeaking,
        settings,
        updateSettings: (newSettings: Partial<TTSSettings>) =>
            setSettings(prev => ({ ...prev, ...newSettings }))
    };
}
