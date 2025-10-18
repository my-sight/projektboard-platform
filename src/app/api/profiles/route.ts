import { NextResponse } from 'next/server';
import { resolveAdminSupabaseClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const { client } = await resolveAdminSupabaseClient();

    const { data, error } = await client
      .from('profiles')
      .select('id, email, full_name, company, role, is_active, created_at')
      .order('full_name', { ascending: true })
      .order('email', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler beim Laden der Profile';
    console.error('GET /api/profiles', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

