import { supabaseAdmin as supabase } from './supabaseAdmin';
import { verifyLicenseToken } from './license';

export async function checkLicenseServer() {

    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .maybeSingle();

        if (error || !data?.value?.token) {
            return { valid: false, error: 'No License Found', expiry: null, customer: null };
        }

        return await verifyLicenseToken(data.value.token);
    } catch (error) {
        console.error('Server License Check Error:', error);
        return { valid: false, error: 'Check Failed', expiry: null, customer: null };
    }
}
