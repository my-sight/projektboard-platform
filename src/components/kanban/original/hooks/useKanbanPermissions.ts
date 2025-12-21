
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isSuperuserEmail } from '@/constants/superuser';
import { UserProfile } from '@/types'; // Assuming UserProfile is available, or use any

export interface KanbanPermissions {
    canEditContent: boolean;
    canManageSettings: boolean;
    canManageAttendance: boolean;
}

export function useKanbanPermissions(boardId: string, user: any, profile: any) {
    const [permissions, setPermissions] = useState<KanbanPermissions>({
        canEditContent: false,
        canManageSettings: false,
        canManageAttendance: false
    });
    const [canModifyBoard, setCanModifyBoard] = useState(false);
    const [loadingPermissions, setLoadingPermissions] = useState(true);

    const resolvePermissions = useCallback(async (loadedUsers?: any[]) => {
        setLoadingPermissions(true);
        try {
            if (!user) {
                setCanModifyBoard(false);
                setPermissions({ canEditContent: false, canManageSettings: false, canManageAttendance: false });
                return;
            }

            const authUserId = user.id;
            const email = user.email || '';

            // PRIO 1: HIGHLANDER (SUPERUSER) & GLOBAL ADMIN
            const isMichael = isSuperuserEmail(email) || authUserId === '33333333-3333-3333-3333-333333333333';
            const globalRole = String(profile?.system_role ?? '').toLowerCase();
            const isGlobalAdmin = isMichael || globalRole === 'admin';

            console.log(`[KanbanPermissions] User: ${email}, isMichael: ${isMichael}, isGlobalAdmin: ${isGlobalAdmin}`);

            if (isGlobalAdmin) {
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
                return;
            }

            // PRIO 2: BOARD-SPECIFIC ROLES
            // Fetch member data
            let memberRow = null;
            try {
                const { data } = await supabase
                    .from('board_members')
                    .select('system_role')
                    .eq('board_id', boardId)
                    .eq('profile_id', authUserId)
                    .maybeSingle();
                memberRow = data;
            } catch (e) { /* ignore */ }

            const isMember = !!memberRow;
            const boardRole = memberRow?.system_role;

            console.log(`[KanbanPermissions] isMember: ${isMember}, boardRole: ${boardRole}`);

            if (isMember && boardRole === 'admin') {
                // Board Admin: "darf auf den Boards, in denen er admin ist alles"
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
            } else if (isMember) {
                // User: "darf nur auf boards veränderungen vornehmen, in denen er mitglied ist"
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: false, canManageAttendance: false });
            } else {
                // View only
                setCanModifyBoard(false);
                setPermissions({ canEditContent: false, canManageSettings: false, canManageAttendance: false });
            }

        } catch (err) {
            console.error('Error resolving permissions', err);
        } finally {
            setLoadingPermissions(false);
        }
    }, [boardId, user, profile]);

    return { permissions, canModifyBoard, loadingPermissions, resolvePermissions };
}
