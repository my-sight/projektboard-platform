
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

// Helper to verify admin
async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Create a client to verify the token
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
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

export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { email, password, name, role, company, department } = body;

        if (!email || !password) return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });

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
                    }, { status: 403 });
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

        if (authError) throw authError;
        if (!authUser.user) throw new Error('User creation failed');

        // 2. Create/Update Profile (Trigger might have created it, but we ensure fields are set)
        // We try to update first, if it fails (not exists yet?) we insert.
        // Actually, trigger usually runs After Insert on auth.users.
        // So we wait a tiny bit or just upsert.

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
            // If profile creation fails, we might want to delete the auth user to keep consistency?
            // For now just log and return error
            console.error('Profile creation error:', profileError);
            return NextResponse.json({ error: 'User created but profile failed: ' + profileError.message }, { status: 500 });
        }

        return NextResponse.json({ user: profileData });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
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

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
