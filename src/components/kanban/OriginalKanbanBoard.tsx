'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { 
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, TextField, IconButton, Chip, Tabs, Tab, Grid, Card, CardContent, Badge, List, ListItem, InputAdornment, Tooltip, Stack, CircularProgress
} from '@mui/material';
import { DropResult } from '@hello-pangea/dnd';
import { Assessment, Close, Delete, Add, Settings, Assignment, Done, ViewHeadline, ViewList, ViewModule, AddCircle, FilterList, Warning, PriorityHigh, ErrorOutline, Star, ArrowUpward, ArrowDownward, Edit, Wifi, WifiOff } from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { KanbanCard } from './original/KanbanCard';
import { KanbanColumnsView } from './original/KanbanViews';
import { ArchiveDialog, EditCardDialog, NewCardDialog } from './original/KanbanDialogs';
import { nullableDate, toBoolean } from '@/utils/booleans';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';
import { ProjectBoardCard, LayoutDensity } from '@/types';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const formatSupabaseActionError = (action: string, message?: string | null): string => {
  if (!message) return `${action} fehlgeschlagen: Unbekannter Fehler.`;
  if (message.toLowerCase().includes('row-level security')) {
    return `${action} fehlgeschlagen: Fehlende Berechtigungen (RLS).`;
  }
  return `${action} fehlgeschlagen: ${message}`;
};

export interface OriginalKanbanBoardHandle {
  openSettings: () => void;
  openArchive: () => Promise<void>;
  openKpis: () => void;
}

interface OriginalKanbanBoardProps {
  boardId: string;
  onArchiveCountChange?: (count: number) => void;
  onKpiCountChange?: (count: number) => void;
  highlightCardId?: string | null;
  onExit?: () => void;
}

interface TopTopic {
  id: string;
  title: string;
  calendar_week?: string;
  due_date?: string;
  position: number;
}

const DEFAULT_COLS = [
  {id: "c1", name: "Werkzeug beim Werkzeugmacher", done: false},
  {id: "c2", name: "Werkzeugtransport", done: false},
  {id: "c3", name: "Werkzeug in Dillenburg", done: false},
  {id: "c4", name: "Werkzeug in Polen", done: false},
  {id: "c5", name: "Musterung", done: false},
  {id: "c6", name: "Teileversand", done: false},
  {id: "c7", name: "Teile vor Ort", done: false},
  {id: "c8", name: "Fertig", done: true}
];

