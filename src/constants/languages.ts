export const STT_LANGUAGES = [
    { name: "Auto", code: "auto" },
    { name: "English", code: "en" },
    { name: "Hindi", code: "hi" },
    { name: "Hinglish", code: "hinglish" },
    { name: "Spanish", code: "es" },
    { name: "French", code: "fr" },
    { name: "German", code: "de" },
    { name: "Chinese", code: "zh" },
    { name: "Japanese", code: "ja" },
    { name: "Korean", code: "ko" },
    { name: "Portuguese", code: "pt" },
    { name: "Russian", code: "ru" },
    { name: "Italian", code: "it" },
    { name: "Arabic", code: "ar" },
    { name: "Dutch", code: "nl" },
    { name: "Turkish", code: "tr" },
    { name: "Bengali", code: "bn" },
    { name: "Indonesian", code: "id" },
    { name: "Vietnamese", code: "vi" },
    { name: "Thai", code: "th" },
] as const;

export type STTLanguageCode = typeof STT_LANGUAGES[number]["code"];
