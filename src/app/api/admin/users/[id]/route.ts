import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabaseServer';

const handleConfigError = () =>
  NextResponse.json({ error: 'Supabase service role key is not configured.' }, { status: 500 });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let supabase;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    console.error('Service client error:', error);
    return handleConfigError();
  }

  try {
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
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Update user error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('PATCH /users error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  let supabase;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    console.error('Service client error:', error);
    return handleConfigError();
  }

  const userId = params.id;

  try {
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
