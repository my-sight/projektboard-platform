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
  Alert,
  Tooltip
} from '@mui/material';
import { Delete, Add, Event, CheckCircle, Dashboard, Assignment, ListAlt } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';

interface PersonalDashboardProps {
  onOpenBoard: (boardId: string, cardId?: string, boardType?: 'standard' | 'team') => void;
}

export default function PersonalDashboard({ onOpenBoard }: PersonalDashboardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  const [newNote, setNewNote] = useState('');
  const [newNoteDate, setNewNoteDate] = useState('');

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // 1. User laden
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            if (active) setLoading(false);
            return;
        }
        if (active) setUserId(user.id);

        // 2. Identitäts-Check (Strikter!)
        const profiles = await fetchClientProfiles();
        const myProfile = profiles.find(p => p.id === user.id);
        
        // Wir erstellen eine Liste exakter Identifikatoren (Lowercase)
        const myIdentifiers = [
            user.email,               // E-Mail (Prio 1)
            myProfile?.full_name,     // Voller Name
            myProfile?.name           // Name
        ]
        .filter(Boolean)
        .map(n => String(n).toLowerCase().trim());

        // 3. Boards laden
        const { data: boards } = await supabase.from('kanban_boards').select('id, name, settings');
        const bMap: Record<string, any> = {};
        boards?.forEach(b => { 
            const settings = b.settings as Record<string, any> | null;
            bMap[b.id] = { name: b.name, type: settings?.boardType || 'standard' }; 
        });

        // 4. Karten laden
        const { data: cards, error } = await supabase
          .from('kanban_cards')
          .select('*')
          .not('card_data->>Archived', 'eq', '1');

        if (error) throw error;

        if (cards && active) {
          const tTasks: any[] = [];
          const pTasks: any[] = [];

          cards.forEach((row) => {
            const data = row.card_data || {};
            const boardId = row.board_id;
            const boardInfo = bMap[boardId];
            // Falls Board gelöscht, aber Karte noch da -> ignorieren oder anzeigen als "Unbekannt"
            const boardName = boardInfo?.name || 'Board'; 
            const boardType = boardInfo?.type || 'standard';

            let isMine = false;
            
            // A) ID Match (Teamboard & Projektboard mit ID-Verknüpfung)
            // Das ist der sicherste Weg.
            if (data.assigneeId === user.id || data.userId === user.id) {
                isMine = true;
            }

            // B) Namens/Email Match (Projektboard Legacy String-Feld)
            if (!isMine && data.Verantwortlich) {
               const responsible = String(data.Verantwortlich).toLowerCase().trim();
               
               // Check: Ist einer meiner Identifikatoren im Verantwortlichen-Feld enthalten?
               // ODER: Ist der Verantwortliche exakt einer meiner Identifikatoren?
               // Wir nutzen 'includes' in beide Richtungen, aber OHNE vorheriges Zerlegen in Wörter.
               // Das verhindert, dass "Michael" auf "Michael Müller" matcht, wenn ich nur "Müller" heiße.
               // Aber "Michael@test.de" matcht auf "Michael".
               
               if (myIdentifiers.some(id => responsible === id || responsible.includes(id) || id.includes(responsible))) {
                   isMine = true;
               }
            }

            if (isMine) {
               const isTeamStructure = data.type === 'teamTask' || boardType === 'team';
               
               if (isTeamStructure) {
                   // Team: Alles außer 'done'
                   const status = data.status || 'backlog';
                   if (status !== 'done') {
                       tTasks.push({ ...data, boardId, id: row.card_id, boardName, status });
                   }
               } else {
                   // Projekt: Alles
                   pTasks.push({ ...data, boardId, id: row.card_id, boardName });
               }
            }
          });

          setTeamTasks(tTasks);
          setProjectTasks(pTasks);
        }

        // 5. Notizen
        const { data: myNotes } = await supabase
          .from('personal_notes')
          .select('*')
          .eq('user_id', user.id)
          .order('is_done', { ascending: true })
          .order('due_date', { ascending: true });
          
        if (active) setNotes(myNotes || []);
      
      } catch (err) {
        console.error("Dashboard Fehler:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [supabase]);

  const markTaskAsDone = async (task: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setTeamTasks(prev => prev.filter(t => t.id !== task.id));
    
    try {
        const { id, boardId, boardName, status, ...cleanData } = task;
        // WICHTIG: Beim Teamboard ist die Stage "team|USERID|status"
        // Wir müssen sicherstellen, dass wir die richtige UserID für den Pfad haben
        const assignee = task.assigneeId || userId; 
        const newStage = `team|${assignee}|done`;
        
        const updatedCardData = { 
            ...cleanData, 
            status: 'done',
            assigneeId: assignee 
        };
        
        const { error } = await supabase
            .from('kanban_cards')
            .update({ 
                stage: newStage, 
                card_data: updatedCardData, 
                updated_at: new Date().toISOString() 
            })
            .eq('card_id', task.id);

        if (error) throw error;
        enqueueSnackbar('Aufgabe erledigt! 🎉', { variant: 'success' });
    } catch (err) {
        console.error(err);
        enqueueSnackbar('Fehler beim Speichern.', { variant: 'error' });
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data } = await supabase.from('personal_notes').insert({ user_id: userId, content: newNote, due_date: newNoteDate || null }).select().single();
    if (data) { setNotes([...notes, data]); setNewNote(''); setNewNoteDate(''); }
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
    <Box sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
        <Dashboard /> Mein Cockpit
      </Typography>

      <Grid container spacing={3}>
        {/* TEAM AUFGABEN */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment color="primary" /> Team-Aufgaben
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Aktive Aufgaben aus Teamboards
              </Typography>
              
              {teamTasks.length === 0 ? (
                <Alert severity="info" icon={false} sx={{ mt: 2, bgcolor: 'background.default' }}>
                    Keine offenen Team-Aufgaben.
                </Alert>
              ) : (
                <Stack spacing={1.5}>
                  {teamTasks.map((task, i) => (
                    <Card 
                        key={task.id || i} 
                        variant="elevation"
                        elevation={0}
                        sx={{ 
                            p: 2, 
                            cursor: 'pointer', 
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }, 
                            transition: 'all 0.2s',
                            position: 'relative'
                        }} 
                        onClick={() => onOpenBoard(task.boardId, task.id, 'team')}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pr: 4 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                          {task.description || 'Aufgabe'}
                        </Typography>
                        <Tooltip title="Erledigen">
                            <IconButton 
                                size="small" 
                                color="success" 
                                onClick={(e) => markTaskAsDone(task, e)}
                                sx={{ position: 'absolute', top: 8, right: 8 }}
                            >
                                <CheckCircle fontSize="small" />
                            </IconButton>
                        </Tooltip>
                      </Box>

                      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Stack direction="row" spacing={1} alignItems="center">
                             <Chip 
                                label={task.boardName} 
                                size="small" 
                                variant="outlined" 
                                sx={{ fontSize: '0.65rem', height: 20 }} 
                             />
                             {task.status === 'backlog' && <Chip label="Backlog" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />}
                             {task.important && <Chip label="!" color="error" size="small" sx={{ height: 20, minWidth: 20, px: 0 }} />}
                         </Stack>
                         {task.dueDate && (
                           <Typography variant="caption" color={new Date(task.dueDate) < new Date() ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 500 }}>
                             {new Date(task.dueDate).toLocaleDateString()}
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

        {/* PROJEKT KARTEN */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment color="secondary" /> Projekt-Karten
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Karten, bei denen du verantwortlich bist
              </Typography>

              {projectTasks.length === 0 ? (
                <Alert severity="info" icon={false} sx={{ mt: 2, bgcolor: 'background.default' }}>
                    Keine Projekt-Karten zugewiesen.
                </Alert>
              ) : (
                <Stack spacing={1.5}>
                  {projectTasks.map((task, i) => (
                    <Card 
                        key={task.id || i} 
                        variant="elevation"
                        elevation={0}
                        sx={{ 
                            p: 2, 
                            cursor: 'pointer', 
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': { borderColor: 'secondary.main', bgcolor: 'action.hover' }, 
                            transition: 'all 0.2s'
                        }} 
                        onClick={() => onOpenBoard(task.boardId, task.id, 'standard')}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{task.Nummer}</Typography>
                        <Chip label={task['Board Stage']} size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'action.selected' }} />
                      </Box>
                      <Typography variant="body2" noWrap sx={{ mt: 0.5 }}>{task.Teil}</Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {task.boardName} {task['Due Date'] ? `• ${new Date(task['Due Date']).toLocaleDateString()}` : ''}
                          </Typography>
                          {task.Ampel && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: task.Ampel.toLowerCase().includes('rot') ? 'error.main' : 'success.main' }} />}
                      </Box>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* NOTIZEN */}
        <Grid item xs={12}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ListAlt color="action" /> Persönliche Notizen
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: 'auto' }, flexGrow: 1, maxWidth: '600px' }}>
                    <TextField 
                        size="small" 
                        placeholder="Neues Thema..." 
                        fullWidth 
                        value={newNote} 
                        onChange={(e) => setNewNote(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && addNote()}
                    />
                    <TextField 
                        size="small" 
                        type="date" 
                        value={newNoteDate} 
                        onChange={(e) => setNewNoteDate(e.target.value)}
                        sx={{ width: 150 }}
                    />
                    <Button variant="contained" onClick={addNote} sx={{ minWidth: '40px' }}>
                        <Add />
                    </Button>
                </Box>
              </Box>

              <List dense>
                {notes.length === 0 && (
                    <ListItem>
                        <ListItemText primary="Keine Notizen vorhanden." sx={{ fontStyle: 'italic', color: 'text.secondary' }} />
                    </ListItem>
                )}
                {notes.map((note, index) => (
                  <div key={note.id}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem 
                        secondaryAction={
                        <IconButton edge="end" size="small" onClick={() => deleteNote(note.id)}>
                            <Delete fontSize="small" color="action" />
                        </IconButton>
                        }
                    >
                        <Checkbox 
                            checked={note.is_done} 
                            onChange={() => toggleNote(note.id, note.is_done)}
                        />
                        <ListItemText 
                            primary={
                                <Typography sx={{ 
                                    fontWeight: 500,
                                    textDecoration: note.is_done ? 'line-through' : 'none',
                                    opacity: note.is_done ? 0.6 : 1
                                }}>
                                    {note.content}
                                </Typography>
                            } 
                        />
                        {note.due_date && (
                            <Chip 
                                label={new Date(note.due_date).toLocaleDateString('de-DE')} 
                                size="small" 
                                icon={<Event fontSize="small" />}
                                color={new Date(note.due_date) < new Date() && !note.is_done ? 'error' : 'default'}
                                variant="outlined"
                                sx={{ mr: 2 }}
                            />
                        )}
                    </ListItem>
                  </div>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}