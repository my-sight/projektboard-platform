import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabaseClient = SupabaseClient<any, any, any>;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} ist nicht konfiguriert.`);
  }

  return value;
}

function getProjectRef(supabaseUrl: string): string | null {
  try {
    const { host } = new URL(supabaseUrl);
    const [ref] = host.split('.');
    return ref || null;
  } catch (error) {
    console.warn('Konnte Supabase-Projekt-Ref aus URL nicht ermitteln:', error);
    return null;
  }
}

export function getServiceSupabaseClient(): AnySupabaseClient {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Supabase service role client is not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

interface SessionTokens {
  accessToken?: string;
  refreshToken?: string;
}

interface SessionClientResult {
  client: AnySupabaseClient;
  accessToken?: string;
  refreshToken?: string;
}

async function createSessionClientFromCookies(tokens: SessionTokens = {}): Promise<SessionClientResult> {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  let accessToken = tokens.accessToken;
  let refreshToken = tokens.refreshToken;

  if (!accessToken || !refreshToken) {
    try {
      const projectRef = getProjectRef(supabaseUrl);

      if (projectRef) {
        const authCookie = cookies().get(`sb-${projectRef}-auth-token`);

        if (authCookie?.value) {
          const parsed = JSON.parse(authCookie.value) as {
            access_token?: string;
            refresh_token?: string;
          };

          accessToken = accessToken ?? parsed.access_token;
          refreshToken = refreshToken ?? parsed.refresh_token;
        }
      }
    } catch (error) {
      console.warn('Fehler beim Anwenden der Supabase-Session aus Cookies:', error);
    }
  }

  const globalHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: Boolean(refreshToken),
    },
    ...(globalHeaders ? { global: { headers: globalHeaders } } : {}),
  });

  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.warn('Konnte Supabase-Session aus Header-Tokens nicht übernehmen:', error.message);
    }
  }

  return { client, accessToken, refreshToken };
}

export async function resolveAdminSupabaseClient(tokens: SessionTokens = {}): Promise<{ client: AnySupabaseClient; isService: boolean }> {
  try {
    return { client: getServiceSupabaseClient(), isService: true };
  } catch (error) {
    console.warn('Falling back to authenticated Supabase client – service role key missing.');
    const { client } = await createSessionClientFromCookies(tokens);
    return { client, isService: false };
  }
}

export async function getServerSessionUser(tokens: SessionTokens = {}): Promise<User | null> {
  try {
    const { client, accessToken } = await createSessionClientFromCookies(tokens);
    const { data, error } = accessToken
      ? await client.auth.getUser(accessToken)
      : await client.auth.getUser();

    if (error) {
      console.warn('Konnte aktuellen Supabase-User nicht laden:', error.message);
      return null;
    }

    return data.user ?? null;
  } catch (error) {
    console.warn('Fehler beim Laden des aktuellen Supabase-Users:', error);
    return null;
  }
}
