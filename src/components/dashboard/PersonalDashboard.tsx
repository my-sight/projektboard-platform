'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Stack, IconButton, Tooltip, LinearProgress, Alert, TextField, Checkbox, List, ListItem, ListItemText, Button, Divider, useTheme, useMediaQuery, Tabs, Tab
} from '@mui/material';
import {
  Assignment, CheckCircle, Dashboard, Warning, PriorityHigh, AccessTime, ListAlt, Add, Delete, Business, InfoOutlined, DoneAll
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';

interface PersonalDashboardProps {
  onOpenBoard: (boardId: string, cardId?: string, boardType?: 'standard' | 'team') => void;
}

const tokenize = (text: any) => {
  if (!text) return [];
  return String(text).toLowerCase().split(/[\s,._-]+/).filter(t => t.length >= 2);
};

export default function PersonalDashboard({ onOpenBoard }: PersonalDashboardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); 
  
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  const [mobileTab, setMobileTab] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [filters, setFilters] = useState({ overdue: false, critical: false, priority: false, watch: false, dueToday: false });

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!supabase) return;
      setLoading(true);
      setDebugInfo(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (active) setLoading(false); return; }
        if (active) setUserId(user.id);

        const myIds = new Set<string>([user.id]);
        const myTokens = new Set<string>();
        if (user.email) { myIds.add(user.email.toLowerCase().trim()); tokenize(user.email).forEach(t => myTokens.add(t)); }
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (metaName) tokenize(metaName).forEach(t => myTokens.add(t));

        try {
            const profiles = await fetchClientProfiles();
            const profile = profiles.find(p => p.id === user.id);
            if (profile?.full_name) tokenize(profile.full_name).forEach(t => myTokens.add(t));
        } catch (e) { console.warn('Profile fetch warning', e); }

        const { data: boards } = await supabase.from('kanban_boards').select('id, name, settings');
        const bMap: Record<string, any> = {};
        boards?.forEach(b => { 
            const settings = b.settings as Record<string, any> | null;
            bMap[b.id] = { name: b.name, type: settings?.boardType || 'standard' }; 
        });

        const { data: cards, error } = await supabase.from('kanban_cards').select('*');
        if (error) throw error;

        if (cards && active) {
          const foundTasks: any[] = [];
          cards.forEach((row) => {
            let d = row.card_data;
            if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
            d = d || {};
            if (d.Archived === '1' || d.archived) return;

            const boardInfo = bMap[row.board_id] || { name: 'Unbekannt', type: 'standard' };
            let isMine = false;
            const cardUserIds = [d.userId, d.assigneeId, d.user_id, d.assignee_id].filter(Boolean);
            if (cardUserIds.includes(user.id)) isMine = true;

            if (!isMine) {
               const candidates = [d.Verantwortlich, d.responsible, d.assigneeName].filter(s => typeof s === 'string');
               for (const cand of candidates) {
                   const raw = cand.toLowerCase().trim();
                   if (myIds.has(raw)) { isMine = true; break; }
                   const cardTokens = tokenize(raw);
                   if (cardTokens.some(t => myTokens.has(t))) { isMine = true; break; }
               }
            }

            if (isMine) {
               const isTeamBoard = d.type === 'teamTask' || boardInfo.type === 'team';
               if (isTeamBoard && d.status === 'done') return;

               const rawDate = d['Due Date'] || d.dueDate || d.target_date;
               const dueDate = rawDate ? String(rawDate).split('T')[0] : null;
               const isCritical = (d.Ampel && String(d.Ampel).toLowerCase().includes('rot')) || ['Y', 'R', 'LK', 'SK'].includes(String(d.Eskalation || '').toUpperCase());
               const isPriority = (toBoolean(d.Priorität)) || (d.important === true);
               const isWatch = (d.watch === true);

               foundTasks.push({
                   id: row.card_id, title: d.Nummer ? `${d.Nummer} ${d.Teil}` : (d.description || 'Aufgabe'),
                   boardName: boardInfo.name, boardId: row.board_id, dueDate,
                   type: isTeamBoard ? 'team' : 'standard', isCritical, isPriority, isWatch, stage: d['Board Stage'], originalData: d
               });
            }
          });
          setAllTasks(foundTasks);
        }
        const { data: myNotes } = await supabase.from('personal_notes').select('*').eq('user_id', user.id).order('is_done', { ascending: true }).order('due_date', { ascending: true });
        if (active) setNotes(myNotes || []);
      } catch (err) { console.error(err); } finally { if (active) setLoading(false); }
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
          priority: allTasks.filter(t => t.isPriority).length,
          watch: allTasks.filter(t => t.isWatch).length
      };
  }, [allTasks]);

  const getFilteredTasks = (type: 'team' | 'standard') => {
      const today = new Date().toISOString().split('T')[0];
      return allTasks.filter(t => {
          if (t.type !== type) return false;
          if (filters.overdue && (!t.dueDate || t.dueDate >= today)) return false;
          if (filters.critical && !t.isCritical) return false;
          if (filters.priority && !t.isPriority) return false;
          if (filters.watch && !t.isWatch) return false;
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
        // WICHTIG: Update auch 'stage' in DB für Projekt-Board Sync
        await supabase.from('kanban_cards').update({ 
            stage: 'Fertig', 
            card_data: { ...originalData, status: 'done', assigneeId: assignee, "Board Stage": "Fertig" }, 
            updated_at: new Date().toISOString() 
        }).eq('card_id', task.id);
        enqueueSnackbar('Erledigt!', { variant: 'success' });
    } catch (err) { console.error(err); }
  };

  const addNote = async () => {
    if (!newNote.trim() || !supabase) return;
    const { data } = await supabase.from('personal_notes').insert({ user_id: userId, content: newNote }).select().single();
    if (data) { setNotes([...notes, data]); setNewNote(''); }
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
  
  function toBoolean(value: any) { return value === true || value === 'true'; }

  const renderTeamTasks = () => (
      <Card variant="outlined" sx={{ height: '100%', borderRadius: 1, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)' }}>
        <Box sx={{ p: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
             <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.1rem' }}>
                <Assignment color="primary" /> Team-Aufgaben
              </Typography>
        </Box>
        <CardContent sx={{ px: 2, pt: 2, pb: 1, flex: 1, overflowY: 'auto' }}>
          {teamTasks.length === 0 ? (
            <Alert severity="info" icon={false}>Keine offenen Aufgaben.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {teamTasks.map((task, i) => (
                <Card key={task.id + i} variant="outlined" sx={{ p: 2, borderRadius: 1, cursor: 'pointer', borderLeft: task.isCritical ? '4px solid #ed6c02' : (task.isPriority ? '4px solid #d32f2f' : '1px solid #eee'), '&:hover': { borderColor: 'primary.main' }, position:'relative' }} onClick={() => onOpenBoard(task.boardId, task.id, 'team')}>
                  {/* Icons Top Right */}
                  <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5, zIndex: 10 }}>
                      {task.isWatch && <AccessTime sx={{ fontSize: 16, color: 'primary.main' }} />}
                      <IconButton size="small" color="success" onClick={(e) => markTaskAsDone(task, e)} sx={{ p: 0 }}>
                          <DoneAll sx={{ fontSize: 16 }} />
                      </IconButton>
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3, mr: 4, display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                        {task.title}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                       <Chip label={task.boardName} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                       {task.dueDate && <Typography variant="caption" color={new Date(task.dueDate) < new Date() ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 500 }}>📅 {new Date(task.dueDate).toLocaleDateString('de-DE')}</Typography>}
                    </Stack>
                  </Box>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
  );

  const renderProjectTasks = () => (
      <Card variant="outlined" sx={{ height: '100%', borderRadius: 1, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)' }}>
        <Box sx={{ p: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.1rem' }}>
                <Business color="secondary" /> Projekt-Karten
              </Typography>
        </Box>
        <CardContent sx={{ px: 2, pt: 2, pb: 1, flex: 1, overflowY: 'auto' }}>
          {projectTasks.length === 0 ? (
            <Alert severity="info" icon={false}>Keine Projekt-Karten.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {projectTasks.map((task, i) => (
                <Card key={task.id + i} variant="outlined" sx={{ p: 2, borderRadius: 1, cursor: 'pointer', borderLeft: task.isCritical ? '4px solid #ed6c02' : '1px solid #eee', '&:hover': { borderColor: 'secondary.main' }, position:'relative' }} onClick={() => onOpenBoard(task.boardId, task.id, 'standard')}>
                   {/* Icons Top Right */}
                   <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5, zIndex: 10 }}>
                      {task.isWatch && <AccessTime sx={{ fontSize: 16, color: 'primary.main' }} />}
                      {/* Auch Projektkarten schnell erledigen */}
                      <IconButton size="small" color="success" onClick={(e) => markTaskAsDone(task, e)} sx={{ p: 0 }}>
                          <DoneAll sx={{ fontSize: 16 }} />
                      </IconButton>
                   </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 4, display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                        {task.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {task.stage && <Chip label={task.stage} size="small" sx={{ height: 20, fontSize: '0.6rem' }} />}
                        <Typography variant="caption" color="text.secondary">{task.boardName}</Typography>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
  );

  // ... renderNotes (bleibt gleich) ...
  const renderNotes = () => (
      <Card variant="outlined" sx={{ borderRadius: 1, height: '100%', border: 'none', boxShadow: 'none', bgcolor: 'transparent' }}>
        <CardContent sx={{ px: isMobile ? 0 : 2 }}>
          {!isMobile && (
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><ListAlt color="action" /> Notizen</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField 
                  size="small" 
                  placeholder="Neue Notiz..." 
                  fullWidth 
                  value={newNote} 
                  onChange={(e) => setNewNote(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && addNote()} 
              />
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
  );

  if (loading) return <LinearProgress sx={{ mt: 4 }} />;

  return (
    <Box sx={{ mt: 2, mb: 6 }}>
      {debugInfo && <Alert severity="warning" icon={<InfoOutlined />} sx={{ mb: 3 }} onClose={() => setDebugInfo(null)}>{debugInfo}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Dashboard /> {isMobile ? "Cockpit" : "Mein Cockpit"}
        </Typography>
        
        {/* Compact Filters */}
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, maxWidth: isMobile ? '200px' : 'auto' }}>
            <Chip icon={<Warning sx={{ fontSize: 16 }} />} label={isMobile ? "" : "Überfällig"} size="small" clickable color={filters.overdue ? "error" : "default"} variant={filters.overdue ? "filled" : "outlined"} onClick={() => setFilters(f => ({...f, overdue: !f.overdue}))} />
            <Chip icon={<PriorityHigh sx={{ fontSize: 16 }} />} label={isMobile ? "" : "Kritisch"} size="small" clickable color={filters.critical ? "warning" : "default"} variant={filters.critical ? "filled" : "outlined"} onClick={() => setFilters(f => ({...f, critical: !f.critical}))} />
            <Chip icon={<AccessTime sx={{ fontSize: 16 }} />} label={isMobile ? "" : "Watch"} size="small" clickable color={filters.watch ? "info" : "default"} variant={filters.watch ? "filled" : "outlined"} onClick={() => setFilters(f => ({...f, watch: !f.watch}))} />
        </Box>
      </Box>

      {/* KPI Leiste */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: 'background.paper', borderLeft: `4px solid ${theme.palette.primary.main}`, borderRadius: 1 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Offen</Typography>
                      <Typography variant="h5" fontWeight="bold">{kpis.total}</Typography>
                  </CardContent>
              </Card>
          </Grid>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: kpis.overdue > 0 ? '#fff5f5' : 'background.paper', borderLeft: '4px solid #d32f2f', borderRadius: 1 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Fällig</Typography>
                      <Typography variant="h5" fontWeight="bold" color={kpis.overdue > 0 ? 'error.main' : 'text.primary'}>{kpis.overdue}</Typography>
                  </CardContent>
              </Card>
          </Grid>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: kpis.critical > 0 ? '#fff8e1' : 'background.paper', borderLeft: '4px solid #ed6c02', borderRadius: 1 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Kritisch</Typography>
                      <Typography variant="h5" fontWeight="bold" color={kpis.critical > 0 ? 'warning.main' : 'text.primary'}>{kpis.critical}</Typography>
                  </CardContent>
              </Card>
          </Grid>
          <Grid item xs={6} md={3}>
              <Card sx={{ bgcolor: kpis.dueToday > 0 ? '#e3f2fd' : 'background.paper', borderLeft: '4px solid #0288d1', borderRadius: 1 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Heute</Typography>
                      <Typography variant="h5" fontWeight="bold" color={kpis.dueToday > 0 ? 'info.main' : 'text.primary'}>{kpis.dueToday}</Typography>
                  </CardContent>
              </Card>
          </Grid>
      </Grid>

      {/* --- CONTENT AREA (Horizontal Scroll) --- */}
      {isMobile ? (
        <Box>
           <Tabs 
             value={mobileTab} 
             onChange={(e, v) => setMobileTab(v)} 
             variant="fullWidth" 
             sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, bgcolor: 'background.paper', borderRadius: 1 }}
           >
             <Tab icon={<Assignment fontSize="small" />} iconPosition="start" label={`Team (${teamTasks.length})`} />
             <Tab icon={<Business fontSize="small" />} iconPosition="start" label={`Projekte (${projectTasks.length})`} />
             <Tab icon={<ListAlt fontSize="small" />} iconPosition="start" label="Notizen" />
           </Tabs>
           <Box sx={{ minHeight: 300 }}>
             {mobileTab === 0 && renderTeamTasks()}
             {mobileTab === 1 && renderProjectTasks()}
             {mobileTab === 2 && renderNotes()}
           </Box>
        </Box>
      ) : (
        <Box sx={{ 
            display: 'flex', 
            gap: 3, 
            overflowX: 'auto', 
            pb: 2, 
            height: '65vh', 
            scrollSnapType: 'x mandatory',
            '& > *': { scrollSnapAlign: 'start' }
        }}>
          <Box sx={{ minWidth: '400px', flex: 1 }}>{renderTeamTasks()}</Box>
          <Box sx={{ minWidth: '400px', flex: 1 }}>{renderProjectTasks()}</Box>
          <Box sx={{ minWidth: '400px', flex: 1 }}>{renderNotes()}</Box>
        </Box>
      )}
    </Box>
  );
}