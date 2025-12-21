import { createClient } from '@supabase/supabase-js';

// --- ULTIMATE DYNAMIC FIX ---
// This makes the app "location-agnostic". 
// In the browser, it automatically finds the NUC by using the current address bar hostname.
const isBrowser = typeof window !== 'undefined';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:8000';

if (isBrowser) {
    // browser uses hostname from address bar
    supabaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
} else {
    // server uses external IP provided by installer
    supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:8000';
}

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

console.log(`[SupabaseClient] DYNAMIC_INIT: isBrowser=${isBrowser}, url=${supabaseUrl}`);

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    // Adding global region to prevent "Region is missing" in storage calls
    // even though self-hosted Supabase doesn't strictly need it, 
    // the client library sometimes checks for it when talking to non-standard domains.
    global: {
        headers: { 'x-region': 'eu-central-1' }
    }
});


