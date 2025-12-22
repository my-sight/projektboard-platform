'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Chip,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Star,
  StarBorder,
  Add,
  DashboardCustomize,
  Delete,
  RocketLaunch,
  Assignment, // Remove if unused, or keep if used elsewhere
  Person,
  Logout,
  AdminPanelSettings,
  ViewColumn,
  Groups,
  LightMode,
  DarkMode
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemConfig } from '@/contexts/SystemConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import PersonalDashboard from '@/components/dashboard/PersonalDashboard';
import UserSettingsDialog from '@/components/dashboard/UserSettingsDialog';
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

export default function DashboardClient() {
  const router = useRouter();
  const theme = useTheme();
  const { user, profile, refreshProfile, signOut, loading: authLoading, visibilityCounter } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { config, toggleMode } = useSystemConfig();

  const [boards, setBoards] = useState<Board[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // UI State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [newBoardType, setNewBoardType] = useState<'standard' | 'team'>('standard');
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [favoriteBoardIds, setFavoriteBoardIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);

  // --- DATA LOADING ---
  const loadDashboardData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    try {
      const fetchData = async () => {
        // 1. Check Roles
        const isSuper = isSuperuserEmail(user.email);
        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setIsAdmin(isSuper || (profileData?.role && profileData.role.toLowerCase() === 'admin'));

        // 2. Load Boards
        const { data: boardData } = await supabase.from('kanban_boards').select('*');
        if (boardData) {
          const mapped = boardData.map(b => ({
            ...b,
            boardType: b.settings?.boardType === 'team' ? 'team' : 'standard'
          }));
          mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setBoards(mapped);
        }

        // 3. Load Favorites
        const { data: favData } = await supabase.from('board_favorites').select('board_id').eq('user_id', user.id);
        if (favData) {
          setFavoriteBoardIds(new Set(favData.map(f => f.board_id)));
        }
      };

      // Race against a timeout to prevent infinite loading
      await Promise.race([
        fetchData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loading dashboard')), 8000))
      ]);

    } catch (e) {
      console.error('Error loading dashboard data:', e);
      // Optional: setMessage('Fehler beim Laden der Daten');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  // --- EFFECTS ---

  // Initial Load & Auth Check
  useEffect(() => {
    // If we have a user, load data immediately, don't wait for authLoading to finish (it might be background revalidating)
    if (user) {
      loadDashboardData();
    } else if (!authLoading && !user) {
      // Only redirect if we definitely know there is no user and loading is done
      console.log('[DashboardClient] No user. Redirecting to /login');
      router.push('/login');
    }
  }, [authLoading, user, loadDashboardData, router]);

  // Handle visibility refresh via centralized counter from AuthContext
  useEffect(() => {
    if (visibilityCounter > 0 && user) {
      console.log('[DashboardClient] Visibility refresh triggered via AuthContext');
      loadDashboardData();
    }
  }, [visibilityCounter, user, loadDashboardData]);


  // Loading State Logic:
  // Only show generic loader if:
  // 1. Auth is truly loading AND we have no user yet
  // 2. OR Data is loading AND we have no data yet
  const showLoader = (authLoading && !user) || (loadingData && boards.length === 0);

  const favoriteBoards = useMemo(() => boards.filter(b => favoriteBoardIds.has(b.id)), [boards, favoriteBoardIds]);
  const standardBoards = useMemo(() => boards.filter(b => b.boardType === 'standard' && !favoriteBoardIds.has(b.id)), [boards, favoriteBoardIds]);
  const teamBoards = useMemo(() => boards.filter(b => b.boardType === 'team' && !favoriteBoardIds.has(b.id)), [boards, favoriteBoardIds]);

  // --- ACTIONS ---
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
      loadDashboardData();
      setTimeout(() => setMessage(''), 3000);
    } catch (e) { setMessage('❌ Error creating board'); }
  };

  const deleteBoard = async () => {
    if (!boardToDelete || !isAdmin || !user?.email) return;
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword
      });

      if (authError) {
        setMessage('❌ ' + (t('errors.wrongPassword') || 'Wrong Password'));
        return;
      }

      await supabase.from('kanban_boards').delete().eq('id', boardToDelete.id);
      setBoards(boards.filter(b => b.id !== boardToDelete.id));
      setDeleteDialogOpen(false);
      setDeletePassword('');
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

  const handleOpenBoard = (boardId: string) => router.push(`/boards/${boardId}`);
  const handleOpenSettings = (e: React.MouseEvent, board: Board) => {
    e.stopPropagation();
    router.push(`/boards/${board.id}/settings`);
  };

  if (showLoader) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Typography variant="h6" color="text.secondary">Lade Dashboard...</Typography>
    </Box>;
  }

  if (!user && !authLoading) return null;

  // Render Helper
  const renderBoardCard = (board: Board) => (
    <Grid item xs={12} sm={6} md={4} lg={3} key={board.id}>
      <Card
        variant="outlined"
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: board.boardType === 'team' ? alpha(theme.palette.secondary.main, 0.03) : 'background.paper',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 4,
            cursor: 'pointer',
            borderColor: 'primary.main'
          }
        }}
        onClick={() => handleOpenBoard(board.id)}
      >
        <CardContent sx={{ flexGrow: 1, p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
            <Typography variant="h6" fontWeight={600} noWrap title={board.name} sx={{ fontSize: '1rem' }}>
              {board.name}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => toggleFavorite(e, board.id)}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              {favoriteBoardIds.has(board.id) ? <Star color="warning" fontSize="small" /> : <StarBorder fontSize="small" />}
            </IconButton>
          </Box>
          <Chip
            label={board.boardType === 'team' ? t('home.teamBoard') : t('home.projectBoard')}
            size="small"
            sx={{
              mb: 1,
              height: 20,
              fontSize: '0.7rem',
              backgroundColor: alpha(theme.palette.secondary.main, 0.1)
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: '0.8rem',
            lineHeight: 1.3
          }}>
            {board.description || 'Keine Beschreibung'}
          </Typography>
        </CardContent>
        <Divider />
        <CardActions sx={{ justifyContent: 'space-between', px: 1.5, py: 0.5 }}>
          {/* Left: Delete */}
          {isAdmin ? (
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setBoardToDelete(board); setDeleteDialogOpen(true); }} title={t('delete')}>
              <Delete fontSize="small" />
            </IconButton>
          ) : <Box />}

          {/* Center: Settings */}

          <IconButton size="small" onClick={(e) => handleOpenSettings(e, board)} title={t('settings')}>
            <DashboardCustomize fontSize="small" />
          </IconButton>

          {/* Right: Open */}
          <IconButton color="primary" onClick={() => handleOpenBoard(board.id)} title={t('open')}>
            <RocketLaunch fontSize="small" />
          </IconButton>
        </CardActions>
      </Card>
    </Grid>
  );

  // --- RENDER ---
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header Bar */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 4,
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" fontWeight={700} color="primary">
            {config.appName || 'ProjektBoard'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button variant="outlined" size="small" onClick={() => {
            const nextLang: Record<string, 'de' | 'en' | 'pl'> = {
              'de': 'en',
              'en': 'pl',
              'pl': 'de'
            };
            setLanguage(nextLang[language] || 'de');
          }}>
            {language.toUpperCase()}
          </Button>
          <IconButton onClick={toggleMode} color="inherit">
            {theme.palette.mode === 'dark' ? <LightMode /> : <DarkMode />}
          </IconButton>
          {isAdmin && (
            <Tooltip title="Administration">
              <IconButton onClick={() => router.push('/admin')} color="primary">
                <AdminPanelSettings />
              </IconButton>
            </Tooltip>
          )}
          <Chip
            avatar={profile?.avatar_url ? (
              <Avatar src={profile.avatar_url} sx={{ width: 24, height: 24 }} />
            ) : (
              <Box component={Person} sx={{ color: 'inherit !important' }} />
            )}
            label={profile?.alias || profile?.full_name || user?.email || ''}
            variant="outlined"
            onClick={() => setUserSettingsOpen(true)}
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
          />
          <Tooltip title={t('header.logout')}>
            <IconButton onClick={signOut} color="error">
              <Logout />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {message && <Alert severity={message.includes('❌') ? 'error' : 'success'} sx={{ mb: 3 }}>{message}</Alert>}

      {/* Personal Dashboard */}
      <Box sx={{ mb: 6 }}>
        <PersonalDashboard onOpenBoard={(boardId, cardId) => {
          const url = `/boards/${boardId}${cardId ? `?cardId=${cardId}` : ''}`;
          router.push(url);
        }} />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Favorites Section */}
      {favoriteBoards.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Star color="warning" /> {t('home.favorites')}
          </Typography>
          <Grid container spacing={3}>
            {favoriteBoards.map(renderBoardCard)}
          </Grid>
          <Divider sx={{ my: 4 }} />
        </Box>
      )}


      {/* Standard Boards Section (Kanban Boards) */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewColumn color="secondary" /> {t('home.projectBoards')}
          </Typography>
          {isAdmin && (
            <Button startIcon={<Add />} variant="outlined" color="primary" onClick={() => { setNewBoardType('standard'); setCreateDialogOpen(true); }}>
              {t('home.newBoard')}
            </Button>
          )}
        </Box>

        <Grid container spacing={3}>
          {standardBoards.map(renderBoardCard)}
          {standardBoards.length === 0 && <Grid item xs={12}><Typography color="text.secondary">{t('home.noDescription')}</Typography></Grid>}
        </Grid>
      </Box>

      {/* Team Boards Section (Flow Boards) */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Groups color="secondary" /> {t('home.teamBoards')}
          </Typography>
          {isAdmin && (
            <Button startIcon={<Add />} variant="outlined" color="primary" onClick={() => { setNewBoardType('team'); setCreateDialogOpen(true); }}>
              {t('home.newBoard')}
            </Button>
          )}
        </Box>

        <Grid container spacing={3}>
          {teamBoards.map(renderBoardCard)}
          {teamBoards.length === 0 && <Grid item xs={12}><Typography color="text.secondary">{t('home.noDescription')}</Typography></Grid>}
        </Grid>
      </Box>

      {/* Dialogs */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>{t('home.newBoard')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label={t('home.boardName')} fullWidth value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
          <TextField margin="dense" label={t('home.boardDescription')} fullWidth multiline rows={3} value={newBoardDescription} onChange={(e) => setNewBoardDescription(e.target.value)} />
          <FormControl fullWidth margin="dense">
            <InputLabel>Typ</InputLabel>
            <Select value={newBoardType} label="Typ" onChange={(e) => setNewBoardType(e.target.value as any)}>
              <MenuItem value="standard">Standard (Projekt)</MenuItem>
              <MenuItem value="team">Team (Backlog/Flow)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={createBoard} variant="contained">{t('create')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('home.deleteBoard')}</DialogTitle>
        <DialogContent>
          <Typography>{t('home.deleteConfirm')}</Typography>
          <TextField margin="dense" label={t('form.password')} type="password" fullWidth value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={deleteBoard} color="error" variant="contained">{t('delete')}</Button>
        </DialogActions>
      </Dialog>

      <UserSettingsDialog
        open={userSettingsOpen}
        onClose={() => setUserSettingsOpen(false)}
      />
    </Container>
  );
}