'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Divider,
  useTheme,
  IconButton,
} from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import OriginalKanbanBoard, { OriginalKanbanBoardHandle } from '@/components/kanban/OriginalKanbanBoard';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import BoardManagementPanel from '@/components/board/BoardManagementPanel';
import TeamKanbanBoard from '@/components/team/TeamKanbanBoard';
import TeamBoardManagementPanel from '@/components/team/TeamBoardManagementPanel';
import PersonalDashboard from '@/components/dashboard/PersonalDashboard';
import { isSuperuserEmail } from '@/constants/superuser';
import { pb } from '@/lib/pocketbase';

interface Board {
  id: string;
  name: string;
  description: string;
  created_at: string;
  visibility?: string | null;
  owner_id?: string | null;
  user_id?: string | null;
  cardCount?: number;
  settings?: Record<string, unknown> | null;
  boardType: 'standard' | 'team';
  boardAdminId: string | null;
}

export default function HomePage() {
  const theme = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'management' | 'board' | 'team-management' | 'team-board'>('list');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const { user, loading, signOut } = useAuth();
  const boardRef = useRef<OriginalKanbanBoardHandle>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBoardType, setNewBoardType] = useState<'standard' | 'team'>('standard');
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [message, setMessage] = useState('');
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [kpiCount, setKpiCount] = useState(0);
  const [favoriteBoardIds, setFavoriteBoardIds] = useState<Set<string>>(new Set());

  useEffect(() => { setArchivedCount(null); setKpiCount(0); }, [selectedBoard]);

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const superuser = isSuperuserEmail(user.email ?? null);
      // Retrieve role from auth model or users collection if available. 
      // Assuming 'role' might be added to users or simply relying on superuser/admin checks
      const role = String((pb.authStore.model as any)?.role || '').toLowerCase();
      setIsSuperuser(superuser);
      setIsAdmin(superuser || role === 'admin');
    } catch (error) {
      const superuser = isSuperuserEmail(user.email ?? null);
      setIsSuperuser(superuser);
      setIsAdmin(superuser);
    }
  }, [user]);

  const loadBoards = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch without sort to avoid 400 error on '-created'
      const boardsData = await pb.collection('kanban_boards').getFullList();

      const sanitizedBoards = (boardsData ?? []).map((board) => {
        const rawSettings = board.settings && typeof board.settings === 'object' ? (board.settings as Record<string, unknown>) : {};
        const typeRaw = (rawSettings as Record<string, unknown>)['boardType'];
        const boardType = typeof typeRaw === 'string' && typeRaw.toLowerCase() === 'team' ? 'team' : 'standard';
        return {
          ...board,
          created_at: board.created, // Map PB 'created' to 'created_at'
          settings: rawSettings,
          visibility: board.visibility ?? 'public',
          boardType,
          boardAdminId: (board as any).board_admin_id ?? null,
          id: board.id
        } as unknown as Board;
      });

      // Sort client-side
      sanitizedBoards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBoards(sanitizedBoards);
    } catch (error) {
      console.error('DEBUG: Load Boards Error:', error);
      setMessage(`❌ ${t('home.loadError')}`);
    }
  }, [isAdmin, user, t]);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const favs = await pb.collection('board_favorites').getFullList({
        filter: `user_id = "${user.id}"`
      });
      setFavoriteBoardIds(new Set(favs.map(f => f.board_id)));
    } catch (e) {
      // Ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsSuperuser(false); setSelectedBoard(null); setViewMode('list'); return; }
    loadProfile();
    loadBoards();
    loadFavorites();
  }, [user, loadProfile, loadBoards, loadFavorites]);

  const currentUserId = user?.id ?? null;
  const isSelectedBoardAdmin = selectedBoard?.boardAdminId === currentUserId;

  const handleOpenBoardFromDashboard = (boardId: string, cardId?: string, type: 'standard' | 'team' = 'standard') => {
    const board = boards.find(b => b.id === boardId);
    if (board) {
      setSelectedBoard(board);
      if (cardId) setOpenCardId(cardId);
      setViewMode(type === 'team' ? 'team-board' : 'board');
    }
  };

  const standardBoards = useMemo(() => boards.filter((board) => board.boardType === 'standard'), [boards]);
  const teamBoards = useMemo(() => boards.filter((board) => board.boardType === 'team'), [boards]);

  const createBoard = async () => {
    if (!newBoardName.trim() || !user) return; // Allow creation for all logged in users, or check isAdmin if preferred
    // The UI limits the button to isAdmin, so we check here basically implicitly or strictly:
    if (!isAdmin) return;

    try {
      const initialSettings = { boardType: newBoardType };
      const data = await pb.collection('kanban_boards').create({
        name: newBoardName.trim(),
        description: newBoardDescription.trim(),
        owner_id: user.id,
        board_admin_id: user.id,
        settings: initialSettings,
        visibility: 'public' // Default to public
      });
      if (data) { loadBoards(); }
      setCreateDialogOpen(false); setNewBoardName(''); setNewBoardDescription(''); setMessage(`✅ ${t('home.boardCreated')}`); setTimeout(() => setMessage(''), 3000);
    } catch (error) { setMessage(`❌ ${t('home.boardCreateError')}`); }
  };

  const deleteBoard = async () => {
    if (!boardToDelete || !isAdmin) return;
    try {
      await pb.collection('kanban_boards').delete(boardToDelete.id);
      setBoards((prev) => prev.filter(b => b.id !== boardToDelete.id));
      setDeleteDialogOpen(false); setBoardToDelete(null); setMessage(`✅ ${t('home.boardDeleted')}`); setTimeout(() => setMessage(''), 3000);
    } catch (error) { setMessage(`❌ ${t('home.boardDeleteError')}`); }
  };

  const toggleFavorite = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!user) return;

    const isFav = favoriteBoardIds.has(boardId);
    try {
      if (isFav) {
        // Look up record
        const record = await pb.collection('board_favorites').getFirstListItem(`user_id="${user.id}" && board_id="${boardId}"`);
        await pb.collection('board_favorites').delete(record.id);
        const newFavs = new Set(favoriteBoardIds);
        newFavs.delete(boardId);
        setFavoriteBoardIds(newFavs);
      } else {
        await pb.collection('board_favorites').create({
          user_id: user.id,
          board_id: boardId
        });
        const newFavs = new Set(favoriteBoardIds);
        newFavs.add(boardId);
        setFavoriteBoardIds(newFavs);
      }
    } catch (e) {
      console.error('Favorite toggle failed', e);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Typography variant="h6">🔄 {t('home.loading')}</Typography></Box>;
  if (!user) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Typography variant="h6">🔄 {t('home.redirecting')}</Typography></Box>;
  }

  // --- Views für Board & Management ---
  if (selectedBoard && selectedBoard.boardType === 'standard' && viewMode === 'board') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" onClick={() => { setViewMode('management'); setOpenCardId(null); }}>← {t('header.backToManagement')}</Button>
            <Typography variant="h6">{selectedBoard.name || 'Board'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2">👋 {user.email}</Typography>
            <Button variant="outlined" onClick={signOut} color="error">🚪</Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <OriginalKanbanBoard ref={boardRef} boardId={selectedBoard.id} onArchiveCountChange={setArchivedCount} onKpiCountChange={setKpiCount} highlightCardId={openCardId} onExit={() => { setViewMode('list'); setOpenCardId(null); }} />
        </Box>
      </Box>
    );
  }
  if (selectedBoard && selectedBoard.boardType === 'team' && viewMode === 'team-board') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" onClick={() => setViewMode('team-management')}>← {t('header.backToManagement')}</Button>
            <Typography variant="h6">{selectedBoard.name || t('home.teamBoard')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2">👋 {user.email}</Typography>
            <Button variant="outlined" onClick={signOut} color="error">🚪</Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TeamKanbanBoard boardId={selectedBoard.id} highlightCardId={openCardId} onExit={() => { setViewMode('list'); setOpenCardId(null); }} />
        </Box>
      </Box>
    );
  }
  if (selectedBoard && viewMode === 'management') {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Button variant="outlined" onClick={() => { setSelectedBoard(null); setViewMode('list'); }}>← {t('header.backToOverview')}</Button>
          <Button variant="contained" onClick={() => setViewMode('board')}>📋 {t('header.toBoard')}</Button>
        </Box>
        <BoardManagementPanel boardId={selectedBoard.id} canEdit={isAdmin || isSelectedBoardAdmin} memberCanSee={true} />
      </Container>
    );
  }
  if (selectedBoard && viewMode === 'team-management') {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Button variant="outlined" onClick={() => { setSelectedBoard(null); setViewMode('list'); }}>← {t('header.backToOverview')}</Button>
          <Button variant="contained" onClick={() => setViewMode('team-board')}>📋 {t('header.toBoard')}</Button>
        </Box>
        <TeamBoardManagementPanel boardId={selectedBoard.id} canEdit={isAdmin || isSelectedBoardAdmin} memberCanSee={true} />
      </Container>
    );
  }

  // --- STYLING FÜR HORIZONTAL SCROLL ---
  // Flex-Wrap auf 'nowrap' zwingt die Elemente in eine Zeile.
  const scrollContainerSx = {
    display: 'flex',
    flexWrap: 'nowrap',  // WICHTIG: Verhindert Umbruch
    gap: 3,
    overflowX: 'auto',   // Scrollbar erlauben
    pb: 2,               // Platz für Scrollbar
    scrollSnapType: 'x mandatory',
    '&::-webkit-scrollbar': { height: 8 },
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4 },
  };

  const itemSx = {
    flex: '0 0 auto',    // WICHTIG: Verhindert Schrumpfen
    width: { xs: '85vw', sm: '350px' },
    scrollSnapAlign: 'start'
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}
            sx={{ minWidth: 40, fontWeight: 700 }}
          >
            {language.toUpperCase()}
          </Button>
          {isAdmin && <Button variant="outlined" onClick={() => (window.location.href = '/admin')}>{t('header.admin')}</Button>}
          <Typography variant="body2">👋 {user.email}</Typography>
          <Button variant="outlined" onClick={signOut} color="error">{t('header.logout')}</Button>
        </Box>
      </Box>

      {message && <Alert severity={message.startsWith('✅') ? 'success' : 'error'} sx={{ mb: 3 }}>{message}</Alert>}

      <PersonalDashboard onOpenBoard={handleOpenBoardFromDashboard} />

      <Divider sx={{ my: 6 }} />

      {/* --- FAVORITE BOARDS --- */}
      {favoriteBoardIds.size > 0 && (
        <>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star color="warning" /> {t('home.favorites')}
          </Typography>
          <Box sx={scrollContainerSx}>
            {boards.filter(b => favoriteBoardIds.has(b.id)).map((board) => (
              <Box key={board.id} sx={itemSx}>
                <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}>
                  <CardContent sx={{ position: 'relative' }}>
                    <IconButton
                      onClick={(e) => toggleFavorite(e, board.id)}
                      sx={{ position: 'absolute', top: 8, right: 8, color: 'warning.main' }}
                    >
                      <Star />
                    </IconButton>
                    <Typography variant="h6" noWrap title={board.name} sx={{ pr: 4 }}>{board.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {board.description || t('home.noDescription')}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode(board.boardType === 'team' ? 'team-management' : 'management'); }}>{t('home.open')}</Button>
                  </CardActions>
                </Card>
              </Box>
            ))}
          </Box>
          <Divider sx={{ my: 6 }} />
        </>
      )}

      {/* --- PROJEKTBOARDS --- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>{t('home.projectBoards')}</Typography>
      <Box sx={scrollContainerSx}>
        {isAdmin && (
          <Box sx={itemSx}>
            <Card sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,0,0,0.02)' } }} onClick={() => { setNewBoardType('standard'); setCreateDialogOpen(true); }}>
              <Typography variant="h6" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>+</span> {t('home.newBoard')}
              </Typography>
            </Card>
          </Box>
        )}
        {standardBoards.map((board) => (
          <Box key={board.id} sx={itemSx}>
            <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}>
              <CardContent sx={{ position: 'relative' }}>
                <Typography variant="h6" noWrap title={board.name} sx={{ pr: 4 }}>{board.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {board.description || t('home.noDescription')}
                </Typography>
                <IconButton
                  onClick={(e) => toggleFavorite(e, board.id)}
                  sx={{ position: 'absolute', top: 8, right: 8, color: favoriteBoardIds.has(board.id) ? 'warning.main' : 'action.disabled' }}
                >
                  {favoriteBoardIds.has(board.id) ? <Star /> : <StarBorder />}
                </IconButton>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode('management'); }}>{t('home.open')}</Button>
                {isAdmin && <Button size="small" color="error" onClick={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}>{t('home.delete')}</Button>}
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>

      {/* --- TEAMBOARDS --- */}
      <Typography variant="h5" sx={{ mt: 5, mb: 2, fontWeight: 600 }}>{t('home.teamBoards')}</Typography>
      <Box sx={scrollContainerSx}>
        {isAdmin && (
          <Box sx={itemSx}>
            <Card sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,0,0,0.02)' } }} onClick={() => { setNewBoardType('team'); setCreateDialogOpen(true); }}>
              <Typography variant="h6" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>+</span> {t('home.newTeamBoard')}
              </Typography>
            </Card>
          </Box>
        )}
        {teamBoards.map((board) => (
          <Box key={board.id} sx={itemSx}>
            <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}>
              <CardContent sx={{ position: 'relative' }}>
                <Typography variant="h6" noWrap title={board.name} sx={{ pr: 4 }}>{board.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {board.description || t('home.noDescription')}
                </Typography>
                <IconButton
                  onClick={(e) => toggleFavorite(e, board.id)}
                  sx={{ position: 'absolute', top: 8, right: 8, color: favoriteBoardIds.has(board.id) ? 'warning.main' : 'action.disabled' }}
                >
                  {favoriteBoardIds.has(board.id) ? <Star /> : <StarBorder />}
                </IconButton>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode('team-management'); }}>{t('home.open')}</Button>
                {isAdmin && <Button size="small" color="error" onClick={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}>{t('home.delete')}</Button>}
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Dialogs */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>{t('home.createBoard')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label={t('home.name')} fullWidth value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('home.type')}</InputLabel>
            <Select value={newBoardType} label={t('home.type')} onChange={(e) => setNewBoardType(e.target.value as any)}>
              <MenuItem value="standard">{t('home.projectBoard')}</MenuItem>
              <MenuItem value="team">{t('home.teamBoard')}</MenuItem>
            </Select>
          </FormControl>
          <TextField margin="dense" label={t('home.description')} fullWidth multiline rows={3} value={newBoardDescription} onChange={(e) => setNewBoardDescription(e.target.value)} />
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