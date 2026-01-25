import { verifyLicenseToken } from './license';
import { supabaseAdmin as supabase } from './supabaseAdmin';

export async function checkLicenseServer() {
    console.log('[LicenseServer] Starting license check on server...');

    const MAX_RETRIES = 10; // Increased to 10
    const BASE_DELAY = 2000; // Increased to 2 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // @ts-ignore - access internal supabaseUrl for debugging
            if (attempt === 1) console.log('[LicenseServer] Using URL:', supabase.supabaseUrl);

            // Access system_settings table
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'license_key')
                .maybeSingle();

            if (error) {
                throw new Error(`Database Error (${error.code}): ${error.message}`);
            }

            if (!data || !data.value || !data.value.token) {
                return { valid: false, error: 'No License Found in DB', expiry: null, customer: null };
            }

            const status = await verifyLicenseToken(data.value.token);
            if (!status.valid) {
                return { ...status, error: `Verification Failed: ${status.error}` };
            }
            return status;

        } catch (e: any) {
            console.warn(`[LicenseServer] Attempt ${attempt}/${MAX_RETRIES} failed. Error: ${e.message || e}`);

            if (attempt < MAX_RETRIES) {
                const delay = BASE_DELAY + (attempt * 500); // Linear backoff: 2.5s, 3s, 3.5s... -> Total ~45s cover
                console.log(`[LicenseServer] Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            // Final failure
            return { valid: false, error: `Startup Error: ${e.message || 'Unknown'}`, expiry: null, customer: null };
        }
    }

    return { valid: false, error: 'Unknown Error (Retries exhausted)', expiry: null, customer: null };
}
