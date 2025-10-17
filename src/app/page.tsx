'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import OriginalKanbanBoard from '@/components/kanban/OriginalKanbanBoard';
import { useTheme } from '@/theme/ThemeRegistry';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Board {
  id: string;
  name: string;
  description: string;
  created_at: string;
  visibility?: string | null;
  owner_id?: string | null;
  user_id?: string | null;
  cardCount?: number;
}

export default function HomePage() {
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();
  const { user, loading, signOut } = useAuth();
  
  // Board Management States
  const [boards, setBoards] = useState<Board[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [message, setMessage] = useState('');

  // Auth-Check
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [user, loading]);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setIsAdmin(String(data?.role || '').toLowerCase() === 'admin');
    } catch (error) {
      console.error('Fehler beim Laden des Profils:', error);
      setIsAdmin(false);
    }
  }, [user]);

  const loadBoards = useCallback(async () => {
    try {
      let boardsData: Board[] | null = null;

      try {
        const { data: rpcBoards, error: rpcError } = await supabase
          .rpc('list_all_boards');

        if (rpcError) {
          if (rpcError.code === '42883') {
            console.warn('Supabase Funktion list_all_boards nicht gefunden. Fallback auf direkte Abfrage.');
            if (isAdmin) {
              setMessage('ℹ️ Bitte lege die Supabase-Funktion "list_all_boards" an, damit alle Boards für alle Nutzer sichtbar werden.');
              setTimeout(() => setMessage(''), 6000);
            }
          } else {
            console.warn('RPC list_all_boards fehlgeschlagen:', rpcError);
          }
        } else {
          boardsData = (rpcBoards as Board[]) ?? [];
        }
      } catch (rpcUnexpectedError) {
        console.warn('Unerwarteter RPC-Fehler:', rpcUnexpectedError);
      }

      if (!boardsData) {
        let query = supabase.from('kanban_boards').select('*');

        if (user) {
          query = query.or(
            `visibility.eq.public,owner_id.eq.${user.id},user_id.eq.${user.id}`,
          );
        } else {
          query = query.eq('visibility', 'public');
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        boardsData = (data as Board[]) ?? [];
      }

      const sanitizedBoards = (boardsData ?? []).map((board) => ({
        ...board,
        visibility: board.visibility ?? 'public',
      }));

      setBoards(sanitizedBoards);

      const boardsWithoutVisibility = sanitizedBoards
        .filter((board) => !board.visibility || board.visibility === '');

      if (boardsWithoutVisibility.length && isAdmin) {
        const ids = boardsWithoutVisibility.map((board) => board.id);
        const { error: updateError } = await supabase
          .from('kanban_boards')
          .update({ visibility: 'public' })
          .in('id', ids);

        if (updateError) {
          console.error('Fehler beim Aktualisieren der Sichtbarkeit:', updateError);
        } else {
          setBoards((prev) =>
            prev.map((board) =>
              ids.includes(board.id) ? { ...board, visibility: 'public' } : board,
            ),
          );
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Boards:', error);
      setMessage('❌ Fehler beim Laden der Boards');
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    loadProfile();
    loadBoards();
  }, [user, loadProfile, loadBoards]);

  const createBoard = async () => {
    if (!newBoardName.trim()) return;

    if (!isAdmin) {
      setMessage('❌ Nur Administratoren können neue Boards erstellen.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('kanban_boards')
        .insert([
          {
            name: newBoardName.trim(),
            description: newBoardDescription.trim(),
            owner_id: user?.id,
            user_id: user?.id,
            visibility: 'public',
            settings: {}
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setBoards((prev) => (data ? [data, ...prev] : prev));
      setCreateDialogOpen(false);
      setNewBoardName('');
      setNewBoardDescription('');
      setMessage('✅ Board erfolgreich erstellt!');

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      setMessage('❌ Fehler beim Erstellen des Boards');
    }
  };

  const deleteBoard = async () => {
    if (!boardToDelete) return;

    if (!isAdmin) {
      setMessage('❌ Nur Administratoren können Boards löschen.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const { error } = await supabase
        .from('kanban_boards')
        .delete()
        .eq('id', boardToDelete.id);

      if (error) throw error;

      setBoards((prev) => prev.filter(b => b.id !== boardToDelete.id));
      setDeleteDialogOpen(false);
      setBoardToDelete(null);
      setMessage('✅ Board erfolgreich gelöscht!');

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setMessage('❌ Fehler beim Löschen des Boards');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography variant="h6">🔄 Wird geladen...</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography variant="h6">🔄 Weiterleitung...</Typography>
      </Box>
    );
  }

  // Board-Ansicht
  if (selectedBoard) {
    const currentBoard = boards.find(b => b.id === selectedBoard);
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ 
          p: 2, 
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => setSelectedBoard(null)}
            >
              ← Zurück
            </Button>
            <Typography variant="h6">
              {currentBoard?.name || 'Board'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
  <Button 
    variant="outlined" 
    onClick={() => window.location.href = '/admin'}
    sx={{ 
      color: '#9c27b0', 
      borderColor: '#9c27b0',
      '&:hover': {
        backgroundColor: '#f3e5f5',
        borderColor: '#7b1fa2'
      }
    }}
  >
   
    👥 Admin
  </Button>
  <Typography variant="body2">
    👋 {user.email}
  </Typography>
  <IconButton onClick={toggleTheme} color="primary">
    {isDark ? '☀️' : '🌙'}
  </IconButton>
  <Button variant="outlined" onClick={signOut} color="error">
    🚪 Abmelden
  </Button>
</Box>

        </Box>

        {/* Board */}
        <Box sx={{ flex: 1 }}>
          <OriginalKanbanBoard boardId={selectedBoard} />
        </Box>
      </Box>
    );
  }

  // Board-Übersicht
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
  <Button 
    variant="outlined" 
    onClick={() => window.location.href = '/admin'}
    sx={{ 
      color: '#9c27b0', 
      borderColor: '#9c27b0',
      '&:hover': {
        backgroundColor: '#f3e5f5',
        borderColor: '#7b1fa2'
      }
    }}
  >
    👥 Admin
  </Button>
  <Typography variant="body2">
    👋 {user.email}
  </Typography>
  <IconButton onClick={toggleTheme} color="primary">
    {isDark ? '☀️' : '🌙'}
  </IconButton>
  <Button variant="outlined" onClick={signOut} color="error">
    🚪 Abmelden
  </Button>
</Box>
      {/* Message */}
      {message && (
        <Alert severity={message.startsWith('✅') ? 'success' : 'error'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      {/* Boards Grid */}
      <Grid container spacing={3}>
        {isAdmin && (
          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #ccc',
                cursor: 'pointer',
                '&:hover': { borderColor: '#14c38e' }
              }}
              onClick={() => setCreateDialogOpen(true)}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h1" sx={{ fontSize: 48, color: '#ccc' }}>+</Typography>
                <Typography variant="h6" color="text.secondary">
                  Neues Board erstellen
                </Typography>
              </Box>
            </Card>
          </Grid>
        )}

        {/* Bestehende Boards */}
        {boards.map((board) => (
          <Grid item xs={12} sm={6} md={4} key={board.id}>
            <Card sx={{ height: 200, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  {board.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {board.description || 'Keine Beschreibung'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Erstellt: {new Date(board.created_at).toLocaleDateString('de-DE')}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button 
                  size="small" 
                  variant="contained"
                  onClick={() => setSelectedBoard(board.id)}
                  sx={{ backgroundColor: '#14c38e', '&:hover': { backgroundColor: '#0ea770' } }}
                >
                  📋 Öffnen
                </Button>
                {isAdmin && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setBoardToDelete(board);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    🗑️ Löschen
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Board Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>🆕 Neues Board erstellen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Board Name"
            fullWidth
            variant="outlined"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Beschreibung (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newBoardDescription}
            onChange={(e) => setNewBoardDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={createBoard} 
            variant="contained"
            disabled={!newBoardName.trim()}
            sx={{ backgroundColor: '#14c38e', '&:hover': { backgroundColor: '#0ea770' } }}
          >
            ✅ Erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Board Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>🗑️ Board löschen</DialogTitle>
        <DialogContent>
          <Typography>
            Möchtest du das Board <strong>"{boardToDelete?.name}"</strong> wirklich löschen?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            ⚠️ Diese Aktion kann nicht rückgängig gemacht werden!
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={deleteBoard} color="error" variant="contained">
            🗑️ Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
