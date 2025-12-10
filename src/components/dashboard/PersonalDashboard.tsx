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
  LinearProgress,
  Alert,
  TextField,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  Avatar,
  Paper,
  Tooltip
} from '@mui/material';
import {
  Assignment,
  Dashboard as DashboardIcon,
  Warning,
  PriorityHigh,
  AccessTime,
  ListAlt,
  Add,
  Delete,
  Business,
  DoneAll,
  TrendingUp,
  Event,
  NotificationsActive
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { pb } from '@/lib/pocketbase';
// import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { useLanguage } from '@/contexts/LanguageContext';

interface PersonalDashboardProps {
  onOpenBoard: (boardId: string, cardId?: string, boardType?: 'standard' | 'team') => void;
}

export default function PersonalDashboard({ onOpenBoard }: PersonalDashboardProps) {
  // const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const theme = useTheme();
  const { t } = useLanguage();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);

  // UI State
  const [mobileTab, setMobileTab] = useState(0);
  const [newNote, setNewNote] = useState('');

  // Filter State
  const [filters, setFilters] = useState({
    overdue: false,
    critical: false,
    priority: false,
    watch: false,
    dueToday: false
  });

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const user = pb.authStore.model;
        if (!user) { if (active) setLoading(false); return; }
        if (active) setUserId(user.id);

        // 1. Identitäten sammeln (ID, Email, Voller Name)
        const myIds = new Set<string>();
        myIds.add(user.id);
        if (user.email) myIds.add(user.email.toLowerCase().trim());
        // PB user model uses 'name' or passed in user_metadata equivalent fields
        const metaName = user.name || (user as any).full_name;
        if (metaName) myIds.add(String(metaName).toLowerCase().trim());

        try {
          const profiles = await fetchClientProfiles();
          const profile = profiles.find(p => p.id === user.id);
          if (profile?.full_name) myIds.add(profile.full_name.toLowerCase().trim());
        } catch (e) { console.warn('Profile fetch warning', e); }

        // Boards laden für Namen
        const boards = await pb.collection('kanban_boards').getFullList({ fields: 'id,name,settings' });
        const bMap: Record<string, any> = {};
        boards.forEach((b: any) => {
          const settings = b.settings as Record<string, any> | null;
          bMap[b.id] = { name: b.name, type: settings?.boardType || 'standard' };
        });

        const cards = await pb.collection('kanban_cards').getFullList();

        if (cards && active) {
          const foundTasks: any[] = [];

          cards.forEach((row: any) => {
            let d = row.card_data;
            // PB usually returns JSON object for JSON fields, but checking just in case
            if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
            d = d || {};
            if (d.Archived === '1' || d.archived) return;

            const boardInfo = bMap[row.board_id] || { name: t('kanban.unknown'), type: 'standard' };
            let isMine = false;

            // A) Strikter ID Check (Sicherste Methode)
            const cardUserIds = [d.userId, d.assigneeId, d.user_id, d.assignee_id].filter(Boolean);
            if (cardUserIds.includes(user.id)) {
              isMine = true;
            }
            // B) Fallback: Namens-Match (Nur wenn keine ID da ist)
            else if (cardUserIds.length === 0) {
              const candidates = [d.Verantwortlich, d.responsible, d.assigneeName].filter(s => typeof s === 'string');
              for (const cand of candidates) {
                const raw = cand.toLowerCase().trim();
                if (myIds.has(raw)) { isMine = true; break; }
                if (metaName && raw.includes(metaName.toLowerCase().trim())) { isMine = true; break; }
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
                id: row.card_id || row.id, // Using row.id if card_id is missing? Scheme says card_id exists.
                rowId: row.id, // KEEP ROW ID for updates
                title: d.Nummer ? `${d.Nummer} ${d.Teil}` : (d.description || t('dashboard.task')),
                boardName: boardInfo.name, boardId: row.board_id, dueDate,
                type: isTeamBoard ? 'team' : 'standard', isCritical, isPriority, isWatch, stage: d['Board Stage'], originalData: d
              });
            }
          });
          setAllTasks(foundTasks);
        }

        // Personal Notes
        const myNotes = await pb.collection('personal_notes').getFullList({
          filter: `user_id = "${user.id}"`,
          sort: 'is_done,due_date'
        });
        if (active) setNotes(myNotes || []);

      } catch (err) {
        console.error(err);
      } finally { if (active) setLoading(false); }
    };
    loadData();
    return () => { active = false; };
  }, []);

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
    setAllTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      const { originalData, rowId } = task; // Ensure rowId is available from loadData
      const assignee = originalData.assigneeId || userId;

      // If we don't have rowId for some reason (old state), we might be in trouble, but loadData provides it.
      // Supabase used .eq('card_id', task.id). PB update needs record ID.
      // If task.rowId is missing, we can't easily update by card_id without a filter query or fetch.
      // Assuming loadData is running and populating rowId.
      const targetId = rowId || task.id; // Fallback might fail if task.id is not record ID.

      await pb.collection('kanban_cards').update(targetId, {
        stage: 'Fertig',
        card_data: { ...originalData, status: 'done', assigneeId: assignee, "Board Stage": "Fertig" },
        // updated_at is auto-handled by PB usually, but we can rely on system field 'updated'
      });
      enqueueSnackbar(t('dashboard.doneMessage'), { variant: 'success' });
    } catch (err) { console.error(err); }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const data = await pb.collection('personal_notes').create({ user_id: userId, content: newNote });
      if (data) { setNotes([...notes, data]); setNewNote(''); }
    } catch (e) { console.error(e); }
  };

  const toggleNote = async (id: string, current: boolean) => {
    try {
      const updated = await pb.collection('personal_notes').update(id, { is_done: !current });
      setNotes(notes.map(n => n.id === id ? updated : n));
    } catch (e) { console.error(e); }
  };

  const deleteNote = async (id: string) => {
    try {
      await pb.collection('personal_notes').delete(id);
      setNotes(notes.filter(n => n.id !== id));
    } catch (e) { console.error(e); }
  };

  function toBoolean(value: any) { return value === true || value === 'true'; }

  // --- RENDER HELPER ---

  const renderKPICard = (title: string, value: number, icon: React.ReactNode, color: 'primary' | 'error' | 'warning' | 'info', active: boolean, onClick?: () => void) => (
    <Card
      className="glass"
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `4px solid ${theme.palette[color].main}`,
        transition: 'all 0.2s',
        transform: active ? 'scale(1.02)' : 'none',
        boxShadow: active ? `0 0 20px ${theme.palette[color].main}40` : undefined
      }}
      onClick={onClick}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, '&:last-child': { pb: 2 } }}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: value > 0 ? theme.palette[color].main : 'text.primary' }}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: `${theme.palette[color].main}20`, color: theme.palette[color].main, width: 48, height: 48 }}>
          {icon}
        </Avatar>
      </CardContent>
    </Card>
  );

  const renderTaskList = (title: string, icon: React.ReactNode, tasks: any[], type: 'team' | 'standard') => (
    <Paper className="glass" sx={{ height: '100%', maxHeight: 600, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: type === 'team' ? 'primary.main' : 'secondary.main' }}>
          {icon}
        </Avatar>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
        <Chip label={tasks.length} size="small" sx={{ ml: 'auto', fontWeight: 700 }} />
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {tasks.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: 1 }}>
            <DoneAll sx={{ fontSize: 40 }} />
            <Typography variant="body2">{t('dashboard.allDone')}</Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {tasks.map((task, i) => (
              <Card
                key={task.id + i}
                variant="outlined"
                sx={{
                  p: 1.5, // Reduced padding
                  cursor: 'pointer',
                  borderLeft: task.isCritical ? '4px solid #ef4444' : (task.isPriority ? '4px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)'),
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', transform: 'translateX(4px)' },
                  transition: 'all 0.2s'
                }}
                onClick={() => onOpenBoard(task.boardId, task.id, type)}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={task.boardName}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.6rem',
                      height: 16,
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      fontWeight: 700,
                      maxWidth: '60%',
                      px: 0.5
                    }}
                  />
                  {task.dueDate && (
                    <Chip
                      icon={<Event sx={{ fontSize: '10px !important' }} />}
                      label={new Date(task.dueDate).toLocaleDateString('de-DE')}
                      size="small"
                      color={new Date(task.dueDate) < new Date() ? 'error' : 'default'}
                      variant={new Date(task.dueDate) < new Date() ? 'filled' : 'outlined'}
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  )}
                </Box>
                <Tooltip title={task.title} placement="top-start" enterDelay={500}>
                  <Typography variant="body2" sx={{
                    fontWeight: 500,
                    lineHeight: 1.2,
                    fontSize: '0.8rem',
                    mb: 0.5,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    // minHeight removed for compactness
                  }}>
                    {task.title}
                  </Typography>
                </Tooltip>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {task.isWatch && <AccessTime sx={{ fontSize: 14, color: 'info.main' }} />}
                    {task.isCritical && <Warning sx={{ fontSize: 14, color: 'error.main' }} />}
                  </Box>
                  {/* "Done" Button ONLY for Team Tasks */}
                  {type === 'team' && (
                    <IconButton
                      size="small"
                      color="success"
                      onClick={(e) => markTaskAsDone(task, e)}
                      sx={{
                        p: 0.5,
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' }
                      }}
                    >
                      <DoneAll sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </Paper>
  );

  const renderNotes = () => (
    <Paper className="glass" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.main' }}><ListAlt /></Avatar>
        <Typography variant="h6" fontWeight={600}>{t('dashboard.notes')}</Typography>
      </Box>
      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            size="small"
            placeholder={t('dashboard.newNotePlaceholder')}
            fullWidth
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
          />
          <IconButton
            color="primary"
            onClick={addNote}
            disabled={!newNote.trim()}
            sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <Add />
          </IconButton>
        </Box>
        <List dense sx={{ bgcolor: 'transparent' }}>
          {notes.map((note) => (
            <ListItem
              key={note.id}
              secondaryAction={<IconButton edge="end" size="small" onClick={() => deleteNote(note.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><Delete fontSize="small" /></IconButton>}
              sx={{
                bgcolor: 'background.paper',
                mb: 1,
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
              }}
            >
              <Checkbox
                checked={note.is_done}
                onChange={() => toggleNote(note.id, note.is_done)}
                size="small"
                sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'success.main' } }}
              />
              <ListItemText
                primary={
                  <Typography sx={{
                    fontSize: '0.95rem',
                    textDecoration: note.is_done ? 'line-through' : 'none',
                    color: note.is_done ? 'text.secondary' : 'text.primary',
                    transition: 'all 0.2s'
                  }}>
                    {note.content}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  );

  if (loading) return <LinearProgress sx={{ mt: 4, borderRadius: 4 }} />;

  return (
    <Box sx={{ mt: 2, mb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            {t('dashboard.welcome')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.overview')}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Chip
            icon={<Warning sx={{ fontSize: 16 }} />}
            label={t('dashboard.overdue')}
            clickable
            color={filters.overdue ? "error" : "default"}
            variant={filters.overdue ? "filled" : "outlined"}
            onClick={() => setFilters(f => ({ ...f, overdue: !f.overdue }))}
          />
          <Chip
            icon={<PriorityHigh sx={{ fontSize: 16 }} />}
            label={t('dashboard.critical')}
            clickable
            color={filters.critical ? "warning" : "default"}
            variant={filters.critical ? "filled" : "outlined"}
            onClick={() => setFilters(f => ({ ...f, critical: !f.critical }))}
          />
        </Stack>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          {renderKPICard(t('dashboard.openTasks'), kpis.total, <TrendingUp />, "primary", false)}
        </Grid>
        <Grid item xs={6} md={3}>
          {renderKPICard(t('dashboard.overdue'), kpis.overdue, <Warning />, "error", filters.overdue, () => setFilters(f => ({ ...f, overdue: !f.overdue })))}
        </Grid>
        <Grid item xs={6} md={3}>
          {renderKPICard(t('dashboard.critical'), kpis.critical, <PriorityHigh />, "warning", filters.critical, () => setFilters(f => ({ ...f, critical: !f.critical })))}
        </Grid>
        <Grid item xs={6} md={3}>
          {renderKPICard(t('dashboard.dueToday'), kpis.dueToday, <NotificationsActive />, "info", filters.dueToday, () => setFilters(f => ({ ...f, dueToday: !f.dueToday })))}
        </Grid>
      </Grid>

      {isMobile ? (
        <Box>
          <Tabs
            value={mobileTab}
            onChange={(e, v) => setMobileTab(v)}
            variant="fullWidth"
            sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: 2 }}
          >
            <Tab icon={<Assignment fontSize="small" />} label={t('dashboard.team')} />
            <Tab icon={<Business fontSize="small" />} label={t('dashboard.projects')} />
            <Tab icon={<ListAlt fontSize="small" />} label={t('dashboard.notes')} />
          </Tabs>
          <Box sx={{ minHeight: 400 }}>
            {mobileTab === 0 && renderTaskList(t('dashboard.teamTasks'), <Assignment />, teamTasks, 'team')}
            {mobileTab === 1 && renderTaskList(t('dashboard.projectCards'), <Business />, projectTasks, 'standard')}
            {mobileTab === 2 && renderNotes()}
          </Box>
        </Box>
      ) : (
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} md={4}>
            {renderTaskList(t('dashboard.teamTasks'), <Assignment />, teamTasks, 'team')}
          </Grid>
          <Grid item xs={12} md={4}>
            {renderTaskList(t('dashboard.projectCards'), <Business />, projectTasks, 'standard')}
          </Grid>
          <Grid item xs={12} md={4}>
            {renderNotes()}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}