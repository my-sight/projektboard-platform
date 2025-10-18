export interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: string | null;
  is_active: boolean;
  created_at?: string | null;
}

interface ProfilesResponse {
  data?: ClientProfile[];
  error?: string;
}

export async function fetchClientProfiles(): Promise<ClientProfile[]> {
  const response = await fetch('/api/profiles', {
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ProfilesResponse;
    throw new Error(payload?.error ?? `Fehler ${response.status}`);
  }

  const payload = (await response.json()) as ProfilesResponse;
  return payload.data ?? [];
}

