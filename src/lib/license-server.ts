import { createClient } from '@supabase/supabase-js';
import { verifyLicenseToken } from './license';

export async function checkLicenseServer() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceKey);

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
