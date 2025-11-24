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
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Badge
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, FilterList, Warning, PriorityHigh, ArrowBack, Star, Delete } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { useSnackbar } from 'notistack';
import { keyframes } from '@mui/system';

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';

// Animation wie im Projektboard (5x)
const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); border-color: #ffc107; }
  50% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); border-color: #ffc107; background-color: rgba(255, 249, 196, 0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
`;

interface BoardMember { id: string; profile_id: string; }
interface MemberWithProfile extends BoardMember { profile: ClientProfile | null; }
export type TeamBoardStatus = 'backlog' | 'flow1' | 'flow' | 'done';
interface TeamBoardCard { rowId: string; cardId: string; description: string; dueDate: string | null; important: boolean; assigneeId: string | null; status: TeamBoardStatus; position: number; createdBy?: string; }
interface TeamKanbanBoardProps { boardId: string; onExit?: () => void; highlightCardId?: string | null; }
interface TaskDraft { description: string; dueDate: string; important: boolean; assigneeId: string | null; status: TeamBoardStatus; }
interface DroppableInfo { assigneeId: string | null; status: TeamBoardStatus; }

// Interface für Top Themen
interface TopTopic {
  id: string;
  title: string;
  calendar_week?: string;
  due_date?: string;
  position: number;
}

const statusLabels: Record<TeamBoardStatus, string> = { backlog: 'Aufgabenspeicher', flow1: 'Flow-1', flow: 'Flow', done: 'Fertig' };
const CARD_WIDTH = 260;
const MIN_CARD_HEIGHT = 92;
const defaultDraft: TaskDraft = { description: '', dueDate: '', important: false, assigneeId: null, status: 'backlog' };

const getInitials = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2);
const droppableKey = (assigneeId: string | null, status: TeamBoardStatus) => `team|${assigneeId ?? 'unassigned'}|${status}`;
const parseDroppableKey = (value: string): DroppableInfo => {
  if (!value.startsWith('team|')) return { assigneeId: null, status: 'backlog' };
  const [, rawAssignee, rawStatus] = value.split('|');
  const status = (['backlog', 'flow1', 'flow', 'done'] as TeamBoardStatus[]).includes(rawStatus as TeamBoardStatus) ? (rawStatus as TeamBoardStatus) : 'backlog';
  const assigneeId = rawAssignee === 'unassigned' ? null : rawAssignee;
  return { assigneeId, status };
};

const buildCardData = (card: TeamBoardCard) => ({ type: 'teamTask', description: card.description, dueDate: card.dueDate, important: card.important, assigneeId: card.assigneeId, status: card.status, createdBy: card.createdBy });
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
  const createdBy = typeof payload.createdBy === 'string' ? payload.createdBy : undefined;
  let status: TeamBoardStatus = stageInfo.status;
  if (typeof payload.status === 'string' && ['backlog', 'flow1', 'flow', 'done'].includes(payload.status)) status = payload.status as TeamBoardStatus;
  let assigneeId: string | null = stageInfo.assigneeId;
  if (typeof payload.assigneeId === 'string') assigneeId = payload.assigneeId; else if (payload.assigneeId === null) assigneeId = null;
  return { rowId: String(row.id), cardId: String(row.card_id ?? row.id ?? crypto.randomUUID()), description, dueDate, important, assigneeId, status, position: typeof row.position === 'number' ? row.position : 0, createdBy };
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

  // Top Themen State
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  const [topTopicsOpen, setTopTopicsOpen] = useState(false);

  // Filter State
  const [filters, setFilters] = useState({
    mine: false,
    overdue: false,
    important: false
  });

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
    const settings = payload.settings ?? {};
    setBoardSettings(settings);
    setCompletedCount(Number(settings?.teamBoard?.completedCount || 0));
  }, [boardId, supabase]);

  const persistCompletedCount = useCallback(async (nextCount: number) => {
      const nextSettings = { ...boardSettings, teamBoard: { ...(boardSettings.teamBoard || {}), completedCount: nextCount } };
      const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
      const response = await fetch(`/api/boards/${boardId}/settings`, { method: 'POST', headers, body: JSON.stringify({ settings: nextSettings }), credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setBoardSettings(nextSettings); setCompletedCount(nextCount);
    }, [boardId, boardSettings, supabase]);

  const loadAllUsers = useCallback(async () => {
    try { const profiles = await fetchClientProfiles(); setUsers(profiles); return profiles; } catch (err) { return []; }
  }, []);

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
        await loadTopTopics(); // ✅ Top Themen laden
      } catch (e) { if (active) setError('Fehler beim Laden.'); } finally { if (active) setLoading(false); }
    };
    loadAll();
    return () => { active = false; };
  }, [boardId]);

  // ACTIONS
  const openCreateDialog = () => { if (!canModify) return; setEditingCard(null); setDraft(defaultDraft); setDueDateError(false); setDialogOpen(true); };
  const openEditDialog = (card: TeamBoardCard) => { if (!canModify) return; setEditingCard(card); setDraft({ description: card.description, dueDate: card.dueDate ?? '', important: card.important, assigneeId: card.assigneeId, status: card.status }); setDueDateError(false); setDialogOpen(true); };
  const closeDialog = () => { if (!saving) { setDialogOpen(false); setEditingCard(null); setDraft(defaultDraft); setDueDateError(false); }};
  const handleDraftChange = (k: keyof TaskDraft, v: any) => { setDraft(p => ({...p, [k]: v})); if(k==='dueDate') setDueDateError(!v); };

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

  // --- Top Themen Dialog ---
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
           <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
               <Star color="warning" /> Top Themen der Woche
           </DialogTitle>
           <DialogContent>
               <Stack spacing={2} sx={{ mt: 1 }}>
                   {localTopics.length === 0 && <Typography variant="body2" color="text.secondary">Keine Top-Themen.</Typography>}
                   {localTopics.map((topic, index) => (
                       <Box key={topic.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                           <TextField 
                               fullWidth 
                               size="small" 
                               placeholder="Thema..." 
                               value={topic.title} 
                               onChange={(e) => handleSaveTopic(index, 'title', e.target.value)} 
                           />
                           {/* ✅ Hier ist der Fix: type="date" statt "week" und Speichern in due_date */}
                           <TextField 
                               type="date" 
                               size="small" 
                               label="Fällig" 
                               InputLabelProps={{ shrink: true }} 
                               value={topic.due_date || ''} 
                               onChange={(e) => handleSaveTopic(index, 'due_date', e.target.value)} 
                               sx={{ width: 150 }} 
                           />
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

  // --- Filterung ---
  const filteredCards = useMemo(() => {
      let result = cards;
      if (filters.mine && currentUser) {
         result = result.filter(c => c.assigneeId === currentUser.id);
      }
      if (filters.overdue) {
          const today = new Date().toISOString().split('T')[0];
          result = result.filter(c => c.dueDate && c.dueDate < today);
      }
      if (filters.important) {
          result = result.filter(c => c.important);
      }
      return result;
  }, [cards, filters, currentUser]);

  // RENDER
  const backlogCards = useMemo(() => filteredCards.filter(c => c.status === 'backlog').sort((a, b) => a.position - b.position), [filteredCards]);
  const memberColumns = useMemo(() => members.map(m => {
    const mine = filteredCards.filter(c => c.assigneeId === m.profile_id);
    return { member: m, flow1: mine.filter(c => c.status === 'flow1').sort((a,b)=>a.position-b.position), flow: mine.filter(c => c.status === 'flow').sort((a,b)=>a.position-b.position), done: mine.filter(c => c.status === 'done').sort((a,b)=>a.position-b.position) };
  }), [filteredCards, members]);
  const doneCardsCount = useMemo(() => filteredCards.filter(c => c.status === 'done').length, [filteredCards]);

  const renderCard = (card: TeamBoardCard, index: number) => {
    const due = card.dueDate ? new Date(card.dueDate).toLocaleDateString('de-DE') : null;
    const overdue = card.dueDate ? new Date(card.dueDate) < new Date(new Date().toDateString()) : false;
    const creator = card.createdBy ? users.find(u => u.id === card.createdBy) : null;
    const initials = creator ? getInitials(creator.full_name || creator.name || '') : null;
    const isHighlighted = highlightCardId === card.cardId;

    return (
      <Draggable key={card.cardId} draggableId={card.cardId} index={index} isDragDisabled={!canModify}>
        {(prov, snap) => (
          <Card 
            ref={(el) => {
                prov.innerRef(el);
                if (isHighlighted && el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            }}
            {...prov.draggableProps} 
            {...prov.dragHandleProps} 
            sx={{ 
                width: '100%', maxWidth: CARD_WIDTH, mb: 1.5, borderRadius: 2.5, 
                boxShadow: snap.isDragging ? '0 18px 30px rgba(15,23,42,0.22)' : '0 4px 14px rgba(15,23,42,0.08)', 
                position: 'relative', border: '1px solid', 
                borderColor: isHighlighted ? '#ffc107' : (card.important ? 'error.light' : 'rgba(148,163,184,0.35)'), 
                animation: isHighlighted ? `${blinkAnimation} 1s 5` : 'none',
                height: 'auto', minHeight: MIN_CARD_HEIGHT, display: 'flex', flexDirection: 'column', 
                background: snap.isDragging ? 'background.paper' : 'linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.92) 100%)', 
                '&:hover': { transform: snap.isDragging ? 'scale(1.02)' : 'translateY(-2px)', boxShadow: '0 10px 22px rgba(15,23,42,0.16)' } 
            }} 
            onClick={() => openEditDialog(card)}
          >
            {card.important && <Box sx={{ position: 'absolute', top: 8, left: 8, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#d32f2f' }} />}
            <CardContent sx={{ pr: 3, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
              <Tooltip title={card.description} placement="top-start" arrow enterDelay={1000}>
                <Typography variant="body2" sx={{ fontWeight: 400, fontSize: '0.9rem', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', mb: 1.5 }}>{card.description || 'Ohne Beschreibung'}</Typography>
              </Tooltip>
              <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                {due && <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} sx={{ fontWeight: overdue ? 600 : 500 }}>Fällig: {due}</Typography>}
                {initials && <Tooltip title={`Erstellt von: ${creator?.full_name}`}><Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', px: 0.5, py: 0.25, ml: 'auto' }}>{initials}</Typography></Tooltip>}
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
    <Box sx={{ p: { xs: 2, md: 3 }, background: 'linear-gradient(180deg, rgba(240, 244, 255, 0.8) 0%, rgba(255, 255, 255, 0.95) 45%)', height: '100%', display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
      {/* Header mit Zurück und Filter */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
            {onExit && <Button onClick={onExit} startIcon={<ArrowBack />}>Zurück</Button>}
            
            <Box sx={{ display: 'flex', gap: 1 }}>
                 <Chip icon={<FilterList />} label="Meine" clickable color={filters.mine ? "primary" : "default"} onClick={() => setFilters(prev => ({ ...prev, mine: !prev.mine }))} />
                 <Chip icon={<Warning />} label="Überfällig" clickable color={filters.overdue ? "error" : "default"} onClick={() => setFilters(prev => ({ ...prev, overdue: !prev.overdue }))} />
                 <Chip icon={<PriorityHigh />} label="Wichtig" clickable color={filters.important ? "warning" : "default"} onClick={() => setFilters(prev => ({ ...prev, important: !prev.important }))} />
            </Box>
        </Box>
        
        {/* Top Themen Button */}
        <Tooltip title="Top Themen">
            <IconButton onClick={() => { loadTopTopics(); setTopTopicsOpen(true); }}>
                <Star fontSize="small" color="warning" />
            </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Grid container spacing={3} sx={{ height: '100%' }} alignItems="flex-start" wrap="nowrap">
            <Grid item xs={12} md={3} sx={{ height: '100%' }}>
              <Card sx={{ height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'rgba(148,163,184,0.28)', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden', p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Aufgabenspeicher</Typography>{canModify && <IconButton color="primary" size="small" onClick={openCreateDialog}><AddIcon fontSize="small" /></IconButton>}</Stack>
                  <Droppable droppableId={droppableKey(null, 'backlog')}>
                    {(provided) => (
                      <Box ref={provided.innerRef} {...provided.droppableProps} sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflowY: 'auto', border: '1px solid', borderColor: 'rgba(148,163,184,0.22)', borderRadius: 2, p: 1.5, backgroundColor: alpha('#1976d2', 0.08) }}>
                        {backlogCards.length === 0 && <Typography variant="body2" color="text.secondary">Keine Aufgaben im Speicher.</Typography>}
                        {backlogCards.map((card, index) => renderCard(card, index))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={9} sx={{ height: '100%' }}>
              <Card sx={{ height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'rgba(148,163,184,0.28)', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden', p: 2 }}>
                  <Typography variant="h6">Team-Flow</Typography>
                  <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'background.paper' }}>
                        <Box component="tr" sx={{ '& th': { borderBottom: '1px solid rgba(148,163,184,0.3)', py: 1, px: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', color: 'text.secondary' } }}>
                          <Box component="th" align="left">Mitglied</Box>
                          <Box component="th" align="center" width="25%">{statusLabels.flow1}</Box>
                          <Box component="th" align="center" width="25%">{statusLabels.flow}</Box>
                          <Box component="th" align="center" width="25%"><Stack spacing={1} alignItems="center"><span>{statusLabels.done}</span><Stack direction="row" spacing={1}><Chip size="small" color="primary" variant="outlined" label={`${completedCount} gesamt`} />{canModify && <Button size="small" variant="contained" onClick={handleCompleteFlow} disabled={flowSaving || doneCardsCount === 0} sx={{ textTransform: 'none' }}>Abschließen</Button>}</Stack></Stack></Box>
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {memberColumns.map(({ member, flow1, flow, done }) => (
                          <Box component="tr" key={member.id} sx={{ '& td': { borderBottom: '1px solid rgba(148,163,184,0.2)', px: 1.5, py: 1.5, verticalAlign: 'top' } }}>
                            <Box component="td" width="25%"><Stack spacing={0.5}><Typography variant="subtitle2" fontWeight={600}>{member.profile?.full_name || member.profile?.email}</Typography>{member.profile?.company && <Typography variant="caption" color="text.secondary">{member.profile.company}</Typography>}</Stack></Box>
                            {[flow1, flow, done].map((rows, i) => {
                                const status = i===0 ? 'flow1' : i===1 ? 'flow' : 'done';
                                return (
                                  <Box component="td" key={status} width="25%">
                                    <Droppable droppableId={droppableKey(member.profile_id, status as TeamBoardStatus)}>
                                      {(prov) => (
                                        <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ display: 'flex', flexDirection: 'column', minHeight: 160, gap: 1, border: '1px solid rgba(148,163,184,0.22)', borderRadius: 2, p: 1.5, backgroundColor: alpha('#1976d2', 0.06) }}>
                                          {rows.map((c, idx) => renderCard(c, idx))}
                                          {prov.placeholder}
                                        </Box>
                                      )}
                                    </Droppable>
                                  </Box>
                                );
                            })}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DragDropContext>
      </Box>
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCard ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
        <DialogContent dividers><Stack spacing={2}><TextField label="Aufgabenbeschreibung" value={draft.description} onChange={(e) => handleDraftChange('description', e.target.value)} fullWidth multiline minRows={2} /><TextField label="Zieltermin" type="date" InputLabelProps={{ shrink: true }} value={draft.dueDate} onChange={(e) => handleDraftChange('dueDate', e.target.value)} required error={dueDateError && !draft.dueDate} /><FormControlLabel control={<Checkbox checked={draft.important} onChange={(e) => handleDraftChange('important', e.target.checked)} />} label="Wichtige Aufgabe markieren" /></Stack></DialogContent>
        <DialogActions>{editingCard && <Button color="error" onClick={deleteTask} disabled={saving} startIcon={<DeleteIcon />}>Löschen</Button>}<Box sx={{ flexGrow: 1 }} /><Button onClick={closeDialog} disabled={saving}>Abbrechen</Button><Button onClick={saveTask} disabled={saving} variant="contained">Speichern</Button></DialogActions>
      </Dialog>
      
      <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
    </Box>
  );
}