'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Avatar,
  Collapse,
  LinearProgress,
  Grid
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  FilterList, 
  Warning, 
  PriorityHigh, 
  ArrowBack, 
  Star, 
  KeyboardArrowDown,
  KeyboardArrowUp,
  CheckCircleOutline,
  AddCircleOutline,
  Delete,
  AccessTime,
  PriorityHigh as PriorityHighIcon,
  Assessment // KPI Icon
} from '@mui/icons-material';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { useSnackbar } from 'notistack';
import { keyframes } from '@mui/system';

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';

// --- Styles & Konstanten ---
const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); border-color: #ffc107; }
  50% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); border-color: #ffc107; background-color: rgba(255, 249, 196, 0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
`;

const COL_WIDTHS = {
    member: '220px',
    flow1: '1fr',
    flow: '1fr',
    done: '1fr'
};

const MIN_CARD_HEIGHT = 80;
const BACKLOG_WIDTH = 320;

// --- Interfaces ---
interface BoardMember { id: string; profile_id: string; }
interface MemberWithProfile extends BoardMember { profile: ClientProfile | null; }
export type TeamBoardStatus = 'backlog' | 'flow1' | 'flow' | 'done';

interface TeamBoardCard { 
    rowId: string; 
    cardId: string; 
    description: string; 
    dueDate: string | null; 
    important: boolean; 
    watch: boolean; 
    assigneeId: string | null; 
    status: TeamBoardStatus; 
    position: number; 
    createdBy?: string; 
}

interface TeamKanbanBoardProps { boardId: string; onExit?: () => void; highlightCardId?: string | null; }
interface TaskDraft { description: string; dueDate: string; important: boolean; watch: boolean; assigneeId: string | null; status: TeamBoardStatus; }
interface DroppableInfo { assigneeId: string | null; status: TeamBoardStatus; }
interface TopTopic { id: string; title: string; calendar_week?: string; due_date?: string; position: number; }

const statusLabels: Record<TeamBoardStatus, string> = { backlog: 'Aufgabenspeicher', flow1: 'Flow-1', flow: 'Flow', done: 'Fertig' };
const defaultDraft: TaskDraft = { description: '', dueDate: '', important: false, watch: false, assigneeId: null, status: 'backlog' };

// --- Helpers ---
const getInitials = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2);
const droppableKey = (assigneeId: string | null, status: TeamBoardStatus) => `team|${assigneeId ?? 'unassigned'}|${status}`;
const parseDroppableKey = (value: string): DroppableInfo => {
  if (!value.startsWith('team|')) return { assigneeId: null, status: 'backlog' };
  const [, rawAssignee, rawStatus] = value.split('|');
  const status = (['backlog', 'flow1', 'flow', 'done'] as TeamBoardStatus[]).includes(rawStatus as TeamBoardStatus) ? (rawStatus as TeamBoardStatus) : 'backlog';
  const assigneeId = rawAssignee === 'unassigned' ? null : rawAssignee;
  return { assigneeId, status };
};

// Data Helpers
const buildCardData = (card: TeamBoardCard) => ({ 
    type: 'teamTask', 
    description: card.description, 
    dueDate: card.dueDate, 
    important: card.important, 
    watch: card.watch, 
    assigneeId: card.assigneeId, 
    status: card.status, 
    createdBy: card.createdBy 
});

const createColumnsMapFromCards = (cards: TeamBoardCard[]) => { const map = new Map<string, TeamBoardCard[]>(); cards.forEach((card) => { const key = droppableKey(card.assigneeId, card.status); const entries = map.get(key) ?? []; entries.push({ ...card }); map.set(key, entries); }); return map; };
const flattenColumnsMap = (map: Map<string, TeamBoardCard[]>) => { const flattened: TeamBoardCard[] = []; Array.from(map.keys()).sort().forEach((key) => { const entries = map.get(key) ?? []; entries.map((entry) => ({ ...entry })).forEach((entry, index) => { flattened.push({ ...entry, position: index }); }); }); return flattened; };
const buildPersistPayload = (boardId: string, cards: TeamBoardCard[]) => cards.map((card) => ({ board_id: boardId, card_id: card.cardId, card_data: buildCardData(card), stage: droppableKey(card.assigneeId, card.status), position: card.position ?? 0, project_number: null, project_name: null }));

const normalizeCard = (row: any): TeamBoardCard | null => {
  const stageInfo = typeof row.stage === 'string' ? parseDroppableKey(row.stage) : { assigneeId: null, status: 'backlog' as TeamBoardStatus };
  const payload = (row.card_data ?? {}) as Record<string, unknown>;
  if (payload && payload.type && payload.type !== 'teamTask' && !String(row.stage || '').startsWith('team|')) return null;
  
  const description = typeof payload.description === 'string' ? payload.description : '';
  const dueDate = typeof payload.dueDate === 'string' && payload.dueDate ? payload.dueDate : null;
  const important = Boolean(payload.important);
  const watch = Boolean(payload.watch);
  const createdBy = typeof payload.createdBy === 'string' ? payload.createdBy : undefined;
  
  let status: TeamBoardStatus = stageInfo.status;
  if (typeof payload.status === 'string' && ['backlog', 'flow1', 'flow', 'done'].includes(payload.status)) status = payload.status as TeamBoardStatus;
  let assigneeId: string | null = stageInfo.assigneeId;
  if (typeof payload.assigneeId === 'string') assigneeId = payload.assigneeId; else if (payload.assigneeId === null) assigneeId = null;
  
  return { 
      rowId: String(row.id), 
      cardId: String(row.card_id ?? row.id ?? crypto.randomUUID()), 
      description, dueDate, important, watch, assigneeId, status, 
      position: typeof row.position === 'number' ? row.position : 0, 
      createdBy 
  };
};

export default function TeamKanbanBoard({ boardId, onExit, highlightCardId }: TeamKanbanBoardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { enqueueSnackbar } = useSnackbar();
  
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [cards, setCards] = useState<TeamBoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canModify, setCanModify] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(defaultDraft);
  const [editingCard, setEditingCard] = useState<TeamBoardCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [dueDateError, setDueDateError] = useState(false);
  const [flowSaving, setFlowSaving] = useState(false);
  const [boardSettings, setBoardSettings] = useState<Record<string, any>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  const [topTopicsOpen, setTopTopicsOpen] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  
  // KPI Dialog State
  const [kpiOpen, setKpiOpen] = useState(false);

  const [filters, setFilters] = useState({
    mine: false,
    overdue: false,
    important: false,
    watch: false
  });

  // --- KPI Calculation ---
  const kpiStats = useMemo(() => {
      const active = cards.filter(c => c.status === 'flow' || c.status === 'flow1');
      const backlog = cards.filter(c => c.status === 'backlog');
      const today = new Date().toISOString().split('T')[0];
      const overdue = cards.filter(c => c.dueDate && c.dueDate < today);
      
      // Workload per Member
      const memberLoad = members.map(m => {
          const count = active.filter(c => c.assigneeId === m.profile_id).length;
          return { 
              name: m.profile?.full_name || m.profile?.email || '?', 
              count,
              avatar: getInitials(m.profile?.full_name || m.profile?.email || '')
          };
      }).sort((a, b) => b.count - a.count);

      return {
          activeCount: active.length,
          backlogCount: backlog.length,
          doneCount: completedCount, // Persistierter Zähler
          overdueCount: overdue.length,
          importantCount: cards.filter(c => c.important).length,
          watchCount: cards.filter(c => c.watch).length,
          memberLoad
      };
  }, [cards, members, completedCount]);

  // --- Data Loading ---
  const persistAllCards = useCallback(async (entries: TeamBoardCard[]) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
      const response = await fetch(`/api/boards/${boardId}/cards`, { method: 'POST', headers, body: JSON.stringify({ cards: buildPersistPayload(boardId, entries) }), credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }, [boardId, supabase]);

  const loadBoardSettings = useCallback(async () => {
    const headers = await buildSupabaseAuthHeaders(supabase);
    const response = await fetch(`/api/boards/${boardId}/settings`, { method: 'GET', headers, credentials: 'include' });
    if (response.status === 404) { setBoardSettings({}); setCompletedCount(0); return; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    setBoardSettings(payload.settings ?? {});
    setCompletedCount(Number(payload.settings?.teamBoard?.completedCount || 0));
  }, [boardId, supabase]);

  const persistCompletedCount = useCallback(async (nextCount: number) => {
      const nextSettings = { ...boardSettings, teamBoard: { ...(boardSettings.teamBoard || {}), completedCount: nextCount } };
      const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
      const response = await fetch(`/api/boards/${boardId}/settings`, { method: 'POST', headers, body: JSON.stringify({ settings: nextSettings }), credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setBoardSettings(nextSettings); setCompletedCount(nextCount);
    }, [boardId, boardSettings, supabase]);

  const loadAllUsers = useCallback(async () => { try { const profiles = await fetchClientProfiles(); setUsers(profiles); return profiles; } catch (err) { return []; } }, []);

  const loadMembers = useCallback(async (availableProfiles: ClientProfile[]) => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('board_members').select('id, profile_id').eq('board_id', boardId).order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data as BoardMember[]) ?? [];
      const mapped = rows.map((entry) => {
          const profile = availableProfiles.find((c) => c.id === entry.profile_id) ?? null;
          return (profile && (profile.is_active ?? true) && !isSuperuserEmail(profile.email)) ? { ...entry, profile } : null;
        }).filter((e): e is MemberWithProfile => Boolean(e));
      setMembers(mapped);
      return mapped;
    }, [boardId, supabase]);

  const loadCards = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('kanban_cards').select('id, card_id, card_data, stage, position').eq('board_id', boardId).order('position', { ascending: true });
    if (error) throw error;
    const normalized = (data ?? []).map(normalizeCard).filter((c): c is TeamBoardCard => !!c);
    normalized.sort((a, b) => { const kA = droppableKey(a.assigneeId, a.status), kB = droppableKey(b.assigneeId, b.status); return kA === kB ? a.position - b.position : kA.localeCompare(kB); });
    setCards(normalized);
  }, [boardId, supabase]);

  const loadTopTopics = useCallback(async () => {
    const { data } = await supabase.from('board_top_topics').select('*').eq('board_id', boardId).order('position');
    if (data) setTopTopics(data);
  }, [boardId, supabase]);

  const evaluatePermissions = useCallback(async (profiles: ClientProfile[], currentMembers: MemberWithProfile[]) => {
      if (!supabase) { setCanModify(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCanModify(false); return; }
      setCurrentUser(user);
      const profile = profiles.find(p => p.id === user.id);
      const role = String(profile?.role || '').toLowerCase();
      const elevated = role === 'admin' || role === 'owner' || role === 'manager' || role === 'superuser' || isSuperuserEmail(user.email || '');
      const member = currentMembers.some(m => m.profile_id === user.id);
      let owns = false, admin = false;
      try { const { data } = await supabase.from('kanban_boards').select('owner_id, board_admin_id').eq('id', boardId).maybeSingle(); if(data) { owns = data.owner_id === user.id; admin = data.board_admin_id === user.id; } } catch {}
      setCanModify(elevated || member || owns || admin);
    }, [boardId, supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadAll = async () => {
      setLoading(true); setError(null);
      try {
        const profiles = await loadAllUsers();
        if (!active) return;
        await loadBoardSettings();
        const mems = await loadMembers(profiles);
        await loadCards();
        await evaluatePermissions(profiles, mems);
        await loadTopTopics();
      } catch (e) { if (active) setError('Fehler beim Laden.'); } finally { if (active) setLoading(false); }
    };
    loadAll();
    return () => { active = false; };
  }, [boardId]);

  // --- Actions ---
  const openCreateDialog = () => { if (!canModify) return; setEditingCard(null); setDraft(defaultDraft); setDueDateError(false); setDialogOpen(true); };
  
  const openQuickAdd = (assigneeId: string, status: TeamBoardStatus) => {
      if (!canModify) return;
      setEditingCard(null);
      setDraft({ ...defaultDraft, assigneeId, status });
      setDueDateError(false);
      setDialogOpen(true);
  };

  const openEditDialog = (card: TeamBoardCard) => { if (!canModify) return; setEditingCard(card); setDraft({ description: card.description, dueDate: card.dueDate ?? '', important: card.important, watch: card.watch, assigneeId: card.assigneeId, status: card.status }); setDueDateError(false); setDialogOpen(true); };
  const closeDialog = () => { if (!saving) { setDialogOpen(false); setEditingCard(null); setDraft(defaultDraft); setDueDateError(false); }};
  const handleDraftChange = (k: keyof TaskDraft, v: any) => { setDraft(p => ({...p, [k]: v})); if(k==='dueDate') setDueDateError(!v); };

  const toggleLaneCollapse = (memberId: string) => {
      setCollapsedLanes(prev => ({...prev, [memberId]: !prev[memberId]}));
  };

  const toggleCardProperty = async (card: TeamBoardCard, property: 'important' | 'watch', e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canModify) return;

      const newValue = !card[property];
      const newCards = cards.map(c => c.cardId === card.cardId ? { ...c, [property]: newValue } : c);
      setCards(newCards);

      try {
          await persistAllCards(newCards);
      } catch (err) {
          setCards(cards);
          enqueueSnackbar('Fehler beim Speichern', { variant: 'error' });
      }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!canModify || !result.destination) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const working = createColumnsMapFromCards(cards);
    const srcList = working.get(source.droppableId) || [];
    const [moved] = srcList.splice(source.index, 1);
    working.set(source.droppableId, srcList);
    const destInfo = parseDroppableKey(destination.droppableId);
    const updated = { ...moved, assigneeId: destInfo.assigneeId, status: destInfo.status };
    const destList = source.droppableId === destination.droppableId ? srcList : (working.get(destination.droppableId) || []);
    destList.splice(destination.index, 0, updated);
    working.set(destination.droppableId, destList);
    const flat = flattenColumnsMap(working);
    setCards(flat);
    try { await persistAllCards(flat); enqueueSnackbar('Aufgabe verschoben', { variant: 'success', autoHideDuration: 1500 }); } catch { setError('Speicherfehler'); loadCards(); }
  };

  const saveTask = async () => {
    if (!draft.description.trim()) { enqueueSnackbar('Beschreibung fehlt', { variant: 'warning' }); return; }
    if (!draft.dueDate) { setDueDateError(true); enqueueSnackbar('Datum fehlt', { variant: 'warning' }); return; }
    if (draft.status !== 'backlog' && !draft.assigneeId) { enqueueSnackbar('Mitglied fehlt', { variant: 'warning' }); return; }
    setSaving(true);
    try {
      const working = createColumnsMapFromCards(cards);
      if (editingCard) {
        const prevKey = droppableKey(editingCard.assigneeId, editingCard.status);
        const prevList = working.get(prevKey) || [];
        const idx = prevList.findIndex(c => c.cardId === editingCard.cardId);
        if (idx !== -1) prevList.splice(idx, 1);
        working.set(prevKey, prevList);
        const updated = { ...editingCard, ...draft };
        const nextKey = droppableKey(updated.assigneeId, updated.status);
        const nextList = prevKey === nextKey ? prevList : (working.get(nextKey) || []);
        nextList.splice(prevKey === nextKey && idx >= 0 ? idx : nextList.length, 0, updated);
        working.set(nextKey, nextList);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const newCard = { rowId: `team-${crypto.randomUUID()}`, cardId: `team-${crypto.randomUUID()}`, ...draft, position: 0, createdBy: user?.id };
        const key = droppableKey(newCard.assigneeId, newCard.status);
        const list = working.get(key) || [];
        list.push(newCard as TeamBoardCard);
        working.set(key, list);
      }
      const flat = flattenColumnsMap(working);
      setCards(flat);
      await persistAllCards(flat);
      enqueueSnackbar('Aufgabe gespeichert', { variant: 'success' });
      closeDialog();
    } catch { enqueueSnackbar('Fehler beim Speichern', { variant: 'error' }); } finally { setSaving(false); }
  };

  const deleteTask = async () => {
    if (!editingCard) return;
    setSaving(true);
    try {
      const working = createColumnsMapFromCards(cards);
      const key = droppableKey(editingCard.assigneeId, editingCard.status);
      const list = working.get(key) || [];
      const idx = list.findIndex(c => c.cardId === editingCard.cardId);
      if (idx !== -1) {
        list.splice(idx, 1);
        working.set(key, list);
        const flat = flattenColumnsMap(working);
        setCards(flat);
        await persistAllCards(flat);
        enqueueSnackbar('Aufgabe gelöscht', { variant: 'success' });
        closeDialog();
      }
    } catch { enqueueSnackbar('Fehler beim Löschen', { variant: 'error' }); } finally { setSaving(false); }
  };

  const handleCompleteFlow = async () => {
    if (!canModify || flowSaving) return;
    const done = cards.filter(c => c.status === 'done');
    if (done.length === 0) return;
    setFlowSaving(true);
    try {
      const remain = cards.filter(c => c.status !== 'done');
      await persistAllCards(remain);
      await persistCompletedCount(completedCount + done.length);
      setCards(remain);
      enqueueSnackbar('Flow abgeschlossen', { variant: 'success' });
    } catch { enqueueSnackbar('Fehler beim Abschließen', { variant: 'error' }); loadCards(); } finally { setFlowSaving(false); }
  };

  // --- KPI DIALOG ---
  const TeamKPIDialog = ({ open, onClose }: any) => (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" /> Team Performance & KPIs
          </DialogTitle>
          <DialogContent dividers>
              <Grid container spacing={3}>
                  {/* Key Metrics */}
                  <Grid item xs={12} sm={4}>
                      <Card variant="outlined" sx={{ textAlign: 'center', height: '100%', bgcolor: 'rgba(25, 118, 210, 0.04)' }}>
                          <CardContent>
                              <Typography variant="h3" color="primary" fontWeight="bold">{kpiStats.activeCount}</Typography>
                              <Typography variant="body2" color="text.secondary">Aktive Aufgaben (Flow)</Typography>
                          </CardContent>
                      </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                      <Card variant="outlined" sx={{ textAlign: 'center', height: '100%', bgcolor: 'rgba(46, 125, 50, 0.04)' }}>
                          <CardContent>
                              <Typography variant="h3" color="success.main" fontWeight="bold">{kpiStats.doneCount}</Typography>
                              <Typography variant="body2" color="text.secondary">Erledigt (Gesamt)</Typography>
                          </CardContent>
                      </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                      <Card variant="outlined" sx={{ textAlign: 'center', height: '100%', bgcolor: kpiStats.overdueCount > 0 ? 'rgba(211, 47, 47, 0.04)' : 'transparent' }}>
                          <CardContent>
                              <Typography variant="h3" color={kpiStats.overdueCount > 0 ? 'error.main' : 'text.secondary'} fontWeight="bold">{kpiStats.overdueCount}</Typography>
                              <Typography variant="body2" color="text.secondary">Überfällig</Typography>
                          </CardContent>
                      </Card>
                  </Grid>

                  {/* Member Workload */}
                  <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                          👥 Auslastung (Aktive Aufgaben)
                      </Typography>
                      <Card variant="outlined">
                          <CardContent>
                              <Stack spacing={2}>
                                  {kpiStats.memberLoad.slice(0, 5).map((m, i) => (
                                      <Box key={i}>
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '0.85rem' }}>
                                              <Stack direction="row" spacing={1} alignItems="center">
                                                  <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem' }}>{m.avatar}</Avatar>
                                                  <span>{m.name}</span>
                                              </Stack>
                                              <strong>{m.count}</strong>
                                          </Box>
                                          <LinearProgress 
                                              variant="determinate" 
                                              value={Math.min(100, (m.count / 5) * 100)} 
                                              color={m.count > 4 ? "error" : "primary"}
                                              sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.05)' }} 
                                          />
                                      </Box>
                                  ))}
                              </Stack>
                          </CardContent>
                      </Card>
                  </Grid>
                  
                  {/* Task Types */}
                   <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                          📊 Status & Backlog
                      </Typography>
                      <Card variant="outlined" sx={{ height: 'fit-content' }}>
                          <CardContent>
                              <Stack spacing={2}>
                                   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid var(--line)', borderRadius: 2 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Warning color="error" fontSize="small" /> Wichtig</Box>
                                      <Typography fontWeight="bold">{kpiStats.importantCount}</Typography>
                                   </Box>
                                   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid var(--line)', borderRadius: 2 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><AccessTime color="primary" fontSize="small" /> Wiedervorlage</Box>
                                      <Typography fontWeight="bold">{kpiStats.watchCount}</Typography>
                                   </Box>
                                   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid var(--line)', borderRadius: 2, bgcolor: 'rgba(0,0,0,0.02)' }}>
                                      <Typography color="text.secondary">Im Backlog</Typography>
                                      <Typography fontWeight="bold">{kpiStats.backlogCount}</Typography>
                                   </Box>
                              </Stack>
                          </CardContent>
                      </Card>
                   </Grid>
              </Grid>
          </DialogContent>
          <DialogActions>
              <Button onClick={onClose}>Schließen</Button>
          </DialogActions>
      </Dialog>
  );

  // Top Themen Dialog
  const TopTopicsDialog = ({ open, onClose }: any) => {
      const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);
      useEffect(() => { setLocalTopics(topTopics); }, [topTopics]);
      const handleSaveTopic = async (index: number, field: string, value: any) => {
          const newTopics = [...localTopics];
          newTopics[index] = { ...newTopics[index], [field]: value };
          setLocalTopics(newTopics);
          if (newTopics[index].id && !newTopics[index].id.startsWith('tmp')) {
              await supabase.from('board_top_topics').update({ [field]: value }).eq('id', newTopics[index].id);
          }
      };
      const handleAdd = async () => {
          const { data } = await supabase.from('board_top_topics').insert({ board_id: boardId, title: '', position: localTopics.length }).select().single();
          if (data) setLocalTopics([...localTopics, data]);
      };
      const handleDelete = async (id: string) => {
          await supabase.from('board_top_topics').delete().eq('id', id);
          setLocalTopics(prev => prev.filter(t => t.id !== id));
      };
      return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
           <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Star color="warning" /> Top Themen der Woche</DialogTitle>
           <DialogContent>
               <Stack spacing={2} sx={{ mt: 1 }}>
                   {localTopics.length === 0 && <Typography variant="body2" color="text.secondary">Keine Top-Themen.</Typography>}
                   {localTopics.map((topic, index) => (
                       <Box key={topic.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                           <TextField fullWidth size="small" placeholder="Thema..." value={topic.title} onChange={(e) => handleSaveTopic(index, 'title', e.target.value)} />
                           <TextField type="date" size="small" label="Fällig" InputLabelProps={{ shrink: true }} value={topic.due_date || ''} onChange={(e) => handleSaveTopic(index, 'due_date', e.target.value)} sx={{ width: 150 }} />
                           <IconButton color="error" onClick={() => handleDelete(topic.id)}><Delete /></IconButton>
                       </Box>
                   ))}
                   {localTopics.length < 5 && <Button startIcon={<AddIcon />} onClick={handleAdd}>Hinzufügen</Button>}
               </Stack>
           </DialogContent>
           <DialogActions><Button onClick={onClose}>Schließen</Button></DialogActions>
        </Dialog>
      );
  };

  // Filter Logic
  const filteredCards = useMemo(() => {
      let result = cards;
      if (filters.mine && currentUser) { result = result.filter(c => c.assigneeId === currentUser.id); }
      if (filters.overdue) { const today = new Date().toISOString().split('T')[0]; result = result.filter(c => c.dueDate && c.dueDate < today); }
      if (filters.important) { result = result.filter(c => c.important); }
      if (filters.watch) { result = result.filter(c => c.watch); }
      return result;
  }, [cards, filters, currentUser]);

  const backlogCards = useMemo(() => filteredCards.filter(c => c.status === 'backlog').sort((a, b) => a.position - b.position), [filteredCards]);
  const memberColumns = useMemo(() => members.map(m => {
    const mine = filteredCards.filter(c => c.assigneeId === m.profile_id);
    const flow1 = mine.filter(c => c.status === 'flow1').sort((a,b)=>a.position-b.position);
    const flow = mine.filter(c => c.status === 'flow').sort((a,b)=>a.position-b.position);
    const done = mine.filter(c => c.status === 'done').sort((a,b)=>a.position-b.position);
    return { member: m, flow1, flow, done };
  }), [filteredCards, members]);
  
  const doneCardsCount = useMemo(() => filteredCards.filter(c => c.status === 'done').length, [filteredCards]);

  // --- Card Renderer ---
  const renderCard = (card: TeamBoardCard, index: number) => {
    const due = card.dueDate ? new Date(card.dueDate).toLocaleDateString('de-DE') : null;
    const overdue = card.dueDate ? new Date(card.dueDate) < new Date(new Date().toDateString()) : false;
    const creator = card.createdBy ? users.find(u => u.id === card.createdBy) : null;
    const initials = creator ? getInitials(creator.full_name || creator.name || '') : null;
    const isHighlighted = highlightCardId === card.cardId;
    const isImportant = card.important;
    const isWatch = card.watch;

    const borderColor = isHighlighted ? '#ffc107' : (isImportant ? '#d32f2f' : (isWatch ? '#1976d2' : 'rgba(0,0,0,0.12)'));

    return (
      <Draggable key={card.cardId} draggableId={card.cardId} index={index} isDragDisabled={!canModify}>
        {(prov, snap) => (
          <Card 
            ref={(el) => { prov.innerRef(el); if (isHighlighted && el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }}
            style={prov.draggableProps.style}
            {...prov.draggableProps} 
            {...prov.dragHandleProps} 
            sx={{ 
                width: '100%', 
                mb: 1, 
                borderRadius: '12px', 
                boxShadow: snap.isDragging ? '0 14px 28px rgba(0,0,0,0.30)' : '0 3px 8px rgba(0,0,0,0.06)', 
                position: 'relative', 
                border: '1px solid', 
                borderColor, 
                animation: isHighlighted ? `${blinkAnimation} 1s 5` : 'none',
                minHeight: MIN_CARD_HEIGHT, 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: 'var(--panel)',
                '&:hover': !snap.isDragging ? { transform: 'translateY(-2px)', boxShadow: '0 6px 14px rgba(0,0,0,0.18)' } : {},
                transition: 'transform 0.12s ease, box-shadow 0.12s ease'
            }} 
            onClick={() => openEditDialog(card)}
          >
            <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5, zIndex: 2 }}>
                <IconButton 
                    size="small" 
                    onClick={(e) => toggleCardProperty(card, 'important', e)}
                    sx={{ 
                        width: 24, height: 24,
                        color: isImportant ? '#d32f2f' : 'rgba(0,0,0,0.2)',
                        border: '1.5px solid',
                        borderColor: 'currentColor',
                        bgcolor: 'transparent',
                        p: 0,
                        '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.04)', borderColor: '#d32f2f', color: '#d32f2f' }
                    }}
                    title="Wichtig"
                >
                    <PriorityHighIcon sx={{ fontSize: 16, fontWeight: 'bold' }} />
                </IconButton>
                
                <IconButton 
                    size="small" 
                    onClick={(e) => toggleCardProperty(card, 'watch', e)}
                    sx={{ 
                        width: 24, height: 24,
                        color: isWatch ? '#1976d2' : 'rgba(0,0,0,0.2)',
                        bgcolor: 'transparent',
                        p: 0,
                        '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.04)', color: '#1976d2' }
                    }}
                    title="Auf Wiedervorlage"
                >
                    <AccessTime sx={{ fontSize: 22 }} />
                </IconButton>
            </Box>

            <CardContent sx={{ 
                pl: 1.5, 
                pr: 7, 
                py: 1.5, 
                pb: '12px !important', 
                display: 'flex', flexDirection: 'column', gap: 0.5, height: '100%' 
            }}>
              <Tooltip title={card.description} placement="top-start" arrow enterDelay={1000}>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {card.description || 'Ohne Beschreibung'}
                </Typography>
              </Tooltip>
              <Box sx={{ mt: 'auto', pt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {due && <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} sx={{ fontSize: '0.7rem', fontWeight: overdue ? 700 : 400, bgcolor: overdue ? '#ffebee' : 'transparent', px: overdue ? 0.5 : 0, borderRadius: 0.5 }}>{due}</Typography>}
                {initials && <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', px: 0.5 }}>{initials}</Typography>}
              </Box>
            </CardContent>
          </Card>
        )}
      </Draggable>
    );
  };

  if (!supabase) return <Box sx={{ p: 4 }}><SupabaseConfigNotice /></Box>;
  if (loading) return <Box sx={{ p: 4 }}><Typography>🔄 Teamboard wird geladen...</Typography></Box>;

  return (
    <Box sx={{ p: 2, backgroundColor: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
      
      <Box sx={{ p: 1, borderBottom: '1px solid var(--line)', backgroundColor: 'var(--panel)', borderRadius: '12px', display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {onExit && <Button onClick={onExit} startIcon={<ArrowBack />}>Zurück</Button>}
            <Box sx={{ display: 'flex', gap: 1 }}>
                 <Chip icon={<FilterList />} label="Meine" clickable color={filters.mine ? "primary" : "default"} onClick={() => setFilters(prev => ({ ...prev, mine: !prev.mine }))} variant={filters.mine ? "filled" : "outlined"} />
                 <Chip icon={<Warning />} label="Überfällig" clickable color={filters.overdue ? "error" : "default"} onClick={() => setFilters(prev => ({ ...prev, overdue: !prev.overdue }))} variant={filters.overdue ? "filled" : "outlined"} />
                 <Chip icon={<PriorityHigh />} label="Wichtig" clickable color={filters.important ? "warning" : "default"} onClick={() => setFilters(prev => ({ ...prev, important: !prev.important }))} variant={filters.important ? "filled" : "outlined"} />
                 <Chip icon={<AccessTime />} label="Wiedervorlage" clickable color={filters.watch ? "info" : "default"} onClick={() => setFilters(prev => ({ ...prev, watch: !prev.watch }))} variant={filters.watch ? "filled" : "outlined"} />
            </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
             <Tooltip title="Top Themen">
                 <IconButton onClick={() => { loadTopTopics(); setTopTopicsOpen(true); }}><Star fontSize="small" color="warning" /></IconButton>
             </Tooltip>
             <Tooltip title="KPI Dashboard">
                 <IconButton onClick={() => setKpiOpen(true)}><Assessment fontSize="small" color="primary" /></IconButton>
             </Tooltip>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', display: 'flex', gap: 2 }}>
        <DragDropContext onDragEnd={handleDragEnd}>
          
            <Box sx={{ width: BACKLOG_WIDTH, minWidth: BACKLOG_WIDTH, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', height: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
               <Box sx={{ p: 2, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.02)' }}>
                  <Typography variant="h6" sx={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', fontWeight: 700 }}>
                      {statusLabels.backlog} <Typography component="span" variant="caption" sx={{ml:1, bgcolor:'rgba(0,0,0,0.08)', px:0.8, py:0.2, borderRadius:1}}>{backlogCards.length}</Typography>
                  </Typography>
                  {canModify && <IconButton color="primary" size="small" onClick={openCreateDialog}><AddIcon fontSize="small" /></IconButton>}
               </Box>
               <Droppable droppableId={droppableKey(null, 'backlog')}>
                  {(provided, snapshot) => (
                     <Box ref={provided.innerRef} {...provided.droppableProps} sx={{ flex: 1, overflowY: 'auto', p: 1.5, backgroundColor: snapshot.isDraggingOver ? 'rgba(25, 118, 210, 0.04)' : 'transparent', transition: 'background-color 0.2s' }}>
                        {backlogCards.map((card, index) => renderCard(card, index))}
                        {provided.placeholder}
                     </Box>
                  )}
               </Droppable>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', height: '100%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
               
               <Box sx={{ display: 'flex', borderBottom: '1px solid var(--line)', bgcolor: 'rgba(0,0,0,0.02)', zIndex: 10 }}>
                   <Box sx={{ width: COL_WIDTHS.member, p: 1.5, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>Mitglied</Box>
                   <Box sx={{ flex: 1, p: 1.5, borderLeft: '1px solid var(--line)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{statusLabels.flow1}</Box>
                   <Box sx={{ flex: 1, p: 1.5, borderLeft: '1px solid var(--line)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{statusLabels.flow}</Box>
                   <Box sx={{ flex: 1, p: 1.5, borderLeft: '1px solid var(--line)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       {statusLabels.done}
                       <Stack direction="row" spacing={1} alignItems="center">
                           <Chip size="small" label={`${completedCount} gesamt`} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                           {canModify && <IconButton size="small" onClick={handleCompleteFlow} disabled={flowSaving || doneCardsCount === 0} title="Woche abschließen"><CheckCircleOutline fontSize="small" color="primary" /></IconButton>}
                       </Stack>
                   </Box>
               </Box>
               
               <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                   {memberColumns.map(({ member, flow1, flow, done }) => {
                       const isCollapsed = collapsedLanes[member.id];
                       
                       return (
                           <Card key={member.id} sx={{ overflow: 'visible', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                               <Box sx={{ display: 'flex', minHeight: isCollapsed ? 'auto' : 160 }}>
                                   
                                   <Box sx={{ width: COL_WIDTHS.member, minWidth: COL_WIDTHS.member, p: 2, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: 'var(--panel)', borderRight: '1px solid var(--line)' }}>
                                       <Stack direction="row" alignItems="center" justifyContent="space-between">
                                           <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>{getInitials(member.profile?.full_name || member.profile?.email || '?')}</Avatar>
                                           <IconButton size="small" onClick={() => toggleLaneCollapse(member.id)}>{isCollapsed ? <KeyboardArrowDown fontSize="small"/> : <KeyboardArrowUp fontSize="small"/>}</IconButton>
                                       </Stack>
                                       <Box>
                                           <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{member.profile?.full_name || member.profile?.email}</Typography>
                                           {member.profile?.company && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{member.profile.company}</Typography>}
                                       </Box>
                                   </Box>

                                   {!isCollapsed && (
                                       <>
                                           {[flow1, flow, done].map((rows, i) => {
                                               const status = i===0 ? 'flow1' : i===1 ? 'flow' : 'done';
                                               const allowQuickAdd = (status === 'flow1' || status === 'flow') && canModify;
                                               
                                               return (
                                                   <Box key={status} sx={{ flex: 1, borderRight: i<2 ? '1px solid var(--line)' : 'none', display: 'flex', flexDirection: 'column' }}>
                                                       
                                                       <Box sx={{ px: 2, py: 1, borderBottom: '1px dashed var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                           <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase' }}>{rows.length} Aufgaben</Typography>
                                                           
                                                           {allowQuickAdd ? (
                                                               <Tooltip title="Schnell hinzufügen">
                                                                   <IconButton size="small" onClick={() => openQuickAdd(member.profile_id, status as TeamBoardStatus)} sx={{ p: 0.5, color: 'primary.main', '&:hover': { bgcolor: 'primary.light', color: 'white' } }}>
                                                                       <AddCircleOutline fontSize="small" />
                                                                   </IconButton>
                                                               </Tooltip>
                                                           ) : (
                                                               <Box sx={{ width: 26, height: 26 }} />
                                                           )}
                                                       </Box>

                                                       <Droppable droppableId={droppableKey(member.profile_id, status as TeamBoardStatus)}>
                                                           {(prov, snap) => (
                                                               <Box 
                                                                   ref={prov.innerRef} 
                                                                   {...prov.droppableProps} 
                                                                   sx={{ 
                                                                       flex: 1, 
                                                                       p: 1.5, 
                                                                       bgcolor: snap.isDraggingOver ? 'rgba(25, 118, 210, 0.04)' : 'transparent', 
                                                                       transition: 'background-color 0.2s',
                                                                       display: 'flex', 
                                                                       flexDirection: 'column', 
                                                                       gap: 1 
                                                                   }}
                                                               >
                                                                   {rows.map((c, idx) => renderCard(c, idx))}
                                                                   {prov.placeholder}
                                                               </Box>
                                                           )}
                                                       </Droppable>
                                                   </Box>
                                               );
                                           })}
                                       </>
                                   )}
                                   
                                   {isCollapsed && (
                                       <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 3, color: 'text.disabled', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                           Aufgaben eingeklappt
                                       </Box>
                                   )}
                               </Box>
                           </Card>
                       );
                   })}
               </Box>
            </Box>

        </DragDropContext>
      </Box>

      {/* Dialoge */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCard ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2}>
                <TextField label="Aufgabenbeschreibung" value={draft.description} onChange={(e) => handleDraftChange('description', e.target.value)} fullWidth multiline minRows={2} />
                <TextField label="Zieltermin" type="date" InputLabelProps={{ shrink: true }} value={draft.dueDate} onChange={(e) => handleDraftChange('dueDate', e.target.value)} required error={dueDateError && !draft.dueDate} />
                
                <FormControlLabel control={<Checkbox checked={draft.important} onChange={(e) => handleDraftChange('important', e.target.checked)} />} label="Wichtige Aufgabe markieren" />
                <FormControlLabel control={<Checkbox checked={draft.watch} onChange={(e) => handleDraftChange('watch', e.target.checked)} />} label="Auf Wiedervorlage setzen" />
            </Stack>
        </DialogContent>
        <DialogActions>{editingCard && <Button color="error" onClick={deleteTask} disabled={saving} startIcon={<DeleteIcon />}>Löschen</Button>}<Box sx={{ flexGrow: 1 }} /><Button onClick={closeDialog} disabled={saving}>Abbrechen</Button><Button onClick={saveTask} disabled={saving} variant="contained">Speichern</Button></DialogActions>
      </Dialog>
      
      <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
      <TeamKPIDialog open={kpiOpen} onClose={() => setKpiOpen(false)} />
    </Box>
  );
}