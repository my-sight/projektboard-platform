'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Chip,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    CircularProgress,
    alpha,
    useTheme
} from '@mui/material';
import {
    SpaceDashboard,
    ViewColumn,
    Groups,
    Person
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { isSuperuserEmail } from '@/constants/superuser';

export default function BoardSwitcherBadge() {
    const router = useRouter();
    const theme = useTheme();
    const { user, profile } = useAuth();
    const { t } = useLanguage();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [boards, setBoards] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        loadBoards();
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const loadBoards = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const isSuper = isSuperuserEmail(user.email || '');

            // Get boards where user is owner or board_admin
            let query = supabase.from('kanban_boards').select('*');

            const { data: allBoards, error } = await query;
            if (error) throw error;

            if (isSuper) {
                setBoards(allBoards || []);
            } else {
                // Find boards where user is member
                const { data: memberships } = await supabase
                    .from('board_members')
                    .select('board_id')
                    .eq('profile_id', user.id);

                const memberBoardIds = new Set((memberships || []).map(m => m.board_id));

                const myBoards = (allBoards || []).filter(b =>
                    b.owner_id === user.id ||
                    b.board_admin_id === user.id ||
                    memberBoardIds.has(b.id)
                );
                setBoards(myBoards);
            }
        } catch (e) {
            console.error('Error loading switcher boards:', e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const handleSwitch = (boardId: string) => {
        handleClose();
        router.push(`/boards/${boardId}`);
    };

    const displayName = profile?.alias || profile?.full_name || user?.email || '';

    return (
        <Box>
            <Chip
                avatar={profile?.avatar_url ? (
                    <Avatar src={profile.avatar_url} sx={{ width: 24, height: 24 }} />
                ) : (
                    <Box component={Person} sx={{ color: 'inherit !important', display: 'flex' }} />
                )}
                label={displayName}
                variant="outlined"
                onClick={handleClick}
                sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    fontWeight: 600,
                    borderColor: 'primary.main',
                    color: 'primary.main'
                }}
            />

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        width: 320,
                        maxHeight: 400,
                        mt: 1,
                        boxShadow: theme.shadows[3],
                        borderRadius: 2
                    }
                }}
            >
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                        Meine Boards
                    </Typography>
                </Box>
                <Divider />

                {loading && boards.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <Box sx={{ py: 0.5 }}>
                        <MenuItem onClick={() => { handleClose(); router.push('/'); }} sx={{ py: 1 }}>
                            <SpaceDashboard sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={500}>Dashboard</Typography>
                        </MenuItem>

                        <Divider sx={{ my: 0.5 }} />

                        {boards.length === 0 && !loading && (
                            <Box sx={{ px: 2, py: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Keine weiteren Boards gefunden.
                                </Typography>
                            </Box>
                        )}

                        {boards.map((b) => {
                            const isTeam = b.settings?.boardType === 'team';
                            return (
                                <MenuItem
                                    key={b.id}
                                    onClick={() => handleSwitch(b.id)}
                                    sx={{ py: 1 }}
                                >
                                    {isTeam ? (
                                        <Groups sx={{ mr: 1.5, fontSize: 20, color: 'secondary.main' }} />
                                    ) : (
                                        <ViewColumn sx={{ mr: 1.5, fontSize: 20, color: 'primary.main' }} />
                                    )}
                                    <Box>
                                        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 220 }}>
                                            {b.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {isTeam ? 'Flow Board' : 'Projekt Board'}
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </Box>
                )}
            </Menu>
        </Box>
    );
}
