/**
 * Tiered STT Logic
 * Handles network quality detection and model selection
 */

export type NetworkTier = "high-quality" | "data-saver" | "offline";

export function detectNetworkTier(): NetworkTier {
    if (!navigator.onLine) {
        return "offline";
    }

    // @ts-ignore - connection API is not fully typed in all environments
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection) {
        // Effective Type: '4g', '3g', '2g', 'slow-2g'
        if (connection.effectiveType === '4g' && (!connection.saveData)) {
            return "high-quality";
        }
        // Downlink: Speed in Mbps
        if (connection.downlink && connection.downlink > 1.5) {
            return "high-quality";
        }
    }

    // Default to data-saver/turbo if unsure or 3g/2g
    return "data-saver";
}

export function getSTTModel(tier: NetworkTier): string {
    switch (tier) {
        case "high-quality":
            return "whisper-large-v3";
        case "data-saver":
            return "whisper-large-v3-turbo";
        default:
            return "offline"; // Should use Web Speech API
    }
}