const OriginalKanbanBoard = forwardRef<OriginalKanbanBoardHandle, OriginalKanbanBoardProps>(
function OriginalKanbanBoard({ boardId, onArchiveCountChange, onKpiCountChange, highlightCardId, onExit }: OriginalKanbanBoardProps, ref) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { enqueueSnackbar } = useSnackbar();

  if (!supabase) return <Box sx={{ p: 3 }}><SupabaseConfigNotice /></Box>;

  // --- State ---
  const [density, setDensity] = useState<LayoutDensity>('compact');
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<ProjectBoardCard[]>([]);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [users, setUsers] = useState<any[]>([]);
  const [canModifyBoard, setCanModifyBoard] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR'>('CLOSED');
  
  const [topTopicsOpen, setTopTopicsOpen] = useState(false);
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  
  const [filters, setFilters] = useState({ mine: false, overdue: false, priority: false, critical: false });
  const [permissions, setPermissions] = useState({ canEditContent: false, canManageSettings: false, canManageAttendance: false });

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedCards, setArchivedCards] = useState<ProjectBoardCard[]>([]);
  const [boardMeta, setBoardMeta] = useState<{ name: string; description?: string | null } | null>(null);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ProjectBoardCard | null>(null);
  const [editTabValue, setEditTabValue] = useState(0);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [kpiPopupOpen, setKpiPopupOpen] = useState(false);
  
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  
  const [checklistTemplates, setChecklistTemplates] = useState<Record<string, string[]>>(() => {
    const templates: Record<string, string[]> = {};
    DEFAULT_COLS.forEach(col => { templates[col.name] = [ "Anforderungen prüfen", "Dokumentation erstellen", "Qualitätskontrolle" ]; });
    return templates;
  });

  // --- Helper ---
  const inferStage = useCallback((r: ProjectBoardCard) => {
    const s = (r["Board Stage"] || "").trim();
    return cols.map(c => c.name).includes(s) ? s : cols[0].name;
  }, [cols]);

  const idFor = useCallback((r: ProjectBoardCard) => {
    if (r["UID"]) return String(r["UID"]);
    if (r.id) return String(r.id);
    if (r.card_id) return String(r.card_id);
    return [r["Nummer"], r["Teil"]].join(" | ");
  }, []);

  const convertDbToCard = useCallback((item: any): ProjectBoardCard => {
    const card = { ...(item.card_data || {}) } as ProjectBoardCard;
    card.UID = card.UID || item.card_id || item.id;
    card.id = item.id; card.card_id = item.card_id;
    if (item.stage) card["Board Stage"] = item.stage;
    if (item.position !== undefined) { card.position = item.position; card.order = item.position; }
    return card;
  }, []);

  const reindexByStage = useCallback((cards: ProjectBoardCard[]): ProjectBoardCard[] => {
    const byStage: Record<string, number> = {};
    return cards.map((c) => {
      const stageKey = inferStage(c);
      byStage[stageKey] = (byStage[stageKey] ?? 0) + 1;
      return { ...c, order: byStage[stageKey], position: byStage[stageKey] };
    });
  }, [inferStage]);
  
  const updateArchivedState = useCallback((cards: ProjectBoardCard[]) => {
    setArchivedCards(cards);
    onArchiveCountChange?.(cards.length);
  }, [onArchiveCountChange]);

  // --- Persistence ---
  const saveSettings = useCallback(async (options?: { skipMeta?: boolean }) => {
    if (!permissions.canManageSettings) return false;
    try {
      const settings = { cols, checklistTemplates, density, lastUpdated: new Date().toISOString() };
      const requestBody: any = { settings };
      if (!options?.skipMeta) {
        const trimmedName = boardName.trim();
        if (!trimmedName && boardMeta?.name) { setBoardName(boardMeta.name); return false; }
        const metaPayload: any = {};
        if (trimmedName !== (boardMeta?.name || '')) metaPayload.name = trimmedName;
        if ((boardDescription.trim() || null) !== (boardMeta?.description ?? null)) metaPayload.description = boardDescription.trim() || null;
        if (Object.keys(metaPayload).length > 0) requestBody.meta = metaPayload;
      }
      const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
      const response = await fetch(`/api/boards/${boardId}/settings`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(requestBody) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        enqueueSnackbar(formatSupabaseActionError('Einstellungen speichern', payload?.error), { variant: 'error' });
        return false;
      }
      const payload = await response.json().catch(() => ({}));
      if (payload.meta) { setBoardMeta(prev => ({ ...prev, ...payload.meta })); }
      
      // Feedback für Einstellungen
      if (!options?.skipMeta) enqueueSnackbar('Einstellungen gespeichert', { variant: 'success' });
      return true;
    } catch (error) {
      enqueueSnackbar(formatSupabaseActionError('Einstellungen speichern', getErrorMessage(error)), { variant: 'error' });
      return false;
    }
  }, [permissions.canManageSettings, boardId, supabase, cols, checklistTemplates, density, boardName, boardDescription, boardMeta, enqueueSnackbar]);

  const patchCard = useCallback(async (card: ProjectBoardCard, changes: Partial<ProjectBoardCard>) => {
    if (!permissions.canEditContent) { enqueueSnackbar('Keine Berechtigung.', { variant: 'error' }); return; }
    
    // OPTIMISTIC UPDATE
    const updatedRows = rows.map(r => idFor(r) === idFor(card) ? { ...r, ...changes } as ProjectBoardCard : r);
    setRows(updatedRows);
    if (selectedCard && idFor(selectedCard) === idFor(card)) { setSelectedCard(prev => prev ? ({ ...prev, ...changes } as ProjectBoardCard) : null); }

    try {
      const payload = {
        card_id: idFor(card),
        updates: {
          card_data: { ...card, ...changes },
          ...(changes['Board Stage'] ? { stage: changes['Board Stage'] } : {}),
          ...(changes.position !== undefined ? { position: changes.position } : {})
        }
      };
      const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
      await fetch(`/api/boards/${boardId}/cards`, { method: 'PATCH', headers, body: JSON.stringify(payload), credentials: 'include' });
      
      // HIER IST DAS NEUE FEEDBACK:
      enqueueSnackbar('Änderungen gespeichert', { variant: 'success', autoHideDuration: 1000 });

    } catch (error) { enqueueSnackbar('Netzwerkfehler', { variant: 'error' }); }
  }, [permissions.canEditContent, rows, idFor, boardId, supabase, enqueueSnackbar, selectedCard]);

  const saveCards = useCallback(async () => {
    if (!permissions.canEditContent) return false;
    try {
      const cardsToSave = rows.map((card) => ({
        board_id: boardId, card_id: idFor(card), card_data: card, stage: inferStage(card), position: card.position ?? card.order ?? 0, project_number: card.Nummer || null, project_name: card.Teil, updated_at: new Date().toISOString(),
      }));
      const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
      const response = await fetch(`/api/boards/${boardId}/cards`, { method: 'POST', headers, body: JSON.stringify({ cards: cardsToSave }), credentials: 'include' });
      
      // Feedback für Bulk-Save (z.B. Drag & Drop)
      if(response.ok) enqueueSnackbar('Board gespeichert', { variant: 'success', autoHideDuration: 1000 });
      
      return response.ok;
    } catch { return false; }
  }, [permissions.canEditContent, boardId, rows, supabase, inferStage, idFor, enqueueSnackbar]);

  const handleTRNeuChange = async (card: any, newDate: string) => {
    if (!permissions.canEditContent) return;
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = users.find(u => u.id === authData.user?.id)?.full_name || 'System';
    const history = Array.isArray(card["TR_History"]) ? [...card["TR_History"]] : [];
    if (card["TR_Neu"] && card["TR_Neu"] !== newDate) { history.push({ date: card["TR_Neu"], changedBy: currentUser, timestamp: new Date().toISOString(), superseded: true }); }
    if (newDate) { history.push({ date: newDate, changedBy: currentUser, timestamp: new Date().toISOString(), superseded: false }); }
    await patchCard(card, { "TR_Neu": newDate, "TR_History": history });
  };

  const loadCards = useCallback(async () => {
    try {
      let { data, error } = await supabase.from('kanban_cards').select('card_data, stage, position, id, card_id').eq('board_id', boardId);
      if (error) throw error;
      if (data) {
        let loadedCards = data.map(convertDbToCard);
        setRows(loadedCards.filter(card => card["Archived"] !== "1"));
        updateArchivedState(loadedCards.filter(card => card["Archived"] === "1"));
      }
    } catch (error) { console.error('Cards load error', error); }
  }, [boardId, supabase, updateArchivedState, convertDbToCard]);

  const loadSettings = useCallback(async () => {
    try {
      const headers = await buildSupabaseAuthHeaders(supabase);
      const response = await fetch(`/api/boards/${boardId}/settings`, { method: 'GET', headers, credentials: 'include' });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload?.settings) {
        const s = payload.settings;
        if (s.cols) setCols(s.cols);
        if (s.density) setDensity(s.density);
      }
    } catch {}
  }, [boardId, supabase]);

  const loadBoardMeta = useCallback(async () => {
    const { data } = await supabase.from('kanban_boards').select('name, description').eq('id', boardId).maybeSingle();
    if (data) { setBoardMeta(data); setBoardName(data.name || ''); setBoardDescription(data.description || ''); }
  }, [boardId, supabase]);

  const loadTopTopics = useCallback(async () => {
    const { data } = await supabase.from('board_top_topics').select('*').eq('board_id', boardId).order('position');
    if (data) setTopTopics(data);
  }, [boardId, supabase]);

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
        const profiles = await fetchClientProfiles();
        setUsers(profiles);
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
            const profile = profiles.find(u => u.id === data.user!.id);
            setCurrentUserName(profile?.full_name || data.user.email || '');
            setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true }); 
            setCanModifyBoard(true);
        }
        await loadBoardMeta();
        await loadSettings();
        await loadCards();
    };
    if (boardId) init();
  }, [boardId, loadCards, loadBoardMeta, loadSettings]);

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!boardId || !supabase) return;
    setRealtimeStatus('CONNECTING');

    const channel = supabase
      .channel(`board-realtime-${boardId}`) 
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kanban_cards',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
             const newCard = convertDbToCard(payload.new);
             if (newCard.Archived !== '1') {
                 setRows(prev => {
                     if (prev.find(r => idFor(r) === idFor(newCard))) return prev;
                     return [...prev, newCard];
                 });
             }
          } else if (payload.eventType === 'UPDATE') {
             const updatedItem = payload.new;
             const updatedCard = convertDbToCard(updatedItem);
             if (updatedCard.Archived === '1') {
                 setRows(prev => prev.filter(r => idFor(r) !== idFor(updatedCard)));
             } else {
                 setRows(prev => {
                     const idx = prev.findIndex(r => idFor(r) === idFor(updatedCard));
                     if (idx === -1) return [...prev, updatedCard];
                     const newRows = [...prev];
                     newRows[idx] = updatedCard;
                     return newRows;
                 });
                 if (selectedCard && idFor(selectedCard) === idFor(updatedCard)) {
                     setSelectedCard(updatedCard);
                 }
             }
          } else if (payload.eventType === 'DELETE') {
             const delId = payload.old.id || payload.old.card_id;
             if (delId) {
                 setRows(prev => prev.filter(r => r.id !== delId && r.card_id !== delId));
             } else {
                 loadCards(); 
             }
          }
        }
      )
      .subscribe((status) => {
          setRealtimeStatus(status);
          // Keine störenden Snackbars hier
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, supabase, convertDbToCard, idFor, loadCards, selectedCard]); // removed enqueueSnackbar


  // --- KPI Calculation ---
  const kpis = useMemo(() => {
    const activeCards = rows.filter(card => card["Archived"] !== "1");
    const kpiData = {
      totalCards: activeCards.length,
      trOverdue: [] as any[],
      trToday: [] as any[],
      trThisWeek: [] as any[],
      ampelGreen: 0,
      ampelRed: 0,
      ampelYellow: 0,
      lkEscalations: [] as any[],
      skEscalations: [] as any[],
      columnDistribution: {} as Record<string, number>,
    };
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    activeCards.forEach(card => {
      const ampel = String(card.Ampel || '').toLowerCase();
      if (ampel === 'grün') kpiData.ampelGreen++; else if (ampel === 'rot') kpiData.ampelRed++; else if (ampel === 'gelb') kpiData.ampelYellow++;
      const eskalation = String(card.Eskalation || '').toUpperCase();
      if (eskalation === 'LK') kpiData.lkEscalations.push(card); if (eskalation === 'SK') kpiData.skEscalations.push(card);
      const trDateStr = card['TR_Neu'] || card['TR_Datum'];
      if (trDateStr && !toBoolean(card.TR_Completed)) {
        const trDate = nullableDate(trDateStr);
        if (trDate) {
           if (trDate < now) kpiData.trOverdue.push(card);
           else if (trDate.toISOString().split('T')[0] === today) kpiData.trToday.push(card);
        }
      }
      const stage = inferStage(card);
      kpiData.columnDistribution[stage] = (kpiData.columnDistribution[stage] || 0) + 1;
    });
    return kpiData;
  }, [rows, inferStage]);
  
  const kpiBadgeCount = kpis.trOverdue.length + kpis.lkEscalations.length + kpis.skEscalations.length;
  useEffect(() => { onKpiCountChange?.(kpiBadgeCount); }, [kpiBadgeCount, onKpiCountChange]);

  // --- Render Filter ---
  const filteredRows = useMemo(() => {
    let result = rows;
    if (searchTerm) result = result.filter(r => Object.values(r).some(v => String(v||'').toLowerCase().includes(searchTerm.toLowerCase())));
    if (filters.mine && currentUserName) {
        const parts = currentUserName.toLowerCase().split(' ').filter(p => p.length > 2);
        result = result.filter(r => {
            const resp = String(r.Verantwortlich || '').toLowerCase();
            return parts.some(p => resp.includes(p));
        });
    }
    if (filters.overdue) result = result.filter(r => r['Due Date'] && r['Due Date'] < new Date().toISOString().split('T')[0]);
    if (filters.priority) result = result.filter(r => toBoolean(r.Priorität));
    if (filters.critical) result = result.filter(r => String(r.Ampel).toLowerCase().includes('rot') || ['LK', 'SK'].includes(String(r.Eskalation).toUpperCase()));
    return result;
  }, [rows, searchTerm, filters, currentUserName]);

  const onDragEnd = (result: DropResult) => {
    if (!permissions.canEditContent || !result.destination) return;
    const { draggableId, destination } = result;
    const newRows = [...rows];
    const cardIdx = newRows.findIndex(r => idFor(r) === draggableId);
    if (cardIdx === -1) return;
    const [moved] = newRows.splice(cardIdx, 1);
    moved["Board Stage"] = destination.droppableId;
    
    const targetCards = newRows.filter(r => inferStage(r) === destination.droppableId);
    let insertIndex = newRows.length;
    if (targetCards.length > 0 && destination.index < targetCards.length) {
        insertIndex = newRows.findIndex(r => idFor(r) === idFor(targetCards[destination.index]));
    }
    newRows.splice(insertIndex, 0, moved);
    const reindexed = reindexByStage(newRows);
    setRows(reindexed);
    saveCards(); // Triggers "Board gespeichert"
  };

  // --- KPI Popup & Dialogs ---
  const TRKPIPopup = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const distribution = Object.entries(kpis.columnDistribution).map(([name, count]) => ({ name, count: count as number }));
    distribution.sort((a, b) => { const idxA = cols.findIndex(c => c.name === a.name); const idxB = cols.findIndex(c => c.name === b.name); return idxA - idxB; });
    const percentage = (count: number) => kpis.totalCards > 0 ? Math.round((count / kpis.totalCards) * 100) : 0;
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assessment color="primary" /> Projekt-KPIs & Metriken <IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton></DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}><Card variant="outlined" sx={{ height: '100%', bgcolor: kpis.trOverdue.length > 0 ? '#ffebee' : 'background.paper' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Überfällige TRs</Typography><Typography variant="h4" color="error.main" sx={{ fontWeight: 700 }}>{kpis.trOverdue.length}</Typography></CardContent></Card></Grid>
            <Grid item xs={12} sm={4}><Card variant="outlined" sx={{ height: '100%', bgcolor: (kpis.lkEscalations.length + kpis.skEscalations.length) > 0 ? '#fff3e0' : 'background.paper' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Eskalationen</Typography><Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>{kpis.lkEscalations.length + kpis.skEscalations.length}</Typography><Typography variant="caption">LK: {kpis.lkEscalations.length} / SK: {kpis.skEscalations.length}</Typography></CardContent></Card></Grid>
            <Grid item xs={12} sm={4}><Card variant="outlined" sx={{ height: '100%' }}><CardContent><Typography variant="subtitle2" color="text.secondary">Gesamt</Typography><Typography variant="h4" sx={{ fontWeight: 700 }}>{kpis.totalCards}</Typography></CardContent></Card></Grid>
            <Grid item xs={12}><Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Projekte pro Phase</Typography><Card variant="outlined"><List dense>{distribution.map((item) => (<ListItem key={item.name}><Grid container alignItems="center" spacing={2}><Grid item xs={4}><Typography variant="body2" fontWeight={500}>{item.name}</Typography></Grid><Grid item xs={6}><Box sx={{ width: '100%', height: 8, bgcolor: '#eee', borderRadius: 1 }}><Box sx={{ width: `${percentage(item.count)}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 1 }} /></Box></Grid><Grid item xs={2} textAlign="right"><Typography variant="caption" fontWeight="bold">{item.count}</Typography></Grid></Grid></ListItem>))}</List></Card></Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    );
  };
  const TopTopicsDialog = ({ open, onClose }: any) => {
      const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);
      useEffect(() => { setLocalTopics(topTopics); }, [topTopics]);
      const handleSaveTopic = async (index: number, field: string, value: any) => { const newTopics = [...localTopics]; newTopics[index] = { ...newTopics[index], [field]: value }; setLocalTopics(newTopics); if (newTopics[index].id && !newTopics[index].id.startsWith('tmp')) { await supabase.from('board_top_topics').update({ [field]: value }).eq('id', newTopics[index].id); }};
      const handleAdd = async () => { const { data } = await supabase.from('board_top_topics').insert({ board_id: boardId, title: '', position: localTopics.length }).select().single(); if (data) setLocalTopics([...localTopics, data]); };
      const handleDelete = async (id: string) => { await supabase.from('board_top_topics').delete().eq('id', id); setLocalTopics(prev => prev.filter(t => t.id !== id)); };
      return (<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth><DialogTitle>Top Themen</DialogTitle><DialogContent><Stack spacing={2}>{localTopics.map((t,i)=>(<Box key={t.id} sx={{display:'flex',gap:1}}><TextField value={t.title} onChange={(e)=>handleSaveTopic(i,'title',e.target.value)} fullWidth size="small"/><IconButton onClick={()=>handleDelete(t.id)}><Delete/></IconButton></Box>))}{localTopics.length<5&&<Button onClick={handleAdd}>+ Add</Button>}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Close</Button></DialogActions></Dialog>);
  };
  const SettingsDialog = ({ open, onClose }: any) => {
    const [localCols, setLocalCols] = useState(cols); const [tab, setTab] = useState(0); const [newCol, setNewCol] = useState(''); useEffect(() => { if(open) setLocalCols(cols); }, [open, cols]);
    const handleSave = async () => { setCols(localCols); await saveSettings(); onClose(); };
    const addCol = () => { if(newCol.trim()) { setLocalCols([...localCols, { id: `c${Date.now()}`, name: newCol.trim(), done: false }]); setNewCol(''); } };
    const moveCol = (idx: number, dir: number) => { const copy = [...localCols]; const [item] = copy.splice(idx, 1); copy.splice(idx + dir, 0, item); setLocalCols(copy); };
    return (<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth><DialogTitle>Einstellungen</DialogTitle><DialogContent dividers><Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}><Tab label="Allgemein" /><Tab label="Spalten" /></Tabs>{tab===0&&<Box><TextField label="Name" value={boardName} onChange={(e)=>setBoardName(e.target.value)} fullWidth sx={{mb:2}}/><TextField label="Beschreibung" value={boardDescription} onChange={(e)=>setBoardDescription(e.target.value)} fullWidth multiline rows={2}/></Box>}{tab===1&&<Box><List dense>{localCols.map((c,i)=>(<ListItem key={c.id}><TextField value={c.name} onChange={(e)=>{const cp=[...localCols];cp[i].name=e.target.value;setLocalCols(cp)}} size="small" fullWidth/><IconButton onClick={()=>moveCol(i,-1)} disabled={i===0}><ArrowUpward/></IconButton><IconButton onClick={()=>moveCol(i,1)} disabled={i===localCols.length-1}><ArrowDownward/></IconButton><IconButton onClick={()=>setLocalCols(localCols.filter(x=>x.id!==c.id))}><Delete/></IconButton></ListItem>))}</List><Box sx={{display:'flex',gap:1,mt:2}}><TextField value={newCol} onChange={(e)=>setNewCol(e.target.value)} label="Neue Spalte" size="small" fullWidth/><Button variant="contained" onClick={addCol}>Add</Button></Box></Box>}</DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={handleSave}>Speichern</Button></DialogActions></Dialog>);
  };

  useImperativeHandle(ref, () => ({
    openSettings: () => setSettingsOpen(true),
    openArchive: async () => { await loadCards(); setArchiveOpen(true); },
    openKpis: () => setKpiPopupOpen(true),
  }));

  // --- RENDER ---
  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)', color: 'var(--ink)', '&': { '--colw': '300px', '--rowheadw': '260px' } as any }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 5, background: 'linear-gradient(180deg,rgba(0,0,0,.05),transparent),var(--panel)', borderBottom: '1px solid var(--line)', p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr repeat(2, auto) repeat(3, auto) repeat(3, auto)', gap: 1.5, alignItems: 'center' }}>
          <TextField size="small" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ minWidth: 220 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
             <Chip icon={<FilterList />} label="Meine" clickable color={filters.mine ? "primary" : "default"} onClick={() => setFilters(p => ({ ...p, mine: !p.mine }))} />
             <Chip icon={<Warning />} label="Überfällig" clickable color={filters.overdue ? "error" : "default"} onClick={() => setFilters(p => ({ ...p, overdue: !p.overdue }))} />
             <Chip icon={<PriorityHigh />} label="Wichtig" clickable color={filters.priority ? "warning" : "default"} onClick={() => setFilters(p => ({ ...p, priority: !p.priority }))} />
             <Chip icon={<ErrorOutline />} label="Kritisch" clickable color={filters.critical ? "error" : "default"} onClick={() => setFilters(p => ({ ...p, critical: !p.critical }))} />
          </Box>
          <Button variant={density==='compact'?'contained':'outlined'} onClick={()=>setDensity('compact')} sx={{minWidth:'auto',p:1}}><ViewHeadline/></Button>
          <Button variant={density==='large'?'contained':'outlined'} onClick={()=>setDensity('large')} sx={{minWidth:'auto',p:1}}><ViewModule/></Button>
          <Button variant="contained" size="small" startIcon={<AddCircle />} onClick={() => setNewCardOpen(true)}>Neue Karte</Button>
          
          {permissions.canManageSettings && <IconButton onClick={() => setSettingsOpen(true)}><Settings fontSize="small" /></IconButton>}
          <Tooltip title="Top Themen"><IconButton onClick={() => { loadTopTopics(); setTopTopicsOpen(true); }}><Star fontSize="small" color="warning" /></IconButton></Tooltip>
          <Badge badgeContent={kpiBadgeCount} color="error" overlap="circular">
            <IconButton onClick={() => setKpiPopupOpen(true)}><Assessment fontSize="small" /></IconButton>
          </Badge>
          
          {/* REALTIME INDICATOR */}
          <Tooltip title={realtimeStatus === 'SUBSCRIBED' ? 'Live verbunden' : 'Verbinde...'}>
             <Box sx={{ 
                 width: 10, height: 10, borderRadius: '50%', 
                 bgcolor: realtimeStatus === 'SUBSCRIBED' ? 'success.main' : (realtimeStatus === 'CHANNEL_ERROR' ? 'error.main' : 'warning.main'),
                 boxShadow: '0 0 4px rgba(0,0,0,0.2)' 
             }} />
          </Tooltip>

        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
         <KanbanColumnsView rows={filteredRows} cols={cols} density={density} searchTerm={searchTerm} onDragEnd={onDragEnd} inferStage={inferStage} archiveColumn={()=>{}} renderCard={(card, i) => (
            <KanbanCard
                key={idFor(card)} card={card} index={i} density={density} rows={filteredRows} setRows={setRows} saveCards={saveCards} patchCard={patchCard} setSelectedCard={setSelectedCard} setEditModalOpen={setEditModalOpen} setEditTabValue={setEditTabValue} inferStage={inferStage} idFor={idFor} users={users} canModify={permissions.canEditContent} highlighted={highlightCardId === idFor(card) || highlightCardId === card.card_id}
            />
         )} allowDrag={permissions.canEditContent} />
      </Box>

      <EditCardDialog selectedCard={selectedCard} editModalOpen={editModalOpen} setEditModalOpen={setEditModalOpen} editTabValue={editTabValue} setEditTabValue={setEditTabValue} rows={rows} setRows={setRows} users={users} lanes={[]} checklistTemplates={checklistTemplates} inferStage={inferStage} addStatusEntry={()=>{}} updateStatusSummary={()=>{}} handleTRNeuChange={handleTRNeuChange} saveCards={saveCards} idFor={idFor} setSelectedCard={setSelectedCard} patchCard={patchCard} />
      <NewCardDialog newCardOpen={newCardOpen} setNewCardOpen={setNewCardOpen} cols={cols} lanes={[]} rows={rows} setRows={setRows} users={users} />
      <ArchiveDialog archiveOpen={archiveOpen} setArchiveOpen={setArchiveOpen} archivedCards={archivedCards} restoreCard={()=>{}} deleteCardPermanently={()=>{}} />
      <TRKPIPopup open={kpiPopupOpen} onClose={() => setKpiPopupOpen(false)} />
      <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
});

export default OriginalKanbanBoard;