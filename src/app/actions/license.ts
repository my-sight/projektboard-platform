'use server';

import { createClient } from '@supabase/supabase-js';
import { verifyLicenseToken } from '@/lib/license';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function submitLicenseKey(token: string) {
    try {
        // 1. Verify
        const status = await verifyLicenseToken(token);
        if (!status.valid) {
            return { success: false, error: status.error || 'Invalid Token' };
        }

        // 2. Save (Admin context)
        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: 'license_key',
                value: { token, customer: status.customer, expiry: status.expiry }
            });

        if (error) throw error;
        return { success: true, status };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
