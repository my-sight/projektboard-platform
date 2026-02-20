/**
 * Generates a UUID v4.
 * Uses crypto.randomUUID if available (secure contexts),
 * otherwise falls back to Math.random (sufficient for non-critical IDs).
 */
export function generateUUID(): string {
    // Use native crypto API if available
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    // Fallback for non-secure contexts (http) or older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
