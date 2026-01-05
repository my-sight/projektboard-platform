'use server';

import { verifyLicenseToken } from '@/lib/license';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function checkLicenseServerAction() {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .maybeSingle();

        if (error) {
            console.error('DB Error checking license:', error);
            return { valid: false, error: `Database Error: ${error.message} (Code: ${error.code})`, expiry: null, customer: null };
        }

        if (!data || !data.value || !data.value.token) {
            return { valid: false, error: 'No License Found in DB (Server Action)', expiry: null, customer: null };
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

import { revalidatePath } from 'next/cache';

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

        // 3. Clear cache to avoid redirection loop
        revalidatePath('/');

        return { success: true, status };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
