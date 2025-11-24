'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  TextField,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  useTheme,
  Collapse
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Dashboard,
  Warning,
  PriorityHigh,
  AccessTime,
  ListAlt,
  Add,
  Delete,
  Event,
  Business,
  InfoOutlined
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';

interface PersonalDashboardProps {
  onOpenBoard: (boardId: string, cardId?: string, boardType?: 'standard' | 'team') => void;
}

// Hilfsfunktion: Text in Such-Tokens zerlegen
const tokenize = (text: any) => {
  if (!text) return [];
  return String(text).toLowerCase().split(/[\s,._-]+/).filter(t => t.length >= 2);
};

export default function PersonalDashboard({ onOpenBoard }: PersonalDashboardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  
  // Daten
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  // Debug-Daten
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  // Interaktionen
  const [newNote, setNewNote] = useState('');
  const [newNoteDate, setNewNoteDate] = useState('');
  
  // Filter State
  const [filters, setFilters] = useState({
    overdue: false,
    critical: false,
    priority: false,
    dueToday: false
  });

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!supabase) return;
      setLoading(true);
      setDebugInfo(null);

      try {
        // 1. User Info
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            if (active) setLoading(false);
            return;
        }
        if (active) setUserId(user.id);

        // 2. Identifikatoren sammeln
        const myIds = new Set<string>([user.id]);
        const myTokens = new Set<string>();
        
        if (user.email) {
            myIds.add(user.email.toLowerCase().trim());
            tokenize(user.email).forEach(t => myTokens.add(t));
        }

        // Profil & Metadaten
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (metaName) {
            tokenize(metaName).forEach(t => myTokens.add(t));
        }

        try {
            const profiles = await fetchClientProfiles();
            const profile = profiles.find(p => p.id === user.id);
            if (profile?.full_name) {
                tokenize(profile.full_name).forEach(t => myTokens.add(t));
            }
        } catch (e) { console.warn('Profile fetch warning', e); }

        const debugTokens = Array.from(myTokens).join(', ');

        // 3. Boards laden
        const { data: boards } = await supabase.from('kanban_boards').select('id, name, settings');
        const bMap: Record<string, any> = {};
        boards?.forEach(b => { 
            const settings = b.settings as Record<string, any> | null;
            bMap[b.id] = { name: b.name, type: settings?.boardType || 'standard' }; 
        });

        // 4. Karten laden (ALLES laden, was nicht archiviert ist)
        // Wir nutzen hier bewusst keine JSON-Filter in der Query, um Typ-Probleme zu umgehen
        const { data: cards, error } = await supabase
          .from('kanban_cards')
          .select('*');

        if (error) throw error;

        if (cards && active) {
          const foundTasks: any[] = [];
          let rawCardCount = 0;
          let ignoredArchivedCount = 0;

          cards.forEach((row) => {
            // Sicherstellen, dass card_data ein Objekt ist
            let d = row.card_data;
            if (typeof d === 'string') {
                try { d = JSON.parse(d); } catch { d = {}; }
            }
            d = d || {};

            if (d.Archived === '1' || d.archived) {
                ignoredArchivedCount++;
                return;
            }
            rawCardCount++;

            const boardInfo = bMap[row.board_id] || { name: 'Unbekannt', type: 'standard' };
            
            let isMine = false;
            
            // --- CHECK 1: Exakte ID-Zuordnung ---
            // Prüfe alle möglichen ID-Felder
            const cardUserIds = [d.userId, d.assigneeId, d.user_id, d.assignee_id].filter(Boolean);
            if (cardUserIds.includes(user.id)) {
                isMine = true;
            }

            // --- CHECK 2: Text-Zuordnung ---
            if (!isMine) {
               // Wir prüfen "Verantwortlich" (Projektboard) und "assignee" (falls Text)
               const candidates = [d.Verantwortlich, d.responsible, d.assigneeName].filter(s => typeof s === 'string');
               
               for (const cand of candidates) {
                   const raw = cand.toLowerCase().trim();
                   // A. Exakter Match (Email/Name)
                   if (myIds.has(raw)) {
                       isMine = true; 
                       break;
                   }
                   // B. Token Match
                   const cardTokens = tokenize(raw);
                   if (cardTokens.some(t => myTokens.has(t))) {
                       isMine = true;
                       break;
                   }
               }
            }

            if (isMine) {
               const isTeamBoard = d.type === 'teamTask' || boardInfo.type === 'team';
               if (isTeamBoard && d.status === 'done') return;

               const rawDate = d['Due Date'] || d.dueDate || d.target_date;
               const dueDate = rawDate ? String(rawDate).split('T')[0] : null;

               const isCritical = 
                    (d.Ampel && String(d.Ampel).toLowerCase().includes('rot')) || 
                    ['LK', 'SK'].includes(String(d.Eskalation || '').toUpperCase()) ||
                    (d.important === true);

               const isPriority = 
                    (toBoolean(d.Priorität)) || 
                    (d.important === true);

               foundTasks.push({
                   id: row.card_id,
                   title: d.Nummer ? `${d.Nummer} ${d.Teil}` : (d.description || 'Aufgabe'),
                   boardName: boardInfo.name,
                   boardId: row.board_id,
                   dueDate,
                   type: isTeamBoard ? 'team' : 'standard',
                   isCritical,
                   isPriority,
                   originalData: d
               });
            }
          });

          setAllTasks(foundTasks);
          
          // Debug-Info setzen, falls keine Tasks gefunden wurden
          if (foundTasks.length === 0 && rawCardCount > 0) {
              setDebugInfo(`Datenbank: ${rawCardCount} aktive Karten geprüft. Keine Treffer für User-ID "${user.id}" oder Tokens: [${debugTokens}].`);
          }
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
        setDebugInfo(`Fehler beim Laden: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [supabase]);

  const kpis = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      return {
          total: allTasks.length,
          overdue: allTasks.filter(t => t.dueDate && t.dueDate < today).length,
          dueToday: allTasks.filter(t => t.dueDate === today).length,
          critical: allTasks.filter(t => t.isCritical).length,
          priority: allTasks.filter(t => t.isPriority).length
      };
  }, [allTasks]);

  const getFilteredTasks = (type: 'team' | 'standard') => {
      const today = new Date().toISOString().split('T')[0];
      return allTasks.filter(t => {
          if (t.type !== type) return false;
          if (filters.overdue && (!t.dueDate || t.dueDate >= today)) return false;
          if (filters.critical && !t.isCritical) return false;
          if (filters.priority && !t.isPriority) return false;
          if (filters.dueToday && t.dueDate !== today) return false;
          return true;
      });
  };

  const teamTasks = getFilteredTasks('team');
  const projectTasks = getFilteredTasks('standard');

  const markTaskAsDone = async (task: any, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!supabase) return;
    setAllTasks(prev => prev.filter(t => t.id !== task.id));
    try {
        const { originalData } = task;
        const assignee = originalData.assigneeId || userId; 
        const newStage = `team|${assignee}|done`;
        const updatedCardData = { ...originalData, status: 'done', assigneeId: assignee };
        
        await supabase.from('kanban_cards')
            .update({ stage: newStage, card_data: updatedCardData, updated_at: new Date().toISOString() })
            .eq('card_id', task.id);
        enqueueSnackbar('Erledigt!', { variant: 'success' });
    } catch (err) {
        console.error(err);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !supabase) return;
    const { data } = await supabase.from('personal_notes').insert({ user_id: userId, content: newNote, due_date: newNoteDate || null }).select().single();
    if (data) { setNotes([...notes, data]); setNewNote(''); setNewNoteDate(''); }
  };
  const toggleNote = async (id: string, current: boolean) => {
    if (!supabase) return;
    await supabase.from('personal_notes').update({ is_done: !current }).eq('id', id);
    setNotes(notes.map(n => n.id === id ? { ...n, is_done: !current } : n));
  };
  const deleteNote = async (id: string) => {
    if (!supabase) return;
    await supabase.from('personal_notes').delete().eq('id', id);
    setNotes(notes.filter(n => n.id !== id));
  };

  function toBoolean(value: any) {
    return value === true || value === 'true';
  }

  if (loading) return <LinearProgress sx={{ mt: 4 }} />;

  return (
    <Box sx={{ mt: 4, mb: 6 }}>
      {/* Debug Info Box - Nur sichtbar wenn Probleme auftreten */}
      {debugInfo && (
          <Alert severity="warning" icon={<InfoOutlined />} sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight="bold">Diagnose-Modus:</Typography>
              {debugInfo}
              <Button size="small" onClick={() => setDebugInfo(null)} sx={{ display: 'block', mt: 1 }}>Ausblenden</Button>
          </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Dashboard /> Mein Cockpit
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip icon={<Warning fontSize="small" />} label="Überfällig" size="small" clickable color={filters.overdue ? "error" : "default"} variant={filters.overdue ? "filled" : "outlined"} onClick={() => setFilters(f => ({...f, overdue: !f.overdue}))} />
            <Chip icon={<PriorityHigh fontSize="small" />} label="Kritisch" size="small" clickable color={filters.critical ? "warning" : "default"} variant={filters.critical ? "filled" : "outlined"} onClick={() => setFilters(f => ({...f, critical: !f.critical}))} />
            <Chip icon={<AccessTime fontSize="small" />} label="Heute" size="small" clickable color={filters.dueToday ? "info" : "default"} variant={filters.dueToday ? "filled" : "outlined"} onClick={() => setFilters(f => ({...f, dueToday: !f.dueToday}))} />
        </Box>
      </Box>

      {/* KPI Leiste */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: 'background.paper', borderLeft: `4px solid ${theme.palette.primary.main}` }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="text.secondary">Offene Aufgaben</Typography>
                      <Typography variant="h4" fontWeight="bold">{kpis.total}</Typography>
                  </CardContent>
              </Card>
          </Grid>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: kpis.overdue > 0 ? '#fff5f5' : 'background.paper', borderLeft: '4px solid #d32f2f' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="text.secondary">Überfällig</Typography>
                      <Typography variant="h4" fontWeight="bold" color={kpis.overdue > 0 ? 'error.main' : 'text.primary'}>{kpis.overdue}</Typography>
                  </CardContent>
              </Card>
          </Grid>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: kpis.critical > 0 ? '#fff8e1' : 'background.paper', borderLeft: '4px solid #ed6c02' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="text.secondary">Kritisch / Eskaliert</Typography>
                      <Typography variant="h4" fontWeight="bold" color={kpis.critical > 0 ? 'warning.main' : 'text.primary'}>{kpis.critical}</Typography>
                  </CardContent>
              </Card>
          </Grid>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: kpis.dueToday > 0 ? '#e3f2fd' : 'background.paper', borderLeft: '4px solid #0288d1' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="text.secondary">Heute fällig</Typography>
                      <Typography variant="h4" fontWeight="bold" color={kpis.dueToday > 0 ? 'info.main' : 'text.primary'}>{kpis.dueToday}</Typography>
                  </CardContent>
              </Card>
          </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* TEAM AUFGABEN */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment color="primary" /> Team-Aufgaben
              </Typography>
              {teamTasks.length === 0 ? (
                <Alert severity="info" icon={false} sx={{ mt: 2 }}>Keine Team-Aufgaben.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {teamTasks.map((task, i) => (
                    <Card key={task.id + i} variant="outlined" sx={{ p: 2, cursor: 'pointer', borderLeft: task.isCritical ? '4px solid #ed6c02' : (task.isPriority ? '4px solid #d32f2f' : '1px solid #eee'), '&:hover': { borderColor: 'primary.main' } }} onClick={() => onOpenBoard(task.boardId, task.id, 'team')}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{task.title}</Typography>
                        <IconButton size="small" color="success" onClick={(e) => markTaskAsDone(task, e)} sx={{ mt: -1, mr: -1 }}><CheckCircle fontSize="small" /></IconButton>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                           <Chip label={task.boardName} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                           {task.dueDate && <Typography variant="caption" color={new Date(task.dueDate) < new Date() ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 500 }}>📅 {new Date(task.dueDate).toLocaleDateString('de-DE')}</Typography>}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* PROJEKT KARTEN */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Business color="secondary" /> Projekt-Karten
              </Typography>
              {projectTasks.length === 0 ? (
                <Alert severity="info" icon={false} sx={{ mt: 2 }}>Keine Projekt-Karten.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {projectTasks.map((task, i) => (
                    <Card key={task.id + i} variant="outlined" sx={{ p: 2, cursor: 'pointer', borderLeft: task.isCritical ? '4px solid #ed6c02' : '1px solid #eee', '&:hover': { borderColor: 'secondary.main' } }} onClick={() => onOpenBoard(task.boardId, task.id, 'standard')}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{task.title}</Typography>
                        {task.stage && <Chip label={task.stage} size="small" sx={{ height: 20, fontSize: '0.6rem' }} />}
                      </Box>
                      <Box sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{task.boardName}</Typography></Box>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* NOTIZEN */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><ListAlt color="action" /> Notizen</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField size="small" placeholder="Neu..." fullWidth value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                  <IconButton color="primary" onClick={addNote} disabled={!newNote.trim()}><Add /></IconButton>
              </Box>
              <List dense sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                {notes.map((note) => (
                  <ListItem key={note.id} secondaryAction={<IconButton edge="end" size="small" onClick={() => deleteNote(note.id)}><Delete fontSize="small" /></IconButton>}>
                        <Checkbox checked={note.is_done} onChange={() => toggleNote(note.id, note.is_done)} size="small" />
                        <ListItemText primary={<Typography sx={{ fontSize: '0.9rem', textDecoration: note.is_done ? 'line-through' : 'none', opacity: note.is_done ? 0.6 : 1 }}>{note.content}</Typography>} />
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