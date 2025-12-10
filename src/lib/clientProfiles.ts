export interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  department?: string | null; // Added
  name?: string | null; // Added
  role: string | null;
  is_active: boolean;
  created_at?: string | null;
}

interface RawClientProfile extends Omit<ClientProfile, 'is_active'> {
  is_active: boolean | null;
}

import { pb } from '@/lib/pocketbase';

export async function fetchClientProfiles(): Promise<ClientProfile[]> {
  try {
    const records = await pb.collection('users').getFullList({
      sort: 'name',
    });

    return records.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.name, // PB 'users' has 'name'
      company: u.company || null,
      department: u.department || null,
      name: u.name,
      role: u.role || null,
      is_active: true, // PB users are active if retrieved/verified
      created_at: u.data?.created ?? u.created // Access created timestamp
    }));
  } catch (error) {
    console.warn('Fehler beim Laden der Profile aus PocketBase:', error);
    return [];
  }
}

