
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

            const email = user.email || '';

            // PRIO 1: HARDCODED SUPERUSER CHECK (Synchron & Immediate)
            if (isSuperuserEmail(email) || email === 'admin@kanban.local') {
                console.log(`[KanbanPermissions] ⚡️ SUPERUSER DETECTED: ${email}`);
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
                setLoadingPermissions(false); // Stop loading immediately
                return;
            }

            const authUserId = user.id;

            let userProfile = profile;
            if (!userProfile && loadedUsers) {
                userProfile = loadedUsers.find((u: any) => u.id === authUserId);
            }

            const globalRole = String(userProfile?.role ?? '').toLowerCase();
            const isGlobalAdmin = globalRole === 'superuser' || globalRole === 'admin';

            console.log(`[KanbanPermissions] User: ${email}, Global: ${globalRole}, IsGlobalAdmin: ${isGlobalAdmin}`);

            if (isGlobalAdmin) {
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
                return;
            }

            // Fetch board data for owner check
            let boardRow = null;
            try {
                const { data } = await supabase.from('kanban_boards').select('*').eq('id', boardId).single();
                boardRow = data;
            } catch (e) { /* ignore */ }

            const isOwner = boardRow?.owner_id === authUserId;
            const isBoardAdmin = boardRow?.board_admin_id === authUserId;

            // Fetch member data
            let memberRow = null;
            try {
                const { data } = await supabase
                    .from('board_members')
                    .select('*')
                    .eq('board_id', boardId)
                    .eq('profile_id', authUserId)
                    .single();
                memberRow = data;
            } catch (e) { /* ignore */ }

            const isMember = !!memberRow;
            const memberRole = memberRow?.role;

            console.log(`[KanbanPermissions] Owner: ${isOwner} (${boardRow?.owner_id}), BoardAdmin: ${isBoardAdmin}, MemberRole: ${memberRole}`);

            if (isOwner || isBoardAdmin || (isMember && memberRole === 'admin')) {
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
            } else if (isMember) {
                // Members can edit content but not settings
                setCanModifyBoard(true);
                setPermissions({ canEditContent: true, canManageSettings: false, canManageAttendance: false });
            } else {
                // View only or no access (depending on visibility, but if they are here they have read access)
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
