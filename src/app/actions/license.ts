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

export async function saveLicenseTokenAction(token: string) {
    try {
        const status = await verifyLicenseToken(token);
        if (!status.valid) {
            throw new Error(status.error || 'Invalid License Key');
        }

        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: 'license_key',
                value: {
                    token,
                    customer: status.customer,
                    expiry: status.expiry
                }
            });

        if (error) throw error;

        return {
            success: true,
            status: {
                valid: status.valid,
                expiry: status.expiry,
                customer: status.customer,
                maxUsers: status.maxUsers
            }
        };
    } catch (error: any) {
        console.error('Save License Action Error Detail:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        return { success: false, error: error.message || 'Failed to save license' };
    }
}


