import { createClient } from '@supabase/supabase-js';

const su = process.env.SUPABASE_URL;
const npsu = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = su || npsu || 'http://placeholder.url';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

if (typeof window === 'undefined') {
    console.log(`[SupabaseAdmin] ENV_SOURCE: SUPABASE_URL="${su}" | NEXT_PUBLIC_SUPABASE_URL="${npsu}"`);
    console.log(`[SupabaseAdmin] Final URL used: ${supabaseUrl}`);
    console.log(`[SupabaseAdmin] Service Role Key Present: ${!!supabaseServiceRoleKey && supabaseServiceRoleKey !== 'placeholder-key'}`);
}



export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});



