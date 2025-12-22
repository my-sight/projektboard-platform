'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Button, Typography, CircularProgress, Container } from '@mui/material';
import { SpaceDashboard, RocketLaunch } from '@mui/icons-material';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import BoardManagementPanel from '@/components/board/BoardManagementPanel';
import TeamBoardManagementPanel from '@/components/team/TeamBoardManagementPanel';
import { isSuperuserEmail } from '@/constants/superuser';

interface Board {
    id: string;
    name: string;
    boardType: 'standard' | 'team';
    board_admin_id: string | null;
}

export default function BoardSettingsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const [board, setBoard] = useState<Board | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const loadBoard = async () => {
            if (!id || !user) return;
            try {
                const { data, error } = await supabase
                    .from('kanban_boards')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                const rawSettings = data.settings as Record<string, any> || {};
                const boardType = rawSettings.boardType === 'team' ? 'team' : 'standard';

                setBoard({
                    ...data,
                    boardType
                });

                // Determine permissions
                const isSuperuser = isSuperuserEmail(user.email);
                const isContextAdmin = profile?.role === 'admin';
                const isBoardAdmin = data.board_admin_id === user.id;

                setIsAdmin(isSuperuser || isContextAdmin || isBoardAdmin);

            } catch (error) {
                console.error('Error loading board:', error);
            } finally {
                setLoading(false);
            }
        };

        loadBoard();
    }, [id, user, profile]);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    }

    if (!board) {
        return <Typography variant="h5" align="center" sx={{ mt: 4 }}>Board not found</Typography>;
    }

    const handleBackToBoard = () => router.push(`/boards/${id}`);
    const handleBackToDashboard = () => router.push('/');

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Button variant="outlined" onClick={handleBackToDashboard} startIcon={<SpaceDashboard />}>Dashboard</Button>
                <Typography variant="h5">Boardmanagement - {board.name}</Typography>
                <Button variant="outlined" onClick={handleBackToBoard} startIcon={<RocketLaunch />}>{t('header.toBoard') || 'Zum Board'}</Button>
            </Box>

            {board.boardType === 'team' ? (
                <TeamBoardManagementPanel
                    boardId={board.id}
                    canEdit={isAdmin}
                    memberCanSee={true}
                />
            ) : (
                <BoardManagementPanel
                    boardId={board.id}
                    canEdit={isAdmin}
                    memberCanSee={true}
                />
            )}
        </Container>
    );
}
