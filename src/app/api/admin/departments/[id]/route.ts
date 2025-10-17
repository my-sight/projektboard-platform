import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabaseServer';

const handleConfigError = () =>
  NextResponse.json({ error: 'Supabase service role key is not configured.' }, { status: 500 });

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  let supabase;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    console.error('Service client error:', error);
    return handleConfigError();
  }

  try {
    const { error } = await supabase.from('departments').delete().eq('id', params.id);

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
