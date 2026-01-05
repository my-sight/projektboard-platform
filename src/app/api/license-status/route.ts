import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { verifyLicenseToken } from '@/lib/license';

export async function GET() {
    try {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'license_key')
            .maybeSingle();

        if (!data || !data.value || !data.value.token) {
            return NextResponse.json({ valid: false, error: 'No License Found (Server)' });
        }

        const status = await verifyLicenseToken(data.value.token);
        return NextResponse.json(status);

    } catch (error: any) {
        console.error('License API Error:', error);
        return NextResponse.json({ valid: false, error: error.message || 'Server Error' }, { status: 500 });
    }
}
