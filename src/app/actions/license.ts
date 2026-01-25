'use server';

import { verifyLicenseToken } from '@/lib/license';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

import { checkLicenseServer } from '@/lib/license-server';

export async function checkLicenseServerAction() {
    try {
        // Use the robust helper with retry logic
        const status = await checkLicenseServer();

        // Serialize for client (ensure no non-serializable data leaks, though checkLicenseServer returns plain objects)
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
