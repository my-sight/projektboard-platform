'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Button, Typography, CircularProgress, useTheme } from '@mui/material';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import OriginalKanbanBoard, { OriginalKanbanBoardHandle } from '@/components/kanban/OriginalKanbanBoard';
import TeamKanbanBoard from '@/components/team/TeamKanbanBoard';

interface Board {
    id: string;
    name: string;
    boardType: 'standard' | 'team';
    owner_id: string;
}

export default function BoardPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, profile, refreshProfile, signOut } = useAuth();
    const { t } = useLanguage();
    const [board, setBoard] = useState<Board | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const boardRef = useRef<OriginalKanbanBoardHandle>(null);

    // KPI Hooks (only relevant for standard board visualization in header, optional)
    const [archivedCount, setArchivedCount] = useState<number | null>(null);
    const [kpiCount, setKpiCount] = useState(0);

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

                // Parse settings to determine type
                const rawSettings = data.settings as Record<string, any> || {};
                const boardType = rawSettings.boardType === 'team' ? 'team' : 'standard';

                setBoard({
                    ...data,
                    boardType
                });
            } catch (error) {
                console.error('Error loading board:', error);
                setMessage('Board not found or access denied.');
            } finally {
                setLoading(false);
            }
        };

        loadBoard();
    }, [id, user]);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    }

    if (!board) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="error" gutterBottom>{message || 'Board not found'}</Typography>
                <Button variant="contained" onClick={() => router.push('/')}>Go to Dashboard</Button>
            </Box>
        );
    }

    // Header Logic
    const handleBack = () => router.push('/');
    const handleSettings = () => router.push(`/boards/${id}/settings`);

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Navigation Header */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button variant="outlined" onClick={handleSettings}>
                        ⚙️ {t('header.management') || 'Management'}
                    </Button>
                    <Button variant="outlined" onClick={handleBack}>
                        🏠 Dashboard
                    </Button>
                    <Typography variant="h6">{board.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="body2">👋 {profile?.full_name || user?.email}</Typography>
                    <Button variant="outlined" onClick={signOut} color="error">🚪</Button>
                </Box>
            </Box>

            {/* Board Content */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                {board.boardType === 'team' ? (
                    <TeamKanbanBoard
                        boardId={board.id}
                        onExit={handleBack}
                    // highlightCardId can be added later by reading query params if needed
                    />
                ) : (
                    <OriginalKanbanBoard
                        ref={boardRef}
                        boardId={board.id}
                        onArchiveCountChange={setArchivedCount}
                        onKpiCountChange={setKpiCount}
                        onExit={handleBack}
                    />
                )}
            </Box>
        </Box>
    );
}
