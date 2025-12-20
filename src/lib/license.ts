import { LICENSE_PUBLIC_KEY } from '@/constants/license_public_key';

export interface LicenseStatus {
    valid: boolean;
    expiry: string | null;
    customer: string | null;
    maxUsers?: number;
    error?: string;
}

// Helper to convert PEM to binary
function pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64Lines = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const str = atob(b64Lines);
    const len = str.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
}

// Helper to convert Base64URL to binary
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export const verifyLicenseToken = async (token: string): Promise<LicenseStatus> => {
    try {
        if (!token) throw new Error('Empty token');
        const parts = token.trim().split('.');
        if (parts.length !== 2) {
            throw new Error('Invalid token format');
        }

        const [payloadB64, signatureB64] = parts;
        const keyBuffer = pemToArrayBuffer(LICENSE_PUBLIC_KEY);
        let isValid = false;
        let payloadString = '';

        // 1. Detect best available Crypto API
        let webCrypto: any = null;

        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            webCrypto = crypto;
        }
        else if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            webCrypto = window.crypto;
        }
        else if (typeof window === 'undefined') {
            try {
                const nc = await import('crypto');
                const nodeCrypto = (nc as any).default || nc;
                if (nodeCrypto.webcrypto && (nodeCrypto.webcrypto as any).subtle) {
                    webCrypto = nodeCrypto.webcrypto;
                }
            } catch (e) { }
        }

        if (webCrypto && webCrypto.subtle) {
            const cryptoKey = await webCrypto.subtle.importKey(
                "spki",
                keyBuffer,
                { name: "Ed25519" },
                true,
                ["verify"]
            );

            payloadString = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
            const dataToVerify = new TextEncoder().encode(payloadString);
            const signatureBuffer = base64ToArrayBuffer(signatureB64);

            isValid = await webCrypto.subtle.verify(
                { name: "Ed25519" },
                cryptoKey,
                signatureBuffer,
                dataToVerify
            );
        } else if (typeof window === 'undefined') {
            // Server fallback
            try {
                const nc = await import('crypto');
                const nodeCrypto = (nc as any).default || nc;

                if (typeof nodeCrypto.createPublicKey !== 'function') {
                    throw new Error('No compatible Crypto API found on server');
                }

                const pKey = nodeCrypto.createPublicKey({
                    key: Buffer.from(LICENSE_PUBLIC_KEY),
                    format: 'pem',
                    type: 'spki'
                });

                payloadString = Buffer.from(payloadB64, 'base64url').toString('utf8');
                const signatureBuffer = Buffer.from(signatureB64, 'base64url');

                isValid = nodeCrypto.verify(
                    null,
                    Buffer.from(payloadString),
                    pKey,
                    signatureBuffer
                );
            } catch (err: any) {
                throw new Error(`Server Crypto Error: ${err.message}`);
            }
        } else {
            // Browser without secure context (HTTP on IP)
            // We just return invalid here, the UI should use a Server Action instead
            return { valid: false, expiry: null, customer: null, error: 'Web Crypto requires HTTPS or Localhost' };
        }

        if (!isValid) {
            return { valid: false, expiry: null, customer: null, error: 'Invalid Signature' };
        }

        const payload = JSON.parse(payloadString);
        const today = new Date().toISOString().split('T')[0];
        if (payload.expiry < today) {
            return { valid: false, expiry: payload.expiry, customer: payload.customer, maxUsers: payload.maxUsers, error: 'License Expired' };
        }

        return { valid: true, expiry: payload.expiry, customer: payload.customer, maxUsers: payload.maxUsers };

    } catch (e: any) {
        return { valid: false, expiry: null, customer: null, error: e.message || 'Verification Error' };
    }
};
