import type { SupabaseClient } from '@supabase/supabase-js';

export async function buildSupabaseAuthHeaders(
  supabase: SupabaseClient<any, any, any> | null | undefined,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (!supabase) {
    return headers;
  }

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;

    if (accessToken) {
      headers['x-supabase-access-token'] = accessToken;
    }

    if (refreshToken) {
      headers['x-supabase-refresh-token'] = refreshToken;
    }
  } catch (error) {
    console.warn('⚠️ Konnte Supabase-Session nicht abrufen:', error);
  }

  return headers;
}
