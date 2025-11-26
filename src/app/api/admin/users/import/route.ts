import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Zwingt Next.js, Node.js zu nutzen
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- 1. GET: Verbindungstest (WICHTIG gegen 405 Fehler) ---
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔍 DIAGNOSE GET /api/admin/users/import:');
  console.log('- URL:', url ? 'OK' : 'FEHLT');
  console.log('- KEY:', key ? 'OK' : 'FEHLT');

  return NextResponse.json({ 
    status: 'Online', 
    config: { 
      url: url ? 'OK' : 'FEHLT', 
      key: key ? 'OK' : 'FEHLT' 
    } 
  });
}

// --- 2. POST: Import durchführen ---
export async function POST(request: NextRequest) {
  console.log('🚀 POST IMPORT START');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server-Konfiguration fehlt (Service Role Key).' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Ungültiges JSON.' }, { status: 400 });
    }

    const { users } = body;
    if (!users || !Array.isArray(users)) {
      return NextResponse.json({ error: 'Keine Benutzerdaten.' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const user of users) {
      if (!user.email || !user.password) {
        errors.push('Skip: Daten fehlen');
        continue;
      }

      const email = String(user.email).trim();
      // Outlook Fix: E-Mails validieren
      if (!email.includes('@')) continue;

      const password = String(user.password).trim();
      const fullName = user.full_name ? String(user.full_name).trim() : '';
      
      // A) Auth User
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authError) {
        console.error(`Auth Error (${email}):`, authError.message);
        errors.push(`${email}: ${authError.message}`);
        continue;
      }

      if (authData.user) {
        // B) Profil
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            company: null,
            role: 'user',
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (profileError) console.warn('Profile Error:', profileError.message);
        results.push(email);
      }
    }

    return NextResponse.json({
      success: true,
      imported: results.length,
      errors: errors
    });

  } catch (error: any) {
    console.error('Server Crash:', error);
    return NextResponse.json(
      { error: `Crash: ${error.message}` },
      { status: 500 }
    );
  }
}