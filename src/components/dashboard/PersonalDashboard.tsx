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
import { Delete, Add, Event } from '@mui/icons-material';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';

interface PersonalDashboardProps {
  onOpenBoard: (boardId: string, cardId?: string, boardType?: 'standard' | 'team') => void;
}

export default function PersonalDashboard({ onOpenBoard }: PersonalDashboardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  
  // Daten
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  // Note Draft
  const [newNote, setNewNote] = useState('');
  const [newNoteDate, setNewNoteDate] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      console.log("🚀 Starte Dashboard-Datenladung...");
      
      // 1. User Info laden
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const profiles = await fetchClientProfiles();
      const myProfile = profiles.find(p => p.id === user.id);
      
      // Namens-Varianten für den Abgleich erstellen (Token-basiert)
      const myNameParts = [
          myProfile?.full_name,
          myProfile?.name,
          user.email?.split('@')[0]
      ]
      .filter(Boolean)
      .map(n => String(n).toLowerCase().trim())
      .flatMap(n => n.split(/[\s,.]+/)); // Zerlege in Wörter ("Max", "Mustermann")
      
      const uniqueNameParts = Array.from(new Set(myNameParts)).filter(p => p.length > 2); // Nur Teile > 2 Zeichen
      
      console.log("👤 Mein User:", { id: user.id, email: user.email, suchBegriffe: uniqueNameParts });

      // 2. Boards laden (für Namen)
      const { data: boards } = await supabase.from('kanban_boards').select('id, name');
      const bMap: Record<string, string> = {};
      boards?.forEach(b => { bMap[b.id] = b.name; });

      // 3. Karten laden
      const { data: cards } = await supabase
        .from('kanban_cards')
        .select('*')
        .not('card_data->>Archived', 'eq', '1');

      if (cards) {
        const tTasks: any[] = [];
        const pTasks: any[] = [];

        cards.forEach(row => {
          const data = row.card_data || {};
          const boardId = row.board_id;
          const boardName = bMap[boardId] || 'Unbekanntes Board';
          
          // A) TEAM TASK ERKENNUNG
          // Prüfen auf type='teamTask' (neue Struktur) oder assigneeId Existenz
          const isTeamTask = data.type === 'teamTask' || (data.assigneeId !== undefined && data.assigneeId !== null);

          if (isTeamTask) {
            const status = data.status || '';
            // Relevante Status für das Dashboard (aktiv)
            const isFlow = status === 'flow1' || status === 'flow';
            
            if (isFlow && data.assigneeId === user.id) {
              tTasks.push({ ...data, boardId, id: row.card_id, boardName });
            }
          } 
          // B) PROJEKT TASK ERKENNUNG (Fallback)
          else {
            const responsible = String(data.Verantwortlich || '').toLowerCase().trim();
            
            if (responsible) {
               // Prüfen, ob eines meiner Namens-Teile im Verantwortlichen-Feld vorkommt
               const isAssigned = uniqueNameParts.some(part => responsible.includes(part));
               
               // Oder ob die E-Mail direkt matcht
               const isEmailMatch = user.email && responsible.includes(user.email.toLowerCase());

               if (isAssigned || isEmailMatch) {
                 pTasks.push({ ...data, boardId, id: row.card_id, boardName });
               }
            }
          }
        });

        console.log(`✅ Gefunden: ${tTasks.length} Team-Tasks, ${pTasks.length} Projekt-Tasks`);
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
    <Box sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        🚀 Mein Cockpit
      </Typography>

      <Grid container spacing={3}>
        {/* ZEILE 1: AUFGABEN (Team & Projekt nebeneinander) */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', bgcolor: '#e3f2fd', border: '1px solid #90caf9', boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#1565c0', fontWeight: 600 }}>
                ⚡ Im Flow (Team)
              </Typography>
              
              {teamTasks.length === 0 ? (
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                  Alles erledigt! Nichts im Flow.
                </Typography>
              ) : (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {teamTasks.map((task) => (
                    <Card key={task.id} sx={{ p: 1.5, cursor: 'pointer', '&:hover': { boxShadow: 2, transform: 'translateY(-2px)' }, transition: 'all 0.2s', borderLeft: '4px solid #1565c0' }} onClick={() => onOpenBoard(task.boardId, task.id, 'team')}>
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

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', bgcolor: '#f3e5f5', border: '1px solid #ce93d8', boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#6a1b9a', fontWeight: 600 }}>
                📋 Meine Projektkarten
              </Typography>

              {projectTasks.length === 0 ? (
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                  Keine Projektkarten zugewiesen.
                </Typography>
              ) : (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {projectTasks.map((task) => (
                    <Card key={task.id} sx={{ p: 1.5, cursor: 'pointer', '&:hover': { boxShadow: 2, transform: 'translateY(-2px)' }, transition: 'all 0.2s', borderLeft: '4px solid #6a1b9a' }} onClick={() => onOpenBoard(task.boardId, task.id, 'standard')}>
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

        {/* ZEILE 2: PERSÖNLICHE NOTIZEN (VOLLE BREITE) */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#fff3e0', border: '1px solid #ffcc80', boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="h6" sx={{ color: '#ef6c00', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        ⭐ Persönliche Top-Themen
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#f57c00' }}>
                        Deine private Merkliste
                    </Typography>
                </Box>
                
                {/* Eingabe direkt oben */}
                <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: '50%' } }}>
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
                    sx={{ bgcolor: 'white', width: 150 }}
                    />
                    <Button variant="contained" color="warning" onClick={addNote} sx={{ minWidth: '40px' }}>
                        <Add />
                    </Button>
                </Box>
              </Box>

              <List dense sx={{ bgcolor: 'white', borderRadius: 2, border: '1px solid #ffe0b2' }}>
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
                            color="warning"
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