import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase Browser Client: Fehlende NEXT_PUBLIC_SUPABASE_* Variablen.');
    }
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, anonKey);
  }

  return browserClient;
}

export function requireSupabaseBrowserClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      'Supabase ist nicht konfiguriert. Bitte setze NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return client;
}

export function resetSupabaseBrowserClient() {
  browserClient = null;
}
