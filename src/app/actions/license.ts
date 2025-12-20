'use server';

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { verifyLicenseToken } from '@/lib/license';

export async function checkLicenseServerAction() {
    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .maybeSingle();

        if (!data || !data.value || !data.value.token) {
            return { valid: false, error: 'No License Found (Server Action)', expiry: null, customer: null };
        }

        const status = await verifyLicenseToken(data.value.token);
        // Serialize for client
        return {
            valid: status.valid,
            expiry: status.expiry,
            customer: status.customer,
            maxUsers: status.maxUsers,
            error: status.error
        };

    } catch (error: any) {
        console.error('License Action Error:', error);
        return { valid: false, error: error.message || 'Server Action Error', expiry: null, customer: null };
    }
}
