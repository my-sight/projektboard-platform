'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
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
  Typography,
  Avatar,
  LinearProgress,
  Grid,
  Switch,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  FilterList, 
  Warning, 
  PriorityHigh, 
  CheckCircle,
  AddCircleOutline,
  Delete,
  AccessTime,
  PriorityHigh as PriorityHighIcon,
  Assessment,
  Link as LinkIcon,
  Settings,
  Home as HomeIcon,
  Star
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

const COL_WIDTHS = { member: '220px', flow1: '1fr', flow: '1fr', done: '1fr' };
const MIN_CARD_HEIGHT = 80;
const BACKLOG_WIDTH = 320;

interface BoardMember { id: string; profile_id: string; }
interface MemberWithProfile extends BoardMember { profile: ClientProfile | null; }
export type TeamBoardStatus = 'backlog' | 'flow1' | 'flow' | 'done';

interface TeamBoardCard { 
    rowId: string; 
    cardId: string; 
    boardId: string; 
    boardName?: string;
    description: string; 
    dueDate: string | null; 
    important: boolean; 
    watch: boolean; 
    assigneeId: string | null; 
    status: TeamBoardStatus; 
    position: number; 
    createdBy?: string;
    originalStage?: string;
    originalData: any;
}

interface TeamKanbanBoardProps { boardId: string; onExit?: () => void; highlightCardId?: string | null; }
interface TaskDraft { description: string; dueDate: string; important: boolean; watch: boolean; assigneeId: string | null; status: TeamBoardStatus; }
interface DroppableInfo { assigneeId: string | null; status: TeamBoardStatus; }
interface TopTopic { id: string; title: string; calendar_week?: string; due_date?: string; position: number; }

const defaultDraft: TaskDraft = { description: '', dueDate: '', important: false, watch: false, assigneeId: null, status: 'backlog' };

const getInitials = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2);
const droppableKey = (assigneeId: string | null, status: TeamBoardStatus) => `team|${assigneeId ?? 'unassigned'}|${status}`;
const parseDroppableKey = (value: string): DroppableInfo => {
  if (!value.startsWith('team|')) return { assigneeId: null, status: 'backlog' };
  const [, rawAssignee, rawStatus] = value.split('|');
  const status = (['backlog', 'flow1', 'flow', 'done'] as TeamBoardStatus[]).includes(rawStatus as TeamBoardStatus) ? (rawStatus as TeamBoardStatus) : 'backlog';
  const assigneeId = rawAssignee === 'unassigned' ? null : rawAssignee;
  return { assigneeId, status };
};

const getNextWeekDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

const mapStageToTeamColumn = (stageName: string = ""): TeamBoardStatus => {
    const s = stageName.toLowerCase().trim();
    if (!s) return 'backlog';
    if (s.includes('fertig') || s.includes('done') || s.includes('versand') || s.includes('archiv')) return 'done';
    if (s.includes('backlog') || s.includes('speicher') || s.includes('klärung') || s.includes('neu')) return 'backlog';
    if (s.includes('flow 1') || s.includes('flow1') || s.includes('vorbereitung')) return 'flow1';
    return 'flow';
};

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

const convertDbToCard = (item: any, boardMap: Map<string, string>, currentBoardId: string): TeamBoardCard => {
    const d = item.card_data || {};
    const isLocal = item.board_id === currentBoardId;
    const status = isLocal ? (d.status as TeamBoardStatus || 'backlog') : mapStageToTeamColumn(item.stage || d['Board Stage']);
    
    return {
        rowId: String(item.id),
        cardId: String(item.card_id),
        boardId: item.board_id,
        boardName: boardMap.get(item.board_id) || 'Unbekannt',
        description: d.description || d.Teil || d.Nummer || 'Aufgabe',
        dueDate: d['Due Date'] || d.dueDate || null,
        important: Boolean(d.important || d.Priorität),
        watch: Boolean(d.watch),
        assigneeId: d.assigneeId || d.userId || d.VerantwortlichId || null,
        status: status,
        position: item.position || 0,
        createdBy: d.createdBy,
        originalStage: item.stage || d['Board Stage'],
        originalData: d
    };
};

