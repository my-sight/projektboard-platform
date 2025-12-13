
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

// Helper to verify admin - DUPLICATED from users/route.ts for now
async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;

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

export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { name } = body;
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('departments')
            .insert({ name })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { id, name } = body;
        if (!id || !name) return NextResponse.json({ error: 'ID and Name required' }, { status: 400 });

        // 1. Get old name
        const { data: oldDept } = await supabaseAdmin.from('departments').select('name').eq('id', id).single();
        const oldName = oldDept?.name;

        // 2. Update Department
        const { data, error } = await supabaseAdmin
            .from('departments')
            .update({ name })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 3. Update Profiles if name changed
        if (oldName && oldName !== name) {
            await supabaseAdmin
                .from('profiles')
                .update({ company: name })
                .eq('company', oldName);
        }

        return NextResponse.json({ data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    try {
        const { error } = await supabaseAdmin
            .from('departments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
