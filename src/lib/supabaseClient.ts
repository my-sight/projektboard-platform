import { createClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
    const isServer = typeof window === 'undefined';

    // Default values
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (isServer) {
        // Prioritize INTERNAL_SUPABASE_URL for server-side fetches inside Docker
        const internalUrl = process.env.INTERNAL_SUPABASE_URL;
        if (internalUrl) {
            url = internalUrl;
        } else {
            // Fallback for development or missing config
            console.warn('[SupabaseConfig] Server-side: INTERNAL_SUPABASE_URL not set, using Public URL:', url);
        }

        // Log initialization (visible in 'docker logs projektboard-app')
        console.log(`[SupabaseConfig] Server Initialized: ${url}`);
    }

    return { supabaseUrl: url, supabaseKey: key, isServer };
};

const { supabaseUrl, supabaseKey } = getSupabaseConfig();
export const supabase = createClient(supabaseUrl, supabaseKey);
