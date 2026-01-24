import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/supabaseClient';

// Helper to verify admin
async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();

    // Create a client to verify the token
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    // Check role in profiles
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role === 'admin' || profile?.role === 'superuser') {
        return user;
    }
    return null;
}

export async function GET(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // List users - usually just return profiles for the management view
    // If we need auth data (like last sign in), we'd need to list users from auth.
    // But for now, profiles should match.
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: profiles });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req);
    // Return generic 401
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { email, password, name, role, company, department } = body;

        // 1. Strict Input Validation (CWE-20)
        // Sanitization happens automatically via Supabase Client (SQL), but format check is needed.
        if (!email || !EMAIL_REGEX.test(email)) {
            return NextResponse.json({ error: 'Ungültiges E-Mail Format' }, { status: 400 });
        }
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json({ error: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein` }, { status: 400 });
        }
        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
        }

        // --- LICENSE CHECK START ---
        // Verify user limit
        const { checkLicenseServer } = await import('@/lib/license-server');
        const license = await checkLicenseServer();

        if (license.valid && typeof license.maxUsers === 'number') {
            // Fetch all emails to count (filtering locally to correctly handle superuser check logic)
            const { data: profiles, error: countError } = await supabaseAdmin
                .from('profiles')
                .select('email');

            if (!countError && profiles) {
                const { isSuperuserEmail } = await import('@/constants/superuser');
                const currentCount = profiles.filter(p => !isSuperuserEmail(p.email)).length;

                if (currentCount >= license.maxUsers) {
                    return NextResponse.json({
                        error: `Lizenzlimit erreicht. Maximale Benutzeranzahl: ${license.maxUsers}`
                    }, { status: 403 }); // 403 Forbidden for license limit
                }
            }
        }
        // --- LICENSE CHECK END ---

        // 1. Create Auth User
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name }
        });

        if (authError) {
            // Pass specific auth errors (like "User already exists") but sanitize others
            if (authError.message.includes('already registered')) {
                return NextResponse.json({ error: 'Benutzer existiert bereits' }, { status: 409 });
            }
            throw authError; // Rethrow internal errors to catch block
        }

        if (!authUser.user) throw new Error('User creation failed');

        // 2. Create/Update Profile (Trigger might have created it, but we ensure fields are set)

        // Let's create profile object
        const profileData = {
            id: authUser.user.id,
            email,
            full_name: name,
            role: role || 'user',
            company: company || department || null,
            is_active: true
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(profileData);

        if (profileError) {
            console.error('Profile creation error:', profileError);
            // We do NOT return the full database error to client (CWE-209)
            return NextResponse.json({ error: 'Benutzer erstellt, aber Profil konnte nicht gespeichert werden.' }, { status: 500 });
        }

        // --- AUDIT LOG ---
        await supabaseAdmin.from('audit_logs').insert({
            actor_id: admin.id,
            action: 'create_user',
            target_id: authUser.user.id,
            details: { email, role, company, name }
        });

        return NextResponse.json({ user: profileData });

    } catch (e: any) {
        // 2. Secure Error Handling (CWE-209)
        // Log sensitive details internally only
        console.error('[CreateUser Failed]', {
            error: e.message,
            stack: e.stack,
            actorId: admin.id
        });

        // Return generic message to client
        return NextResponse.json(
            { error: 'Interner Serverfehler. Bitte Systemadministrator kontaktieren.' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        // Delete Auth User (cascades to profiles usually if fk set, otherwise we delete profile too)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;

        // Ensure profile is gone (if no cascade)
        await supabaseAdmin.from('profiles').delete().eq('id', id);

        // --- AUDIT LOG ---
        await supabaseAdmin.from('audit_logs').insert({
            actor_id: admin.id,
            action: 'delete_user',
            target_id: id,
            details: { deleted_at: new Date().toISOString() }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { id, password, ...updates } = body;

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        // Update password if provided
        if (password) {
            const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
            if (pwdError) throw pwdError;
        }

        // Update profile fields
        if (Object.keys(updates).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update(updates)
                .eq('id', id);

            if (profileError) throw profileError;
        }

        // --- AUDIT LOG ---
        await supabaseAdmin.from('audit_logs').insert({
            actor_id: admin.id,
            action: 'update_user',
            target_id: id,
            details: { updates, password_changed: !!password }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
