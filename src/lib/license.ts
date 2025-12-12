import { LICENSE_PUBLIC_KEY } from '@/constants/license_public_key';
import { supabase } from '@/lib/supabaseClient';

export interface LicenseStatus {
    valid: boolean;
    expiry: string | null;
    customer: string | null;
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
        const parts = token.trim().split('.');
        console.log('Verifying Token Parts:', parts.length);
        if (parts.length !== 2) {
            console.error('Token split failed. Token:', token);
            throw new Error('Invalid token format');
        }

        const [payloadB64, signatureB64] = parts;
        console.log('Payload B64:', payloadB64);
        console.log('Signature B64:', signatureB64);

        // 1. Import Public Key
        const keyBuffer = pemToArrayBuffer(LICENSE_PUBLIC_KEY);
        let isValid = false;
        let payloadString = '';

        // Check for Web Crypto API (Browser or Edge Runtime)
        const webCrypto = typeof crypto !== 'undefined' ? crypto :
            (typeof window !== 'undefined' && window.crypto) ? window.crypto : null;

        if (webCrypto && webCrypto.subtle) {
            console.log('Using Web Crypto API (Browser/Edge)');
            const cryptoKey = await webCrypto.subtle.importKey(
                "spki",
                keyBuffer,
                { name: "Ed25519" },
                true,
                ["verify"]
            );

            // 2. Verify Signature
            payloadString = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
            const dataToVerify = new TextEncoder().encode(payloadString);
            const signatureBuffer = base64ToArrayBuffer(signatureB64);

            isValid = await webCrypto.subtle.verify(
                { name: "Ed25519" },
                cryptoKey,
                signatureBuffer,
                dataToVerify
            );
        } else {
            // Node.js fallback (Server Side non-Edge)
            try {
                const nodeCrypto = await import('crypto');
                console.log('Using Node.js Crypto (Server)');

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
                console.error('Node crypto error', err);
                throw new Error(`Crypto API not available: ${err.message}`);
            }
        }

        if (!isValid) {
            return { valid: false, expiry: null, customer: null, error: 'Invalid Signature' };
        }

        // 3. Parse Payload
        const payload = JSON.parse(payloadString);

        // 4. Check Expiry
        const today = new Date().toISOString().split('T')[0];
        if (payload.expiry < today) {
            return { valid: false, expiry: payload.expiry, customer: payload.customer, error: 'License Expired' };
        }

        return { valid: true, expiry: payload.expiry, customer: payload.customer };

    } catch (e: any) {
        console.error('License Verification Error:', e);
        return { valid: false, expiry: null, customer: null, error: e.message || 'Verification Error' };
    }
};

import { checkLicenseServerAction } from '@/app/actions/license';

export const getLicenseStatus = async (): Promise<LicenseStatus> => {
    try {
        // Use Server Action directly
        return await checkLicenseServerAction();
    } catch (e: any) {
        return { valid: false, expiry: null, customer: null, error: `Action Error: ${e.message}` };
    }
};

export const saveLicenseToken = async (token: string) => {
    const status = await verifyLicenseToken(token);
    if (!status.valid) throw new Error(status.error);

    // Save to DB
    const { error } = await supabase.from('system_settings').upsert({
        key: 'license_key',
        value: { token, customer: status.customer, expiry: status.expiry }
    });

    if (error) throw error;
    return status;
};
