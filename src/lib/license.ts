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
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
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

        // 1. Import Public Key via Web Crypto API
        const keyBuffer = pemToArrayBuffer(LICENSE_PUBLIC_KEY);
        const cryptoKey = await window.crypto.subtle.importKey(
            "spki",
            keyBuffer,
            { name: "Ed25519" },
            true,
            ["verify"]
        );

        // 2. Verify Signature
        const payloadString = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        const dataToVerify = new TextEncoder().encode(payloadString);

        const signatureBuffer = base64ToArrayBuffer(signatureB64);

        const isValid = await window.crypto.subtle.verify(
            { name: "Ed25519" },
            cryptoKey,
            signatureBuffer,
            dataToVerify
        );

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

export const getLicenseStatus = async (): Promise<LicenseStatus> => {
    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .single();

        if (!data || !data.value || !data.value.token) {
            return { valid: false, expiry: null, customer: null, error: 'No License Found' };
        }

        return await verifyLicenseToken(data.value.token);
    } catch (e) {
        return { valid: false, expiry: null, customer: null, error: 'Database Error' };
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
