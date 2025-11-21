'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
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
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import OriginalKanbanBoard, { OriginalKanbanBoardHandle } from '@/components/kanban/OriginalKanbanBoard';
import { useTheme } from '@/theme/ThemeRegistry';
import { useAuth } from '../contexts/AuthContext';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BoardManagementPanel from '@/components/board/BoardManagementPanel';
import TeamKanbanBoard from '@/components/team/TeamKanbanBoard';
import TeamBoardManagementPanel from '@/components/team/TeamBoardManagementPanel';
import PersonalDashboard from '@/components/dashboard/PersonalDashboard';
import { isSuperuserEmail } from '@/constants/superuser';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';

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
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'management' | 'board' | 'team-management' | 'team-board'>('list');
  
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const { isDark, toggleTheme } = useTheme();
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

  useEffect(() => {
    setArchivedCount(null);
    setKpiCount(0);
  }, [selectedBoard]);

  useEffect(() => {
    if (!supabase) return;
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [loading, supabase, user]);

  const loadProfile = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const superuser = isSuperuserEmail(user.email ?? null);
      const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (error) throw error;
      const role = String(data?.role || '').toLowerCase();
      setIsSuperuser(superuser);
      setIsAdmin(superuser || role === 'admin');
    } catch (error) {
      const superuser = isSuperuserEmail(user.email ?? null);
      setIsSuperuser(superuser);
      setIsAdmin(superuser);
    }
  }, [supabase, user]);

  const loadBoards = useCallback(async () => {
    if (!supabase) { setMessage('❌ Supabase-Konfiguration fehlt.'); return; }
    try {
      let boardsData: Board[] | null = null;
      try {
        const { data: rpcBoards, error: rpcError } = await supabase.rpc('list_all_boards');
        if (!rpcError) boardsData = (rpcBoards as Board[]) ?? [];
      } catch {}

      if (!boardsData) {
        const { data, error } = await supabase.from('kanban_boards').select('*').order('created_at', { ascending: false });
        if (!error) boardsData = (data as Board[]) ?? [];
      }

      const sanitizedBoards = (boardsData ?? []).map((board) => {
        const rawSettings = board.settings && typeof board.settings === 'object' ? (board.settings as Record<string, unknown>) : {};
        const typeRaw = (rawSettings as Record<string, unknown>)['boardType'];
        const boardType = typeof typeRaw === 'string' && typeRaw.toLowerCase() === 'team' ? 'team' : 'standard';
        return { ...board, settings: rawSettings, visibility: board.visibility ?? 'public', boardType, boardAdminId: (board as any).board_admin_id ?? null } as Board;
      });
      setBoards(sanitizedBoards);
    } catch (error) { setMessage('❌ Fehler beim Laden der Boards'); }
  }, [isAdmin, supabase, user]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsSuperuser(false); setSelectedBoard(null); setViewMode('list'); return; }
    loadProfile();
    loadBoards();
  }, [user, loadProfile, loadBoards]);

  const currentUserId = user?.id ?? null;
  const isSelectedBoardAdmin = selectedBoard?.boardAdminId === currentUserId;

  const handleOpenBoardFromDashboard = (boardId: string, cardId?: string, type: 'standard' | 'team' = 'standard') => {
    const board = boards.find(b => b.id === boardId);
    if (board) {
      setSelectedBoard(board);
      if (cardId) setOpenCardId(cardId);
      if (type === 'team') {
          setViewMode('team-board');
      } else {
          setViewMode('board');
      }
    }
  };

  const standardBoards = useMemo(() => boards.filter((board) => board.boardType === 'standard'), [boards]);
  const teamBoards = useMemo(() => boards.filter((board) => board.boardType === 'team'), [boards]);

  const createBoard = async () => {
    if (!supabase || !newBoardName.trim() || !isAdmin) return;
    try {
      const initialSettings = { boardType: newBoardType };
      const { data, error } = await supabase.from('kanban_boards').insert([{ name: newBoardName.trim(), description: newBoardDescription.trim(), owner_id: user?.id, user_id: user?.id, visibility: 'public', settings: initialSettings }]).select().single();
      if (error) throw error;
      if (data) { loadBoards(); }
      setCreateDialogOpen(false); setNewBoardName(''); setNewBoardDescription(''); setMessage('✅ Board erfolgreich erstellt!'); setTimeout(() => setMessage(''), 3000);
    } catch (error) { setMessage('❌ Fehler beim Erstellen des Boards'); }
  };

  const deleteBoard = async () => {
    if (!supabase || !boardToDelete || !isAdmin) return;
    try {
      const { error } = await supabase.from('kanban_boards').delete().eq('id', boardToDelete.id);
      if (error) throw error;
      setBoards((prev) => prev.filter(b => b.id !== boardToDelete.id));
      setDeleteDialogOpen(false); setBoardToDelete(null); setMessage('✅ Board erfolgreich gelöscht!'); setTimeout(() => setMessage(''), 3000);
    } catch (error) { setMessage('❌ Fehler beim Löschen des Boards'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Typography variant="h6">🔄 Wird geladen...</Typography></Box>;
  if (!supabase) return <Container maxWidth="sm" sx={{ py: 8 }}><SupabaseConfigNotice /></Container>;
  if (!user) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Typography variant="h6">🔄 Weiterleitung...</Typography></Box>;

  // BOARD VIEWS
  if (selectedBoard && selectedBoard.boardType === 'standard' && viewMode === 'board') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" onClick={() => { setViewMode('management'); setOpenCardId(null); }}>← Management</Button>
            <Typography variant="h6">{selectedBoard.name || 'Board'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Badge badgeContent={kpiCount} color="error"><IconButton onClick={() => boardRef.current?.openKpis()}><AssessmentIcon /></IconButton></Badge>
            <Button variant="outlined" onClick={() => boardRef.current?.openArchive()}>Archiv{archivedCount !== null ? ` (${archivedCount})` : ''}</Button>
            <IconButton onClick={() => boardRef.current?.openSettings()}>⚙️</IconButton>
            <Typography variant="body2">👋 {user.email}</Typography>
            <IconButton onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</IconButton>
            <Button variant="outlined" onClick={signOut} color="error">🚪</Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <OriginalKanbanBoard ref={boardRef} boardId={selectedBoard.id} onArchiveCountChange={setArchivedCount} onKpiCountChange={setKpiCount} highlightCardId={openCardId} />
        </Box>
      </Box>
    );
  }

  if (selectedBoard && selectedBoard.boardType === 'team' && viewMode === 'team-board') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" onClick={() => setViewMode('team-management')}>← Management</Button>
            <Typography variant="h6">{selectedBoard.name || 'Teamboard'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2">👋 {user.email}</Typography>
            <IconButton onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</IconButton>
            <Button variant="outlined" onClick={signOut} color="error">🚪</Button>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TeamKanbanBoard boardId={selectedBoard.id} />
        </Box>
      </Box>
    );
  }

  // MANAGEMENT VIEWS
  if (selectedBoard && viewMode === 'management') {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Button variant="outlined" onClick={() => { setSelectedBoard(null); setViewMode('list'); }}>← Übersicht</Button>
            <Button variant="contained" onClick={() => setViewMode('board')}>📋 Zum Board</Button>
        </Box>
        <BoardManagementPanel boardId={selectedBoard.id} canEdit={isAdmin || isSelectedBoardAdmin} memberCanSee={true} />
      </Container>
    );
  }

  if (selectedBoard && viewMode === 'team-management') {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Button variant="outlined" onClick={() => { setSelectedBoard(null); setViewMode('list'); }}>← Übersicht</Button>
            <Button variant="contained" onClick={() => setViewMode('team-board')}>📋 Zum Board</Button>
        </Box>
        <TeamBoardManagementPanel boardId={selectedBoard.id} canEdit={isAdmin || isSelectedBoardAdmin} memberCanSee={true} />
      </Container>
    );
  }

  // --- MAIN LIST VIEW (Umgedrehte Reihenfolge!) ---
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
         <Typography variant="h4">📌 Meine Boards</Typography>
         <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {isAdmin && <Button variant="outlined" onClick={() => (window.location.href = '/admin')}>Admin</Button>}
            <Typography variant="body2">👋 {user.email}</Typography>
            <IconButton onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</IconButton>
            <Button variant="outlined" onClick={signOut} color="error">Abmelden</Button>
         </Box>
      </Box>

      {message && <Alert severity={message.startsWith('✅') ? 'success' : 'error'} sx={{ mb: 3 }}>{message}</Alert>}

      {/* ✅ 1. PERSÖNLICHES DASHBOARD GANZ OBEN */}
      <PersonalDashboard onOpenBoard={handleOpenBoardFromDashboard} />
      
      <Divider sx={{ my: 6 }} />

      {/* ✅ 2. BOARDS UNTEN */}
      <Typography variant="h5" sx={{ mb: 2 }}>Projektboards</Typography>
      <Grid container spacing={3}>
        {isAdmin && (
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => { setNewBoardType('standard'); setCreateDialogOpen(true); }}>
              <Typography variant="h6" color="text.secondary">+ Neues Projektboard</Typography>
            </Card>
          </Grid>
        )}
        {standardBoards.map((board) => (
          <Grid item xs={12} sm={6} md={4} key={board.id}>
            <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <CardContent>
                <Typography variant="h6">{board.name}</Typography>
                <Typography variant="body2" color="text.secondary">{board.description}</Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode('management'); }}>Öffnen</Button>
                {isAdmin && <Button size="small" color="error" onClick={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}>Löschen</Button>}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" sx={{ mt: 5, mb: 2 }}>Teamboards</Typography>
      <Grid container spacing={3}>
        {isAdmin && (
          <Grid item xs={12} sm={6} md={4}>
             <Card sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => { setNewBoardType('team'); setCreateDialogOpen(true); }}>
              <Typography variant="h6" color="text.secondary">+ Neues Teamboard</Typography>
            </Card>
          </Grid>
        )}
        {teamBoards.map((board) => (
          <Grid item xs={12} sm={6} md={4} key={board.id}>
            <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <CardContent>
                <Typography variant="h6">{board.name}</Typography>
                <Typography variant="body2" color="text.secondary">{board.description}</Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode('team-management'); }}>Öffnen</Button>
                {isAdmin && <Button size="small" color="error" onClick={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}>Löschen</Button>}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Dialogs... */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Neues Board erstellen</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Name" fullWidth value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Typ</InputLabel>
            <Select value={newBoardType} label="Typ" onChange={(e) => setNewBoardType(e.target.value as any)}>
              <MenuItem value="standard">Projektboard</MenuItem>
              <MenuItem value="team">Teamboard</MenuItem>
            </Select>
          </FormControl>
          <TextField margin="dense" label="Beschreibung" fullWidth multiline rows={3} value={newBoardDescription} onChange={(e) => setNewBoardDescription(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={createBoard} variant="contained">Erstellen</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Board löschen?</DialogTitle>
        <DialogContent><Typography>Soll "{boardToDelete?.name}" wirklich gelöscht werden?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={deleteBoard} color="error" variant="contained">Löschen</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}