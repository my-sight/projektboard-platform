'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Typography,
  Divider,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import { Star, StarBorder, Add } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import PersonalDashboard from '@/components/dashboard/PersonalDashboard';
import { supabase } from '@/lib/supabaseClient';
import { isSuperuserEmail } from '@/constants/superuser';

interface Board {
  id: string;
  name: string;
  description: string;
  created_at: string;
  owner_id: string;
  settings?: any;
  boardType?: 'standard' | 'team';
}

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [boards, setBoards] = useState<Board[]>([]);
  // Auth / Role State
  const [isAdmin, setIsAdmin] = useState(false);

  // UI State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [newBoardType, setNewBoardType] = useState<'standard' | 'team'>('standard');
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [favoriteBoardIds, setFavoriteBoardIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  // Styles
  const scrollContainerSx = {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 3,
    overflowX: 'auto',
    pb: 2,
    scrollSnapType: 'x mandatory',
    '&::-webkit-scrollbar': { height: 8 },
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4 },
  };

  const itemSx = {
    flex: '0 0 auto',
    width: { xs: '85vw', sm: '350px' },
    scrollSnapAlign: 'start'
  };

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login'; // Or router.push
    }
  }, [loading, user]);

  useEffect(() => {
    if (user) {
      loadBoards();
      loadFavorites();
      checkRoles();
    }
  }, [user]);

  const checkRoles = async () => {
    if (!user) return;
    const isSuper = isSuperuserEmail(user.email);
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    setIsAdmin(isSuper || data?.role === 'admin');
  };

  const loadBoards = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('kanban_boards').select('*');
      if (data) {
        const mapped = data.map(b => ({
          ...b,
          boardType: b.settings?.boardType === 'team' ? 'team' : 'standard'
        }));
        // Sort by Created At Desc
        mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setBoards(mapped);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadFavorites = async () => {
    if (!user) return;
    const { data } = await supabase.from('board_favorites').select('board_id').eq('user_id', user.id);
    if (data) {
      setFavoriteBoardIds(new Set(data.map(f => f.board_id)));
    }
  };

  const createBoard = async () => {
    if (!newBoardName.trim() || !user || !isAdmin) return;
    try {
      const { error } = await supabase.from('kanban_boards').insert({
        name: newBoardName.trim(),
        description: newBoardDescription.trim(),
        owner_id: user.id,
        board_admin_id: user.id,
        settings: { boardType: newBoardType },
        visibility: 'public'
      });
      if (error) throw error;
      setMessage(`✅ ${t('home.boardCreated')}`);
      setCreateDialogOpen(false);
      setNewBoardName('');
      setNewBoardDescription('');
      loadBoards();
      setTimeout(() => setMessage(''), 3000);
    } catch (e) { setMessage('❌ Error creating board'); }
  };

  const deleteBoard = async () => {
    if (!boardToDelete || !isAdmin) return;
    try {
      await supabase.from('kanban_boards').delete().eq('id', boardToDelete.id);
      setBoards(boards.filter(b => b.id !== boardToDelete.id));
      setDeleteDialogOpen(false);
      setMessage(`✅ ${t('home.boardDeleted')}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (e) { setMessage('❌ Error deleting'); }
  };

  const toggleFavorite = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!user) return;
    const isFav = favoriteBoardIds.has(boardId);
    if (isFav) {
      await supabase.from('board_favorites').delete().eq('user_id', user.id).eq('board_id', boardId);
      setFavoriteBoardIds(prev => { const n = new Set(prev); n.delete(boardId); return n; });
    } else {
      await supabase.from('board_favorites').insert({ user_id: user.id, board_id: boardId });
      setFavoriteBoardIds(prev => { const n = new Set(prev); n.add(boardId); return n; });
    }
  };

  const standardBoards = useMemo(() => boards.filter(b => b.boardType === 'standard'), [boards]);
  const teamBoards = useMemo(() => boards.filter(b => b.boardType === 'team'), [boards]);

  // Derived Navigation Handlers
  const handleOpenBoard = (boardId: string) => router.push(`/boards/${boardId}`);
  const handleOpenSettings = (e: React.MouseEvent, board: Board) => {
    e.stopPropagation();
    router.push(`/boards/${board.id}/settings`);
  };

  if (loading || !user) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Typography>Loading...</Typography></Box>;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="outlined" onClick={() => setLanguage(language === 'de' ? 'en' : 'de')} sx={{ minWidth: 40, fontWeight: 700 }}>
            {language.toUpperCase()}
          </Button>
          {isAdmin && <Button variant="outlined" onClick={() => window.location.href = '/admin'}>{t('header.admin')}</Button>}
          <Typography variant="body2">👋 {profile?.full_name || user.email}</Typography>
          <Button variant="outlined" onClick={signOut} color="error">{t('header.logout')}</Button>
        </Box>
      </Box>

      {message && <Alert severity={message.includes('❌') ? 'error' : 'success'} sx={{ mb: 2 }}>{message}</Alert>}

      {/* Personal Dashboard Widget */}
      {/* We need to update PersonalDashboard to accept a simple onOpenBoard which works with ID */}
      <PersonalDashboard onOpenBoard={(boardId) => router.push(`/boards/${boardId}`)} />

      <Divider sx={{ my: 6 }} />

      {/* Favorites */}
      {favoriteBoardIds.size > 0 && (
        <>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star color="warning" /> {t('home.favorites')}
          </Typography>
          <Box sx={scrollContainerSx}>
            {boards.filter(b => favoriteBoardIds.has(b.id)).map(board => (
              <Box key={board.id} sx={itemSx}>
                <BoardCard
                  board={board}
                  isFav={true}
                  isAdmin={isAdmin}
                  onOpen={() => handleOpenBoard(board.id)}
                  onSettings={(e) => handleOpenSettings(e, board)}
                  onDelete={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}
                  onToggleFav={toggleFavorite}
                  t={t}
                />
              </Box>
            ))}
          </Box>
          <Divider sx={{ my: 6 }} />
        </>
      )}

      {/* Standard Boards */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>{t('home.projectBoards')}</Typography>
      <Box sx={scrollContainerSx}>
        {isAdmin && (
          <Box sx={itemSx}>
            <Card
              sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,0,0,0.02)' } }}
              onClick={() => { setNewBoardType('standard'); setCreateDialogOpen(true); }}
            >
              <Typography variant="h6" color="text.secondary"><span>+</span> {t('home.newBoard')}</Typography>
            </Card>
          </Box>
        )}
        {standardBoards.map(board => (
          <Box key={board.id} sx={itemSx}>
            <BoardCard
              board={board}
              isFav={favoriteBoardIds.has(board.id)}
              isAdmin={isAdmin}
              onOpen={() => handleOpenBoard(board.id)}
              onSettings={(e) => handleOpenSettings(e, board)}
              onDelete={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}
              onToggleFav={toggleFavorite}
              t={t}
            />
          </Box>
        ))}
      </Box>

      {/* Team Boards */}
      <Typography variant="h5" sx={{ mt: 5, mb: 2, fontWeight: 600 }}>{t('home.teamBoards')}</Typography>
      <Box sx={scrollContainerSx}>
        {isAdmin && (
          <Box sx={itemSx}>
            <Card
              sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,0,0,0.02)' } }}
              onClick={() => { setNewBoardType('team'); setCreateDialogOpen(true); }}
            >
              <Typography variant="h6" color="text.secondary"><span>+</span> {t('home.newTeamBoard')}</Typography>
            </Card>
          </Box>
        )}
        {teamBoards.map(board => (
          <Box key={board.id} sx={itemSx}>
            <BoardCard
              board={board}
              isFav={favoriteBoardIds.has(board.id)}
              isAdmin={isAdmin}
              onOpen={() => handleOpenBoard(board.id)}
              onSettings={(e) => handleOpenSettings(e, board)}
              onDelete={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}
              onToggleFav={toggleFavorite}
              t={t}
            />
          </Box>
        ))}
      </Box>

      {/* Dialogs */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>{t('home.createBoard')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label={t('home.name')} fullWidth value={newBoardName} onChange={e => setNewBoardName(e.target.value)} />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('home.type')}</InputLabel>
            <Select value={newBoardType} label={t('home.type')} onChange={e => setNewBoardType(e.target.value as any)}>
              <MenuItem value="standard">{t('home.projectBoard')}</MenuItem>
              <MenuItem value="team">{t('home.teamBoard')}</MenuItem>
            </Select>
          </FormControl>
          <TextField margin="dense" label={t('home.description')} fullWidth multiline rows={3} value={newBoardDescription} onChange={e => setNewBoardDescription(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>{t('home.cancel')}</Button>
          <Button onClick={createBoard} variant="contained">{t('home.create')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('home.deleteBoardTitle')}</DialogTitle>
        <DialogContent><Typography>{t('home.deleteBoardConfirm').replace('{name}', boardToDelete?.name || '')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('home.cancel')}</Button>
          <Button onClick={deleteBoard} color="error" variant="contained">{t('home.delete')}</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}

// Sub-component for clean rendering
function BoardCard({ board, isFav, isAdmin, onOpen, onSettings, onDelete, onToggleFav, t }: any) {
  return (
    <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}>
      <CardContent sx={{ position: 'relative' }}>
        <IconButton
          onClick={(e) => onToggleFav(e, board.id)}
          sx={{ position: 'absolute', top: 8, right: 8, color: isFav ? 'warning.main' : 'action.disabled' }}
        >
          {isFav ? <Star /> : <StarBorder />}
        </IconButton>
        <Typography variant="h6" noWrap title={board.name} sx={{ pr: 4 }}>{board.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {board.description || t('home.noDescription')}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button size="small" variant="contained" onClick={onOpen}>{t('home.open')}</Button>
        <Box>
          <Button size="small" onClick={onSettings}>⚙️</Button>
          {isAdmin && <Button size="small" color="error" onClick={onDelete}>{t('home.delete')}</Button>}
        </Box>
      </CardActions>
    </Card>
  );
}