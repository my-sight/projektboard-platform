import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabaseServer';

const handleConfigError = () =>
  NextResponse.json({ error: 'Supabase service role key is not configured.' }, { status: 500 });

export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    console.error('Service client error:', error);
    return handleConfigError();
  }

  try {
    const { name } = await request.json();
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      return NextResponse.json({ error: 'Abteilungsname ist erforderlich.' }, { status: 400 });
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
