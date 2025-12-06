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
