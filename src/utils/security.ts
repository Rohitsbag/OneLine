/**
 * Production-Grade Security Utilities for OneLine
 * Focuses on non-reversible hashing for PIN protection.
 */

/**
 * Hashes a PIN using SHA-256 with userId and device salt to prevent rainbow table attacks.
 */
export async function hashPin(userId: string, pin: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    // salt + userId + pin creates a strong, unique msg for hashing
    const data = encoder.encode(`${salt}:${userId}:${pin}`);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a random salt for the device.
 */
export function generateDeviceSalt(): string {
    return crypto.randomUUID();
}

/**
 * Verifies a PIN against a stored hash.
 */
export async function verifyPin(userId: string, pin: string, salt: string, storedHash: string): Promise<boolean> {
    const inputHash = await hashPin(userId, pin, salt);
    return inputHash === storedHash;
}