export default function TeamKanbanBoard({ boardId, onExit, highlightCardId }: TeamKanbanBoardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [cards, setCards] = useState<TeamBoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [canModify, setCanModify] = useState(false);
  const [canConfigure, setCanConfigure] = useState(false);
  const [isHomeBoard, setIsHomeBoard] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(defaultDraft);
  const [editingCard, setEditingCard] = useState<TeamBoardCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [dueDateError, setDueDateError] = useState(false);
  const [boardSettings, setBoardSettings] = useState<Record<string, any>>({});
  const [completedCount, setCompletedCount] = useState(0);
  
  // ✅ HIER WAR DER FEHLER: flowSaving hat gefehlt
  const [flowSaving, setFlowSaving] = useState(false);
  
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  const [topTopicsOpen, setTopTopicsOpen] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  
  const [kpiOpen, setKpiOpen] = useState(false);
  const [filters, setFilters] = useState({ mine: false, overdue: false, important: false, watch: false });

  // --- Loading ---
  const loadBoardSettings = useCallback(async () => {
    if (!supabase) return;
    const response = await fetch(`/api/boards/${boardId}/settings`, { method: 'GET', headers: await buildSupabaseAuthHeaders(supabase) });
    if (!response.ok) return;
    const payload = await response.json();
    const s = payload.settings || {};
    setBoardSettings(s);
    setIsHomeBoard(!!s.isHomeBoard);
    setCompletedCount(Number(s.teamBoard?.completedCount || 0));
  }, [boardId, supabase]);

  const persistCompletedCount = useCallback(async (nextCount: number) => {
      if (!supabase) return;
      const nextSettings = { ...boardSettings, teamBoard: { ...(boardSettings.teamBoard || {}), completedCount: nextCount } };
      await fetch(`/api/boards/${boardId}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) }, body: JSON.stringify({ settings: nextSettings }) });
      setBoardSettings(nextSettings); setCompletedCount(nextCount);
    }, [boardId, boardSettings, supabase]);

  const saveBoardSettings = async () => {
      if (!supabase) return;
      const nextSettings = { ...boardSettings, isHomeBoard };
      await fetch(`/api/boards/${boardId}/settings`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) }, 
          body: JSON.stringify({ settings: nextSettings }) 
      });
      setSettingsOpen(false);
      enqueueSnackbar('Einstellungen gespeichert', { variant: 'success' });
      window.location.reload(); 
  };

  const loadAllUsers = useCallback(async () => { try { const profiles = await fetchClientProfiles(); setUsers(profiles); return profiles; } catch (err) { return []; } }, []);

  const loadMembers = useCallback(async (availableProfiles: ClientProfile[]) => {
      if (!supabase) return [];
      const { data } = await supabase.from('board_members').select('id, profile_id').eq('board_id', boardId).order('created_at', { ascending: true });
      if (data) {
          const mapped = data.map((entry) => {
              const profile = availableProfiles.find((c) => c.id === entry.profile_id) ?? null;
              return (profile && (profile.is_active ?? true) && !isSuperuserEmail(profile.email)) ? { ...entry, profile } : null;
            }).filter((e) => e !== null) as MemberWithProfile[];
          setMembers(mapped);
          return mapped;
      }
      return [];
  }, [boardId, supabase]);

  const loadCards = useCallback(async (currentMembers: MemberWithProfile[]) => {
    if (!supabase) return;
    try {
        const { data: boards } = await supabase.from('kanban_boards').select('id, name');
        const boardMap = new Map(boards?.map(b => [b.id, b.name]));

        let query = supabase.from('kanban_cards').select('*');
        if (!isHomeBoard) {
            query = query.eq('board_id', boardId);
        }
        
        const { data, error } = await query;
        if (error) throw error;

        const memberIds = currentMembers.map(m => m.profile_id);
        const loadedCards: TeamBoardCard[] = [];
        
        data.forEach(item => {
            let d = item.card_data || {};
            if (d?.Archived === '1' || d?.archived) return;

            const assignee = d.assigneeId || d.userId || d.VerantwortlichId;
            const isLocal = item.board_id === boardId;
            
            if (isLocal || (isHomeBoard && assignee && memberIds.includes(assignee))) {
                loadedCards.push(convertDbToCard(item, boardMap, boardId));
            }
        });

        loadedCards.sort((a, b) => {
            const assignA = a.assigneeId || '';
            const assignB = b.assigneeId || '';
            if (assignA !== assignB) return assignA.localeCompare(assignB);
            return a.position - b.position;
        });

        setCards(loadedCards);

    } catch (error) { console.error(error); }
  }, [boardId, supabase, isHomeBoard]);

  const loadTopTopics = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('board_top_topics').select('*').eq('board_id', boardId).order('position');
    if (data) setTopTopics(data);
  }, [boardId, supabase]);

  const evaluatePermissions = useCallback(async (profiles: ClientProfile[], currentMembers: MemberWithProfile[]) => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);
      
      const profile = profiles.find(p => p.id === user.id);
      const isSuper = isSuperuserEmail(user.email) || profile?.role === 'admin';
      const isMember = currentMembers.some(m => m.profile_id === user.id);
      
      const { data: boardRow } = await supabase.from('kanban_boards').select('owner_id, board_admin_id').eq('id', boardId).maybeSingle();
      const isOwner = boardRow?.owner_id === user.id;
      const isBoardAdmin = boardRow?.board_admin_id === user.id;
      
      setCanModify(isSuper || isOwner || isBoardAdmin || isMember);
      setCanConfigure(isSuper || isOwner || isBoardAdmin);
  }, [boardId, supabase]);

  useEffect(() => {
    let active = true;
    const init = async () => {
        if (!supabase) return;
        setLoading(true);
        await loadBoardSettings();
        const profiles = await loadAllUsers();
        const mems = await loadMembers(profiles);
        if (active) {
            await loadCards(mems);
            await loadTopTopics();
            await evaluatePermissions(profiles, mems);
            setLoading(false);
        }
    };
    init();
    return () => { active = false; };
  }, [boardId]);

  useEffect(() => {
      if (!loading && members.length > 0) {
          loadCards(members);
      }
  }, [isHomeBoard, loading]); 

  // --- KPI ---
  const kpiStats = useMemo(() => {
      const active = cards.filter(c => c.status === 'flow' || c.status === 'flow1');
      const backlog = cards.filter(c => c.status === 'backlog');
      const today = new Date().toISOString().split('T')[0];
      const overdue = cards.filter(c => c.dueDate && c.dueDate < today);
      
      const memberLoad = members.map(m => {
          const count = active.filter(c => c.assigneeId === m.profile_id).length;
          return { name: m.profile?.full_name || m.profile?.email || '?', count, avatar: getInitials(m.profile?.full_name || m.profile?.email || '') };
      }).sort((a, b) => b.count - a.count);

      return { activeCount: active.length, backlogCount: backlog.length, doneCount: completedCount, overdueCount: overdue.length, importantCount: cards.filter(c => c.important).length, watchCount: cards.filter(c => c.watch).length, memberLoad };
  }, [cards, members, completedCount]);

  // --- Actions ---
  const openCreateDialog = () => { 
      if (!canModify) return; 
      setEditingCard(null); 
      setDraft({ ...defaultDraft, dueDate: getNextWeekDateString() }); 
      setDueDateError(false); 
      setDialogOpen(true); 
  };
  const openQuickAdd = (assigneeId: string, status: TeamBoardStatus) => {
      if (!canModify) return;
      setEditingCard(null);
      setDraft({ ...defaultDraft, assigneeId, status, dueDate: getNextWeekDateString() });
      setDueDateError(false);
      setDialogOpen(true);
  };
  const handleDraftChange = (k: keyof TaskDraft, v: any) => { setDraft(p => ({...p, [k]: v})); if(k==='dueDate') setDueDateError(!v); };
  const toggleLaneCollapse = (memberId: string) => { setCollapsedLanes(prev => ({...prev, [memberId]: !prev[memberId]})); };

  const toggleCardProperty = async (card: TeamBoardCard, property: 'important' | 'watch', e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canModify || !supabase) return;
      const newValue = !card[property];
      setCards(prev => prev.map(c => c.cardId === card.cardId ? { ...c, [property]: newValue } : c));
      try {
          await supabase.from('kanban_cards').update({ card_data: { ...card.originalData, [property]: newValue } }).eq('id', card.rowId);
      } catch (err) { setCards(cards); }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!canModify || !result.destination || !supabase) return;
    const { source, destination, draggableId } = result;

    const newCards = [...cards];
    const idx = newCards.findIndex(c => c.cardId === draggableId);
    if (idx === -1) return;

    const moved = { ...newCards[idx] };
    const destInfo = parseDroppableKey(destination.droppableId);
    
    moved.status = destInfo.status;
    moved.assigneeId = destInfo.assigneeId;
    
    newCards.splice(idx, 1);
    newCards.splice(destination.index, 0, moved);
    setCards(newCards);

    try {
        let dbStage = moved.originalStage || 'Backlog';
        if (destInfo.status === 'done') dbStage = 'Fertig';
        if (destInfo.status === 'backlog') dbStage = 'Backlog';
        if (destInfo.status === 'flow' || destInfo.status === 'flow1') {
            if (['Backlog', 'Fertig', 'Archiv'].includes(dbStage)) dbStage = 'In Bearbeitung';
        }

        await supabase.from('kanban_cards').update({
            stage: dbStage, 
            card_data: { ...moved.originalData, "Board Stage": dbStage, assigneeId: destInfo.assigneeId }
        }).eq('id', moved.rowId);
    } catch (e) { console.error(e); }
  };

  const saveTask = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
        if (editingCard) {
            // Update existing card
            await supabase.from('kanban_cards').update({
                 card_data: {
                     ...editingCard.originalData,
                     description: draft.description,
                     "Due Date": draft.dueDate,
                     important: draft.important,
                     watch: draft.watch,
                     assigneeId: draft.assigneeId
                 }
            }).eq('id', editingCard.rowId);
            enqueueSnackbar('Aufgabe aktualisiert', { variant: 'success' });
        } else {
            // Create new card
            await supabase.from('kanban_cards').insert([{
                board_id: boardId,
                card_id: crypto.randomUUID(),
                stage: draft.status === 'done' ? 'Fertig' : 'Backlog',
                card_data: {
                    description: draft.description,
                    "Due Date": draft.dueDate,
                    important: draft.important,
                    watch: draft.watch,
                    assigneeId: draft.assigneeId,
                    "Board Stage": draft.status === 'done' ? 'Fertig' : 'Backlog'
                }
            }]);
            enqueueSnackbar('Aufgabe erstellt', { variant: 'success' });
        }
        setDialogOpen(false);
        const mems = await loadMembers(await fetchClientProfiles());
        loadCards(mems);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const deleteTask = async () => {
      if (!editingCard || !supabase) return;
      if (!confirm("Löschen?")) return;
      await supabase.from('kanban_cards').delete().eq('id', editingCard.rowId);
      setCards(prev => prev.filter(c => c.cardId !== editingCard.cardId));
      setDialogOpen(false);
  };

  const handleCompleteFlow = async () => {
    if (!canModify || flowSaving || !supabase) return;
    setFlowSaving(true);
    try {
      const doneCards = cards.filter(c => c.status === 'done');
      for (const card of doneCards) {
           await supabase.from('kanban_cards').update({
               card_data: { ...card.originalData, Archived: "1", ArchivedDate: new Date().toISOString() }
           }).eq('id', card.rowId);
      }
      await persistCompletedCount(completedCount + doneCards.length);
      setCards(prev => prev.filter(c => c.status !== 'done'));
      enqueueSnackbar('Flow abgeschlossen', { variant: 'success' });
    } catch (e) { console.error(e); } finally { setFlowSaving(false); }
  };

  const TeamKPIDialog = ({ open, onClose }: any) => (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assessment color="primary" /> KPIs</DialogTitle>
          <DialogContent dividers>
              <Grid container spacing={3}>
                  <Grid item xs={4}><Card sx={{bgcolor:'rgba(25, 118, 210, 0.04)'}}><CardContent><Typography variant="h4" color="primary">{kpiStats.activeCount}</Typography><Typography variant="caption">Aktive Aufgaben</Typography></CardContent></Card></Grid>
                  <Grid item xs={4}><Card sx={{bgcolor:'rgba(46, 125, 50, 0.04)'}}><CardContent><Typography variant="h4" color="success.main">{kpiStats.doneCount}</Typography><Typography variant="caption">Erledigt</Typography></CardContent></Card></Grid>
                  <Grid item xs={4}><Card sx={{bgcolor:kpiStats.overdueCount>0?'rgba(211, 47, 47, 0.04)':'transparent'}}><CardContent><Typography variant="h4" color="error">{kpiStats.overdueCount}</Typography><Typography variant="caption">Überfällig</Typography></CardContent></Card></Grid>
                  <Grid item xs={12}><Typography variant="subtitle1" gutterBottom>Auslastung</Typography>
                      {kpiStats.memberLoad.slice(0,5).map((m,i)=>(<Box key={i} sx={{mb:1}}><Box sx={{display:'flex', justifyContent:'space-between'}}><Typography variant="body2">{m.name}</Typography><Typography variant="body2">{m.count}</Typography></Box><LinearProgress variant="determinate" value={Math.min(100, (m.count/5)*100)} /></Box>))}
                  </Grid>
              </Grid>
          </DialogContent>
          <DialogActions><Button onClick={onClose}>Schließen</Button></DialogActions>
      </Dialog>
  );

  const TopTopicsDialog = ({ open, onClose }: any) => {
      const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);
      useEffect(() => { setLocalTopics(topTopics); }, [topTopics]);
      const handleSaveTopic = async (index: number, field: keyof TopTopic, value: any) => {
          if (!supabase) return;
          const topic = localTopics[index];
          const newTopics = [...localTopics];
          newTopics[index] = { ...topic, [field]: value };
          setLocalTopics(newTopics);
          if (!topic.id.startsWith('temp-')) {
             await supabase.from('board_top_topics').update({ [field]: value }).eq('id', topic.id);
          }
      };
      const handleAdd = async () => {
          if (!supabase) return;
          const { data } = await supabase.from('board_top_topics').insert({ board_id: boardId, title: '', position: localTopics.length }).select().single();
          if (data) setLocalTopics([...localTopics, data]);
      };
      const handleDelete = async (id: string) => {
          if (!supabase) return;
          await supabase.from('board_top_topics').delete().eq('id', id);
          setLocalTopics(prev => prev.filter(t => t.id !== id));
      };
      return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
           <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Star color="warning" /> Top Themen</DialogTitle>
           <DialogContent>
               <Stack spacing={2} sx={{ mt: 1 }}>
                   {localTopics.map((topic, index) => (
                       <Box key={topic.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                           <TextField fullWidth size="small" placeholder="Thema..." value={topic.title} onChange={(e) => handleSaveTopic(index, 'title', e.target.value)} />
                           <TextField type="date" size="small" value={topic.due_date || ''} onChange={(e) => handleSaveTopic(index, 'due_date', e.target.value)} sx={{ width: 150 }} InputLabelProps={{shrink:true}} />
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

  const filteredCards = useMemo(() => {
      let result = cards;
      if (filters.mine && currentUser?.id) result = result.filter(c => c.assigneeId === currentUser.id);
      if (filters.overdue) { const today = new Date().toISOString().split('T')[0]; result = result.filter(c => c.dueDate && c.dueDate < today); }
      if (filters.important) result = result.filter(c => c.important);
      if (filters.watch) result = result.filter(c => c.watch);
      return result;
  }, [cards, filters, currentUser]);

  const memberColumns = useMemo(() => members.map(m => {
      const mine = filteredCards.filter(c => c.assigneeId === m.profile_id);
      return {
          member: m,
          flow1: mine.filter(c => c.status === 'flow1'),
          flow: mine.filter(c => c.status === 'flow'),
          done: mine.filter(c => c.status === 'done')
      };
  }), [filteredCards, members]);

  const backlogCards = useMemo(() => filteredCards.filter(c => c.status === 'backlog'), [filteredCards]);

  const renderCard = (card: TeamBoardCard, index: number) => {
    const borderColor = highlightCardId === card.cardId ? '#ffc107' : (card.important ? '#d32f2f' : (card.watch ? '#1976d2' : 'rgba(0,0,0,0.12)'));
    const isExternal = card.boardId !== boardId; 
    
    const dateStr = card.dueDate ? new Date(card.dueDate).toLocaleDateString('de-DE') : null;
    const isOverdue = card.dueDate ? new Date(card.dueDate) < new Date() : false;

    return (
      <Draggable key={card.cardId} draggableId={card.cardId} index={index} isDragDisabled={!canModify}>
        {(prov, snap) => (
          <Card
            ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
            sx={{ 
                mb: 1, 
                borderRadius: 1, // Kantiges Design
                border: '1px solid', 
                borderColor, 
                boxShadow: snap.isDragging ? 3 : 1, 
                bgcolor: isExternal ? '#fafafa' : 'background.paper' 
            }}
            onClick={() => openEditDialog(card)}
          >
             <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                     <Chip label={card.boardName} size="small" icon={isExternal ? <LinkIcon style={{fontSize:12}}/> : undefined} sx={{ fontSize: '10px', height: 16, px: 0, bgcolor: isExternal ? '#e3f2fd' : 'rgba(0,0,0,0.05)' }} />
                     <Box>
                        {card.important && <PriorityHighIcon sx={{ fontSize: 14, color: 'error.main' }} />}
                        {card.watch && <AccessTime sx={{ fontSize: 14, color: 'primary.main' }} />}
                     </Box>
                 </Box>
                 <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>{card.description}</Typography>
                 
                 {dateStr && (
                     <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                         <Chip 
                             label={dateStr} 
                             size="small" 
                             variant="outlined" 
                             sx={{ 
                                 height: 18, 
                                 fontSize: '0.65rem', 
                                 color: isOverdue ? 'error.main' : 'text.secondary',
                                 borderColor: isOverdue ? 'error.light' : 'divider'
                             }} 
                         />
                     </Box>
                 )}
             </CardContent>
          </Card>
        )}
      </Draggable>
    );
  };

  if (loading) return <LinearProgress sx={{ mt: 4 }} />;
  if (!supabase) return <Card><CardContent><SupabaseConfigNotice /></CardContent></Card>;

  return (
    <Box sx={{ p: 2, bgcolor: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip icon={<FilterList/>} label="Meine" clickable onClick={() => setFilters(p => ({...p, mine: !p.mine}))} color={filters.mine ? "primary" : "default"} />
              <Chip icon={<Warning/>} label="Überfällig" clickable onClick={() => setFilters(p => ({...p, overdue: !p.overdue}))} color={filters.overdue ? "error" : "default"} />
              <Chip icon={<PriorityHigh/>} label="Wichtig" clickable onClick={() => setFilters(p => ({...p, important: !p.important}))} color={filters.important ? "warning" : "default"} />
              <Chip icon={<AccessTime/>} label="Watch" clickable onClick={() => setFilters(p => ({...p, watch: !p.watch}))} color={filters.watch ? "info" : "default"} />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Top Themen"><IconButton onClick={() => { loadTopTopics(); setTopTopicsOpen(true); }}><Star color="warning" /></IconButton></Tooltip>
              <Tooltip title="KPIs"><IconButton onClick={() => setKpiOpen(true)}><Assessment color="primary" /></IconButton></Tooltip>
              {canConfigure && <IconButton onClick={() => setSettingsOpen(true)} title="Board Einstellungen"><Settings /></IconButton>}
          </Box>
      </Box>
      
      {isHomeBoard && <Alert severity="info" sx={{ py: 0 }}>🏠 <strong>Heimatboard:</strong> Zeigt alle Aufgaben der Mitglieder.</Alert>}

      <Box sx={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
        <DragDropContext onDragEnd={handleDragEnd}>
            {/* BACKLOG */}
            <Box sx={{ width: BACKLOG_WIDTH, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)', borderRadius: 1, border: '1px solid var(--line)' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid var(--line)' }}><Typography variant="subtitle2">SPEICHER ({backlogCards.length})</Typography></Box>
                <Droppable droppableId={droppableKey(null, 'backlog')}>
                    {(prov) => (
                        <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                            {backlogCards.map((c, i) => renderCard(c, i))}
                            {prov.placeholder}
                            {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline/>} onClick={openCreateDialog} sx={{ mt: 1 }}>Neu</Button>}
                        </Box>
                    )}
                </Droppable>
            </Box>

            {/* SWIMLANES */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)', borderRadius: 1, border: '1px solid var(--line)', overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `${COL_WIDTHS.member} 1fr 1fr 1fr`, borderBottom: '1px solid var(--line)', bgcolor: 'rgba(0,0,0,0.02)' }}>
                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>MITARBEITER</Box>
                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)' }}>FLOW 1</Box>
                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)' }}>FLOW</Box>
                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)' }}>FERTIG</Box>
                </Box>

                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {memberColumns.map(({ member, flow1, flow, done }) => (
                        <Box key={member.id} sx={{ display: 'grid', gridTemplateColumns: `${COL_WIDTHS.member} 1fr 1fr 1fr`, borderBottom: '1px solid var(--line)', minHeight: 140 }}>
                            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: 'primary.main' }}>{getInitials(member.profile?.full_name || '?')}</Avatar>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{member.profile?.full_name || 'Unbekannt'}</Typography>
                                </Stack>
                                {member.profile?.company && <Typography variant="caption" color="text.secondary">{member.profile.company}</Typography>}
                            </Box>

                            {/* Spalten */}
                            <Box sx={{ borderLeft: '1px solid var(--line)', p: 1, bgcolor: 'rgba(0,0,0,0.01)' }}>
                                <Droppable droppableId={droppableKey(member.profile_id, 'flow1')}>
                                    {(prov, snap) => (
                                        <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ height: '100%', bgcolor: snap.isDraggingOver ? 'action.hover' : 'transparent', borderRadius: 1 }}>
                                            {flow1.map((c, i) => renderCard(c, i))}
                                            {prov.placeholder}
                                            {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline/>} onClick={() => openQuickAdd(member.profile_id, 'flow1')} sx={{ mt: 1, opacity: 0.5 }}>Neu</Button>}
                                        </Box>
                                    )}
                                </Droppable>
                            </Box>

                            <Box sx={{ borderLeft: '1px solid var(--line)', p: 1 }}>
                                <Droppable droppableId={droppableKey(member.profile_id, 'flow')}>
                                    {(prov, snap) => (
                                        <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ height: '100%', bgcolor: snap.isDraggingOver ? 'action.hover' : 'transparent', borderRadius: 1 }}>
                                            {flow.map((c, i) => renderCard(c, i))}
                                            {prov.placeholder}
                                            {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline/>} onClick={() => openQuickAdd(member.profile_id, 'flow')} sx={{ mt: 1, opacity: 0.5 }}>Neu</Button>}
                                        </Box>
                                    )}
                                </Droppable>
                            </Box>

                            <Box sx={{ borderLeft: '1px solid var(--line)', p: 1, bgcolor: 'rgba(0,0,0,0.01)' }}>
                                <Droppable droppableId={droppableKey(member.profile_id, 'done')}>
                                    {(prov, snap) => (
                                        <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ height: '100%', bgcolor: snap.isDraggingOver ? 'action.hover' : 'transparent', borderRadius: 1 }}>
                                            {done.map((c, i) => renderCard(c, i))}
                                            {prov.placeholder}
                                        </Box>
                                    )}
                                </Droppable>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        </DragDropContext>
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCard ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2} sx={{mt:1}}>
                <TextField fullWidth label="Beschreibung" value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} />
                <TextField fullWidth type="date" label="Fällig" value={draft.dueDate} onChange={e => setDraft({...draft, dueDate: e.target.value})} InputLabelProps={{shrink:true}} />
                <FormControlLabel control={<Checkbox checked={draft.important} onChange={e => setDraft({...draft, important: e.target.checked})} />} label="Wichtige Aufgabe markieren" />
                <FormControlLabel control={<Checkbox checked={draft.watch} onChange={e => setDraft({...draft, watch: e.target.checked})} />} label="Auf Wiedervorlage setzen" />
            </Stack>
        </DialogContent>
        <DialogActions>
            {editingCard && <Button color="error" onClick={deleteTask}>Löschen</Button>}
            <Button onClick={closeDialog}>Abbrechen</Button>
            <Button onClick={saveTask} variant="contained">Speichern</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <DialogTitle>Board Einstellungen</DialogTitle>
          <DialogContent>
              <FormControlLabel 
                control={<Switch checked={isHomeBoard} onChange={(e) => {
                    // Optimistisches Update
                    const newVal = e.target.checked;
                    setIsHomeBoard(newVal);
                    // Lokales Settings-Objekt auch updaten für späteres Save
                    setBoardSettings(prev => ({...prev, isHomeBoard: newVal}));
                }} />} 
                label={<Box><Typography variant="body1" fontWeight="bold">Als Heimatboard nutzen</Typography><Typography variant="caption" color="text.secondary">Zeigt automatisch alle Aufgaben der Mitglieder aus anderen Projekten an.</Typography></Box>} 
                sx={{ mt: 2 }}
              />
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setSettingsOpen(false)}>Abbrechen</Button>
              <Button variant="contained" onClick={saveBoardSettings}>Speichern</Button>
          </DialogActions>
      </Dialog>

      <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
      <TeamKPIDialog open={kpiOpen} onClose={() => setKpiOpen(false)} />
    </Box>
  );
}