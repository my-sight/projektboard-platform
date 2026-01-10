import { createClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
    const isServer = typeof window === 'undefined';

    // Default values from environment (Next.js bakes these in at BUILD TIME)
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (isServer) {
        // Prioritize INTERNAL_SUPABASE_URL for server-side fetches inside Docker
        const internalUrl = process.env.INTERNAL_SUPABASE_URL;
        if (internalUrl) {
            url = internalUrl;
        }
    }

    return { supabaseUrl: url, supabaseKey: key, isServer };
};

const { supabaseUrl, supabaseKey } = getSupabaseConfig();
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
    }
});
