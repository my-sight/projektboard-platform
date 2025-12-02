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
  useTheme
} from '@mui/material';
import OriginalKanbanBoard, { OriginalKanbanBoardHandle } from '@/components/kanban/OriginalKanbanBoard';
import { useAuth } from '../contexts/AuthContext';
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
  const theme = useTheme();
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

  useEffect(() => { setArchivedCount(null); setKpiCount(0); }, [selectedBoard]);

  useEffect(() => {
    if (!supabase) return;
    if (!loading && !user) window.location.href = '/login';
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
      setViewMode(type === 'team' ? 'team-board' : 'board');
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

  // --- Views für Board & Management ---
  if (selectedBoard && selectedBoard.boardType === 'standard' && viewMode === 'board') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="outlined" onClick={() => { setViewMode('management'); setOpenCardId(null); }}>← Management</Button>
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
            <Button variant="outlined" onClick={() => setViewMode('team-management')}>← Management</Button>
            <Typography variant="h6">{selectedBoard.name || 'Teamboard'}</Typography>
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
            {isAdmin && <Button variant="outlined" onClick={() => (window.location.href = '/admin')}>Admin</Button>}
            <Typography variant="body2">👋 {user.email}</Typography>
            <Button variant="outlined" onClick={signOut} color="error">Abmelden</Button>
         </Box>
      </Box>

      {message && <Alert severity={message.startsWith('✅') ? 'success' : 'error'} sx={{ mb: 3 }}>{message}</Alert>}

      <PersonalDashboard onOpenBoard={handleOpenBoardFromDashboard} />
      
      <Divider sx={{ my: 6 }} />

      {/* --- PROJEKTBOARDS --- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Projektboards</Typography>
      <Box sx={scrollContainerSx}>
        {isAdmin && (
            <Box sx={itemSx}>
                <Card sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,0,0,0.02)' } }} onClick={() => { setNewBoardType('standard'); setCreateDialogOpen(true); }}>
                  <Typography variant="h6" color="text.secondary" sx={{display:'flex', alignItems:'center', gap:1}}>
                     <span>+</span> Neues Board
                  </Typography>
                </Card>
            </Box>
        )}
        {standardBoards.map((board) => (
            <Box key={board.id} sx={itemSx}>
                <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}>
                  <CardContent>
                    <Typography variant="h6" noWrap title={board.name}>{board.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {board.description || 'Keine Beschreibung'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode('management'); }}>Öffnen</Button>
                    {isAdmin && <Button size="small" color="error" onClick={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}>Löschen</Button>}
                  </CardActions>
                </Card>
            </Box>
        ))}
      </Box>

      {/* --- TEAMBOARDS --- */}
      <Typography variant="h5" sx={{ mt: 5, mb: 2, fontWeight: 600 }}>Teamboards</Typography>
      <Box sx={scrollContainerSx}>
        {isAdmin && (
             <Box sx={itemSx}>
                <Card sx={{ height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,0,0,0.02)' } }} onClick={() => { setNewBoardType('team'); setCreateDialogOpen(true); }}>
                  <Typography variant="h6" color="text.secondary" sx={{display:'flex', alignItems:'center', gap:1}}>
                     <span>+</span> Neues Teamboard
                  </Typography>
                </Card>
             </Box>
        )}
        {teamBoards.map((board) => (
            <Box key={board.id} sx={itemSx}>
                <Card sx={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}>
                  <CardContent>
                    <Typography variant="h6" noWrap title={board.name}>{board.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {board.description || 'Keine Beschreibung'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                    <Button size="small" variant="contained" onClick={() => { setSelectedBoard(board); setViewMode('team-management'); }}>Öffnen</Button>
                    {isAdmin && <Button size="small" color="error" onClick={() => { setBoardToDelete(board); setDeleteDialogOpen(true); }}>Löschen</Button>}
                  </CardActions>
                </Card>
            </Box>
        ))}
      </Box>
      
      {/* Dialogs */}
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