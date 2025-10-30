export interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: string | null;
  is_active: boolean;
  created_at?: string | null;
}

interface RawClientProfile extends Omit<ClientProfile, 'is_active'> {
  is_active: boolean | null;
}

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';

interface ProfilesResponse {
  data?: RawClientProfile[];
  error?: string;
}

function mapProfiles(rows: RawClientProfile[] | null | undefined): ClientProfile[] {
  return (rows ?? []).map(profile => ({
    ...profile,
    is_active: profile.is_active ?? true,
  }));
}

export async function fetchClientProfiles(): Promise<ClientProfile[]> {
  const supabase = typeof window === 'undefined' ? null : getSupabaseBrowserClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, company, role, is_active, created_at')
        .order('full_name', { ascending: true })
        .order('email', { ascending: true });

      if (error) {
        console.warn('Konnte Profile nicht direkt aus Supabase laden:', error.message);
      } else {
        return mapProfiles(data as RawClientProfile[] | null | undefined);
      }
    } catch (error) {
      console.warn('Fehler beim direkten Laden der Profile aus Supabase:', error);
    }
  }

  const response = await fetch('/api/profiles', {
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ProfilesResponse;
    throw new Error(payload?.error ?? `Fehler ${response.status}`);
  }

  const payload = (await response.json()) as ProfilesResponse;
  return mapProfiles(payload.data);
}

