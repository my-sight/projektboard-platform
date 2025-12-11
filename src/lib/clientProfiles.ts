import { supabase } from '@/lib/supabaseClient';

export interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  department?: string | null;
  name?: string | null; // Compatibility alias for full_name
  role: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export async function fetchClientProfiles(): Promise<ClientProfile[]> {
  try {
    const { data: records, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;

    return (records || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      company: u.company || null,
      department: null, // 'department' column missing in public.profiles schema
      name: u.full_name, // Alias
      role: u.role || 'user',
      is_active: u.is_active ?? true,
      created_at: u.created_at
    }));
  } catch (error) {
    console.warn('Fehler beim Laden der Profile aus Supabase:', error);
    return [];
  }
}

