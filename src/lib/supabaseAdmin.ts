import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabaseClient';

const { supabaseUrl } = getSupabaseConfig();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
