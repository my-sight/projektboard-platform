
import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';
import { supabase as supabaseShared } from './supabaseClient';
import { isSuperuserEmail } from '@/constants/superuser';

export async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        console.log('[AuthServer] ❌ No Authorization header');
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token || token === 'undefined') {
        console.log('[AuthServer] ❌ Token is empty or undefined');
        return null;
    }

    try {
        const { data: { user }, error: authError } = await supabaseShared.auth.getUser(token);

        if (authError || !user) {
            console.error('[AuthServer] ❌ Auth error or no user:', authError?.message || 'User null');

            // EMERGENCY FALLBACK: If auth fails but this is a debug call, we might want to know more.
            // But for security, we only allow a very specific email based on the token if we COULD decode it.
            // Since we can't decode without a lib, we just stay strict OR check the superuser email list
            // if we had the email. 
            return null;
        }

        console.log(`[AuthServer] 🔍 Authenticated User: ${user.email} (${user.id})`);

        // Check system_role in profiles
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('system_role')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.warn(`[AuthServer] ⚠️ Profile fetch error for ${user.id}:`, profileError.message);
        }

        const role = profile?.system_role;
        console.log(`[AuthServer] 🎭 User: ${user.email}, Found Role: ${role}`);

        if (role === 'admin' || role === 'superuser' || isSuperuserEmail(user.email)) {
            if (isSuperuserEmail(user.email)) console.log(`[AuthServer] ✅ SUPERUSER ACCESS GRANTED: ${user.email}`);
            return user;
        }

        console.warn(`[AuthServer] 🚫 Unauthorized attempt by: ${user.email}`);
        return null;
    } catch (e: any) {
        console.error('[AuthServer] 🔥 Unexpected exception:', e.message);
        return null;
    }
}
