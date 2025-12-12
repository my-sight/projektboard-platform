import { createClient } from '@supabase/supabase-js';
import { verifyLicenseToken } from './license';

export async function checkLicenseServer() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        const { data: { value }, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .single();

        if (error || !value || !value.token) {
            return { valid: false, error: 'No License Found' };
        }

        return await verifyLicenseToken(value.token);
    } catch (error) {
        console.error('Server License Check Error:', error);
        return { valid: false, error: 'Check Failed' };
    }
}
