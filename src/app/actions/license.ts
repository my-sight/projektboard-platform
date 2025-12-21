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

        // --- RAW PROBE START ---
        const rawUrl = `${process.env.SUPABASE_URL}/rest/v1/system_settings?select=*&limit=1`;
        console.log('Save License Action - RAW_PROBE URL:', rawUrl);
        try {
            const probeResp = await fetch(rawUrl, {
                headers: {
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
            const probeText = await probeResp.text();
            console.log(`Save License Action - RAW_PROBE STATUS: ${probeResp.status} ${probeResp.statusText}`);
            console.log(`Save License Action - RAW_PROBE BODY: ${probeText.substring(0, 200)}`);
        } catch (pe: any) {
            console.error('Save License Action - RAW_PROBE FAILED:', pe.message);
        }
        // --- RAW PROBE END ---

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
        console.error('Save License Action - RAW ERROR:', error);

        // Forced serialization of the error object
        const detailedError = {
            _original: String(error),
            name: error?.name || 'NoName',
            message: error?.message || 'NoMessage',
            code: error?.code || 'NoCode',
            status: error?.status || 'NoStatus',
            details: error?.details || 'NoDetails',
            hint: error?.hint || 'NoHint',
            stack: error?.stack || 'NoStack',
            rawJson: JSON.stringify(error)
        };

        console.error('Save License Action - DETAILED ERROR BLOCK:', JSON.stringify(detailedError, null, 2));

        return { success: false, error: error.message || 'Failed to save license' };
    }
}






