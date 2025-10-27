import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminSupabaseClient } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  const { client: supabase, isService } = await resolveAdminSupabaseClient();

  try {
    const { name } = await request.json();
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'Abteilungsname ist erforderlich.' }, { status: 400 });
    }

    if (!isService) {
      return NextResponse.json(
        {
          error:
            'Zum Anlegen von Abteilungen wird ein SUPABASE_SERVICE_ROLE_KEY oder passende Supabase-Policies benötigt.'
        },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({ name: trimmedName })
      .select('*')
      .single();

    if (error) {
      console.error('Create department error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('POST /departments error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
