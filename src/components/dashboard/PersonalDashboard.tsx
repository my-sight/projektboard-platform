'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  TextField,
  Checkbox,
  Stack,
  Button,
  Divider,
  LinearProgress,
} from '@mui/material';
import { Delete, Add, Event, ArrowForward } from '@mui/icons-material';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';

interface PersonalDashboardProps {
  onOpenBoard: (boardId: string, cardId?: string, boardType?: 'standard' | 'team') => void;
}

export default function PersonalDashboard({ onOpenBoard }: PersonalDashboardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  
  // Daten
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [boardsMap, setBoardsMap] = useState<Record<string, string>>({}); // ID -> Name

  // Note Draft
  const [newNote, setNewNote] = useState('');
  const [newNoteDate, setNewNoteDate] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // 1. User Info & Profile laden (für Namensabgleich)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const profiles = await fetchClientProfiles();
      const myProfile = profiles.find(p => p.id === user.id);
      const myFullName = myProfile?.full_name || myProfile?.name || user.email || '';
      setUserName(myFullName);

      // 2. Boards laden (für Namen)
      const { data: boards } = await supabase.from('kanban_boards').select('id, name, settings');
      const bMap: Record<string, string> = {};
      boards?.forEach(b => { bMap[b.id] = b.name; });
      setBoardsMap(bMap);

      // 3. Karten laden (Alle Karten, wir filtern client-seitig für Flexibilität)
      // Optimierung: Nur Karten laden, die nicht archiviert sind
      const { data: cards } = await supabase
        .from('kanban_cards')
        .select('*')
        // Wir laden etwas mehr, um sicher zu filtern. RLS erlaubt das Lesen.
        .not('card_data->>Archived', 'eq', '1'); 

      if (cards) {
        const tTasks: any[] = [];
        const pTasks: any[] = [];

        cards.forEach(row => {
          const data = row.card_data || {};
          const boardId = row.board_id;
          const board = boards?.find(b => b.id === boardId);
          const isTeamBoard = board?.settings?.boardType === 'team';

          if (isTeamBoard) {
            // TEAM TASK LOGIK: Assignee ID + Status Flow
            const status = data.status || '';
            const isFlow = status === 'flow1' || status === 'flow';
            const isAssigned = data.assigneeId === user.id;
            
            if (isFlow && isAssigned) {
              tTasks.push({ ...data, boardId, id: row.card_id, boardName: bMap[boardId] });
            }
          } else {
            // PROJEKT TASK LOGIK: Verantwortlich Name
            const responsible = String(data.Verantwortlich || '').trim();
            // Einfacher String-Vergleich (könnte man noch robuster machen)
            const isAssigned = responsible && myFullName.includes(responsible);
            
            if (isAssigned) {
              pTasks.push({ ...data, boardId, id: row.card_id, boardName: bMap[boardId] });
            }
          }
        });

        setTeamTasks(tTasks);
        setProjectTasks(pTasks);
      }

      // 4. Notizen laden
      const { data: myNotes } = await supabase
        .from('personal_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('is_done', { ascending: true })
        .order('due_date', { ascending: true });
        
      setNotes(myNotes || []);
      
      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data, error } = await supabase.from('personal_notes').insert({
      user_id: userId,
      content: newNote,
      due_date: newNoteDate || null
    }).select().single();

    if (data) {
      setNotes([...notes, data]);
      setNewNote('');
      setNewNoteDate('');
    }
  };

  const toggleNote = async (id: string, current: boolean) => {
    await supabase.from('personal_notes').update({ is_done: !current }).eq('id', id);
    setNotes(notes.map(n => n.id === id ? { ...n, is_done: !current } : n));
  };

  const deleteNote = async (id: string) => {
    await supabase.from('personal_notes').delete().eq('id', id);
    setNotes(notes.filter(n => n.id !== id));
  };

  if (loading) return <LinearProgress sx={{ mt: 4 }} />;

  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        🚀 Mein Cockpit
      </Typography>

      <Grid container spacing={3}>
        {/* 1. TEAM FLOW AUFGABEN */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', bgcolor: '#e3f2fd', border: '1px solid #90caf9' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#1565c0', fontWeight: 600 }}>
                ⚡ Im Flow (Team)
              </Typography>
              <Typography variant="caption" sx={{ mb: 2, display: 'block', color: '#1e88e5' }}>
                Deine aktiven Aufgaben in Teamboards
              </Typography>
              
              {teamTasks.length === 0 ? (
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                  Alles erledigt! Nichts im Flow.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {teamTasks.map((task) => (
                    <Card key={task.id} sx={{ p: 1.5, cursor: 'pointer', '&:hover': { boxShadow: 2 } }} onClick={() => onOpenBoard(task.boardId, task.id, 'team')}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                          {task.description || 'Ohne Titel'}
                        </Typography>
                        {task.important && <Chip label="!" color="error" size="small" sx={{ height: 20, minWidth: 20, px: 0 }} />}
                      </Box>
                      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Chip label={task.boardName} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                         {task.dueDate && (
                           <Typography variant="caption" color="text.secondary">
                             {new Date(task.dueDate).toLocaleDateString('de-DE')}
                           </Typography>
                         )}
                      </Box>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 2. PROJEKT KARTEN */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', bgcolor: '#f3e5f5', border: '1px solid #ce93d8' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#6a1b9a', fontWeight: 600 }}>
                📋 Meine Projektkarten
              </Typography>
              <Typography variant="caption" sx={{ mb: 2, display: 'block', color: '#8e24aa' }}>
                Karten, auf denen du als "Verantwortlich" stehst
              </Typography>

              {projectTasks.length === 0 ? (
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                  Keine Projektkarten zugewiesen.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {projectTasks.map((task) => (
                    <Card key={task.id} sx={{ p: 1.5, cursor: 'pointer', '&:hover': { boxShadow: 2 } }} onClick={() => onOpenBoard(task.boardId, task.id, 'standard')}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {task.Nummer}
                        </Typography>
                        <Chip label={task['Board Stage']} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'rgba(0,0,0,0.05)' }} />
                      </Box>
                      <Typography variant="body2" sx={{ mt: 0.5, mb: 1, lineHeight: 1.2 }}>
                        {task.Teil}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Chip label={task.boardName} size="small" variant="outlined" color="secondary" sx={{ fontSize: '0.7rem', height: 20 }} />
                         {task.Ampel && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: task.Ampel.toLowerCase().includes('rot') ? 'error.main' : 'success.main' }} />}
                      </Box>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 3. PERSÖNLICHE NOTIZEN */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', bgcolor: '#fff3e0', border: '1px solid #ffcc80' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#ef6c00', fontWeight: 600 }}>
                📝 Persönliche Notizen
              </Typography>
              <Typography variant="caption" sx={{ mb: 2, display: 'block', color: '#f57c00' }}>
                Nur für dich sichtbar
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField 
                  size="small" 
                  placeholder="Neues Thema..." 
                  fullWidth 
                  value={newNote} 
                  onChange={(e) => setNewNote(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && addNote()}
                  sx={{ bgcolor: 'white' }}
                />
                <TextField 
                  size="small" 
                  type="date" 
                  value={newNoteDate} 
                  onChange={(e) => setNewNoteDate(e.target.value)}
                  sx={{ bgcolor: 'white', width: 130 }}
                />
                <IconButton onClick={addNote} color="warning" sx={{ bgcolor: 'white', border: '1px solid #ffe0b2' }}><Add /></IconButton>
              </Box>

              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {notes.map((note) => (
                  <ListItem 
                    key={note.id} 
                    secondaryAction={
                      <IconButton edge="end" size="small" onClick={() => deleteNote(note.id)}>
                        <Delete fontSize="small" color="action" />
                      </IconButton>
                    }
                    disablePadding
                    sx={{ mb: 1, bgcolor: 'white', borderRadius: 1, border: '1px solid #ffe0b2', p: 0.5 }}
                  >
                     <Checkbox 
                        checked={note.is_done} 
                        onChange={() => toggleNote(note.id, note.is_done)}
                        color="warning"
                     />
                     <ListItemText 
                        primary={note.content} 
                        secondary={note.due_date ? `Bis: ${new Date(note.due_date).toLocaleDateString('de-DE')}` : null}
                        sx={{ 
                            textDecoration: note.is_done ? 'line-through' : 'none',
                            opacity: note.is_done ? 0.6 : 1
                        }}
                     />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}