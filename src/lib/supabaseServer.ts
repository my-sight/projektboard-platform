import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

type AnySupabaseClient = SupabaseClient<any, any, any>;

export function getServiceSupabaseClient(): AnySupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role client is not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

export function getRouteSupabaseClient(): AnySupabaseClient {
  return createRouteHandlerClient({ cookies }) as unknown as AnySupabaseClient;
}

export function resolveAdminSupabaseClient(): { client: AnySupabaseClient; isService: boolean } {
  try {
    return { client: getServiceSupabaseClient(), isService: true };
  } catch (error) {
    console.warn('Falling back to authenticated Supabase client – service role key missing.');
    return { client: getRouteSupabaseClient(), isService: false };
  }
}
