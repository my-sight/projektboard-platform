import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminSupabaseClient } from '@/lib/supabaseServer';
import { isSuperuserEmail } from '@/constants/superuser'; // ✅ KORREKTUR: Import der Funktion

async function isTargetSuperuser(
  supabase: Awaited<ReturnType<typeof resolveAdminSupabaseClient>>['client'],
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Konnte Benutzerprofil nicht laden.');
  }

  if (!data) {
    return false;
  }

  // ✅ KORREKTUR: Nutzung der Hilfsfunktion
  return isSuperuserEmail(data.email);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client: supabase } = await resolveAdminSupabaseClient();

  try {
    if (await isTargetSuperuser(supabase, id)) {
      return NextResponse.json(
        { error: 'Der Superuser kann nicht bearbeitet werden.' },
        { status: 403 },
      );
    }

    const payload = await request.json();
    const updates: Record<string, unknown> = {};

    if ('full_name' in payload) {
      const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : null;
      updates.full_name = fullName && fullName.length > 0 ? fullName : null;
    }

    if ('role' in payload) {
      updates.role = payload.role;
    }

    if ('company' in payload) {
      updates.company = payload.company ?? null;
    }

    if ('is_active' in payload) {
      updates.is_active = Boolean(payload.is_active);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Keine Änderungen übermittelt.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)

      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Update user error:', error);
      const errorMessage = error.message ?? '';

      if (error.code === '42501' || errorMessage.toLowerCase().includes('row-level security')) {
        return NextResponse.json(
          {
            error:
              'Keine ausreichenden Rechte für diese Änderung. Bitte SUPABASE_SERVICE_ROLE_KEY konfigurieren oder passende Policies in Supabase ergänzen.'
          },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PATCH /users error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client: supabase, isService } = await resolveAdminSupabaseClient();

  if (!isService) {
    return NextResponse.json(
      { error: 'Benutzer löschen erfordert einen konfigurierten Supabase Service Role Key.' },
      { status: 501 },
    );
  }

  const userId = id;

  try {
    if (await isTargetSuperuser(supabase, userId)) {
      return NextResponse.json(
        { error: 'Der Superuser kann nicht gelöscht werden.' },
        { status: 403 },
      );
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError && authError.message && !authError.message.toLowerCase().includes('user not found')) {
      console.error('Delete auth user error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);

    if (profileError) {
      console.error('Delete profile error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('DELETE /users error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}