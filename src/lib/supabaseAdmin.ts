import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://placeholder.url';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (typeof window === 'undefined') {
        console.warn('⚠️ [SupabaseAdmin] No URL found. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.');
    }
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

