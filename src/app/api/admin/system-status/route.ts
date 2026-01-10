import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSupabaseConfig } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { checkLicenseServer } from '@/lib/license-server';
import fs from 'fs';
import path from 'path';

// Helper to verify admin (Duplicated from users/route.ts - ideally should be middleware or lib)
async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();

    const supabase = createClient(supabaseUrl, supabaseKey);
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

export async function GET(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. License Check
        const license = await checkLicenseServer();

        // 2. Backup Check
        // We expect backups to be mapped to /app/backups or similar.
        // For now, let's assume `deploy/backups` is mounted to `/backups` in the container.
        // We'll check the directory.
        let backupStatus = {
            lastBackup: null as string | null,
            totalBackups: 0,
            status: 'unknown' // ok, warning, error, unknown
        };

        const backupDir = '/backups'; // Needs to be mounted in docker-compose
        if (fs.existsSync(backupDir)) {
            try {
                const files = fs.readdirSync(backupDir)
                    .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
                    .sort().reverse(); // Newest first

                if (files.length > 0) {
                    const lastFile = files[0];
                    const stat = fs.statSync(path.join(backupDir, lastFile));
                    backupStatus.lastBackup = stat.mtime.toISOString();
                    backupStatus.totalBackups = files.length;

                    // Check recency (e.g. 24h)
                    const hoursAgo = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
                    backupStatus.status = hoursAgo < 25 ? 'ok' : 'warning';
                } else {
                    backupStatus.status = 'warning'; // Dir exists but empty
                }
            } catch (e) {
                console.error('Backup dir scan failed', e);
                backupStatus.status = 'error';
            }
        } else {
            backupStatus.status = 'not_configured';
        }

        // 3. RAID Check
        // We cannot easily check RAID from container without mounting /proc/mdstat.
        // If mounted, we read it.
        let raidStatus = {
            healthy: null as boolean | null,
            details: 'Not available (RAID)'
        };

        const mdstatPath = '/host_mdstat';
        if (fs.existsSync(mdstatPath)) {
            try {
                const mdstat = fs.readFileSync(mdstatPath, 'utf-8');
                raidStatus.healthy = mdstat.includes('active') && !mdstat.includes('(_U)') && !mdstat.includes('(U_)'); // Simple heuristic
                raidStatus.details = raidStatus.healthy ? 'RAID Active & Synced' : 'Degraded or Syncing';

                // Better heuristic: look for [UU]
                if (mdstat.includes('blocks')) {
                    // e.g. "md0 : active raid1 sda1[0] sdb1[1]"
                    // "      ... [UU]"
                    if (mdstat.includes('[_U]') || mdstat.includes('[U_]')) {
                        raidStatus.healthy = false;
                        raidStatus.details = 'DEGRADED (Check Host)';
                    } else if (mdstat.includes('[UU]')) {
                        raidStatus.healthy = true;
                        raidStatus.details = 'Healthy (RAID1)';
                    }
                }
            } catch (e) { console.error('RAID check failed', e); }
        }

        return NextResponse.json({
            license,
            backup: backupStatus,
            raid: raidStatus
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
