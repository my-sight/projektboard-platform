import { supabaseAdmin as supabase } from './supabaseAdmin';
import { verifyLicenseToken } from './license';

export async function checkLicenseServer() {

    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .maybeSingle();

        console.log(`[checkLicenseServer] DB_RESULT: data=${!!data}, error=${!!error}`);

        if (error || !data?.value?.token) {
            console.log(`[checkLicenseServer] FAILED: Missing token in DB`);
            return { valid: false, error: 'No License Found', expiry: null, customer: null };
        }

        const status = await verifyLicenseToken(data.value.token);
        console.log(`[checkLicenseServer] VALIDATION: ${status.valid ? 'VALID' : 'INVALID: ' + status.error}`);
        return status;

    } catch (error) {
        console.error('Server License Check Error:', error);
        return { valid: false, error: 'Check Failed', expiry: null, customer: null };
    }
}
