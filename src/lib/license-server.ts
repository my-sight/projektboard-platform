import { verifyLicenseToken } from './license';
import { supabaseAdmin as supabase } from './supabaseAdmin';

export async function checkLicenseServer() {
    console.log('[LicenseServer] Starting license check on server...');
    try {
        // @ts-ignore - access internal supabaseUrl for debugging
        console.log('[LicenseServer] Using URL:', supabase.supabaseUrl);
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .maybeSingle();

        if (error) {
            return { valid: false, error: `Database Error: ${error.message} (Code: ${error.code})`, expiry: null, customer: null };
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
        console.error('Server License Check Error:', e);
        return { valid: false, error: `System Error: ${e.message || 'Unknown'}`, expiry: null, customer: null };
    }
}
