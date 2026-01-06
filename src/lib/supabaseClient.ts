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
        // Log initialization (visible in 'docker logs projektboard-app')
        console.log(`[SupabaseConfig] Server Initialized: ${url}`);
    } else {
        // High visibility browser log
        const keyInfo = key ? `Key Present (${key.length} chars, starts with ${key.substring(0, 10)}...)` : '!!! KEY MISSING !!!';
        const styles = key ? 'color: #00ff00; font-weight: bold; font-size: 12px;' : 'color: #ff0000; font-weight: bold; font-size: 14px;';

        console.log(`%c[SupabaseConfig] Browser Client: ${url}`, styles);
        console.log(`%c[SupabaseConfig] Status: ${keyInfo}`, styles);

        if (!key) {
            console.error('[SupabaseConfig] CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in the browser bundle. All requests will fail with 401.');
        }
    }

    return { supabaseUrl: url, supabaseKey: key, isServer };
};

const { supabaseUrl, supabaseKey } = getSupabaseConfig();
export const supabase = createClient(supabaseUrl, supabaseKey);
