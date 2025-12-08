import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminSupabaseClient } from '@/lib/supabaseServer';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client: supabase, isService } = await resolveAdminSupabaseClient();

  if (!isService) {
    return NextResponse.json(
      {
        error:
          'Zum Löschen von Abteilungen wird ein SUPABASE_SERVICE_ROLE_KEY oder passende Supabase-Policies benötigt.'
      },
      { status: 403 },
    );
  }

  try {
    const { error } = await supabase.from('departments').delete().eq('id', id);

    if (error) {
      console.error('Delete department error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('DELETE /departments error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client: supabase, isService } = await resolveAdminSupabaseClient();

  if (!isService) {
    return NextResponse.json(
      {
        error:
          'Zum Bearbeiten von Abteilungen wird ein SUPABASE_SERVICE_ROLE_KEY oder passende Supabase-Policies benötigt.'
      },
      { status: 403 },
    );
  }

  try {
    const { name } = await request.json();
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'Abteilungsname ist erforderlich.' }, { status: 400 });
    }

    // 1. Alten Namen abrufen, um Änderungen an Usern vorzunehmen
    const { data: oldDept, error: fetchError } = await supabase
      .from('departments')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchError || !oldDept) {
      return NextResponse.json({ error: 'Abteilung nicht gefunden.' }, { status: 404 });
    }

    const oldName = oldDept.name;

    // 2. Abteilung umbenennen
    const { data, error } = await supabase
      .from('departments')
      .update({ name: trimmedName })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Update department error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Wenn Name geändert: Alle User mit altem Abteilungsnamen updaten
    if (oldName !== trimmedName) {
      const { error: userUpdateError } = await supabase
        .from('profiles')
        .update({ company: trimmedName })
        .eq('company', oldName);

      if (userUpdateError) {
        console.error('Failed to update users company:', userUpdateError);
        // Log error but assume success for the department update
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PATCH /departments error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
