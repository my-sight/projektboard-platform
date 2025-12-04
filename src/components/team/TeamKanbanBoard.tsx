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
    Tooltip,
    useTheme,
    alpha
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
    Star,
    DoneAll // Haken-Icon
} from '@mui/icons-material';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { useSnackbar } from 'notistack';
import { keyframes } from '@mui/system';

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import { useLanguage } from '@/contexts/LanguageContext';

// --- Styles & Konstanten ---
const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); border-color: #ffc107; }
  50% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); border-color: #ffc107; background-color: rgba(255, 249, 196, 0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
`;

const COL_WIDTHS = {
    member: '250px',
    flow1: '320px',
    flow: '320px',
    done: '320px'
};
const MIN_CARD_HEIGHT = 100;
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
    position: card.position,
    createdBy: card.createdBy
});

const convertDbToCard = (item: any, boardMap: Map<string, string>, currentBoardId: string): TeamBoardCard => {
    const d = item.card_data || {};
    const isLocal = item.board_id === currentBoardId;
    const status = isLocal ? (d.status as TeamBoardStatus || 'backlog') : mapStageToTeamColumn(item.stage || d['Board Stage']);
    const pos = item.position ?? d.position ?? 0;

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
        position: pos,
        createdBy: d.createdBy,
        originalStage: item.stage || d['Board Stage'],
        originalData: d
    };
};

export default function TeamKanbanBoard({ boardId, onExit, highlightCardId }: TeamKanbanBoardProps) {
    const supabase = useMemo(() => getSupabaseBrowserClient(), []);
    const { enqueueSnackbar } = useSnackbar();
    const { t } = useLanguage();
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
        enqueueSnackbar(t('teamBoard.settingsSaved'), { variant: 'success' });
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

                // Filter logic:
                // STRICT REQUIREMENT: TeamKanbanBoard (used for both Team Boards and Homeboard)
                // MUST ONLY show "Aufgabenkarten" (Team Tasks).
                // "Projektkarten" (which have 'Nummer') must NEVER be shown here.

                const isProjektkarte = !!(d.Nummer || d.project_number);
                if (isProjektkarte) return;

                const assignee = d.assigneeId || d.userId || d.VerantwortlichId;
                const isLocal = item.board_id === boardId;

                if (isLocal || (isHomeBoard && assignee && memberIds.includes(assignee))) {
                    loadedCards.push(convertDbToCard(item, boardMap, boardId));
                }
            });

            loadedCards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
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

        const { data: boardRow } = await supabase.from('kanban_boards').select('owner_id, board_admin_id').eq('id', boardId).maybeSingle();
        const isOwner = boardRow?.owner_id === user.id;
        const isBoardAdmin = boardRow?.board_admin_id === user.id;
        const isMember = currentMembers.some(m => m.profile_id === user.id);

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
    const closeDialog = () => {
        if (!saving) {
            setDialogOpen(false);
            setEditingCard(null);
            setDraft(defaultDraft);
            setDueDateError(false);
        }
    };
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
    const openEditDialog = (card: TeamBoardCard) => {
        if (!canModify) return;
        setEditingCard(card);
        setDraft({
            description: card.description,
            dueDate: card.dueDate ?? '',
            important: card.important,
            watch: card.watch,
            assigneeId: card.assigneeId,
            status: card.status
        });
        setDueDateError(false);
        setDialogOpen(true);
    };
    const handleDraftChange = (k: keyof TaskDraft, v: any) => { setDraft(p => ({ ...p, [k]: v })); if (k === 'dueDate') setDueDateError(!v); };
    const toggleLaneCollapse = (memberId: string) => { setCollapsedLanes(prev => ({ ...prev, [memberId]: !prev[memberId] })); };

    // One-Click-Done
    const handleQuickFinish = async (card: TeamBoardCard, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canModify || !supabase) return;
        setCards(prev => prev.map(c => c.cardId === card.cardId ? { ...c, status: 'done' } : c));
        try {
            const dbStage = 'Fertig';
            await supabase.from('kanban_cards').update({
                stage: dbStage,
                card_data: { ...card.originalData, "Board Stage": dbStage, status: 'done' }
            }).eq('id', card.rowId);
            enqueueSnackbar(t('teamBoard.taskCompleted'), { variant: 'success' });
        } catch (err) { setCards(cards); }
    };

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

        const others = newCards.filter(c => !(c.assigneeId === destInfo.assigneeId && c.status === destInfo.status));
        const targetGroup = newCards.filter(c => c.assigneeId === destInfo.assigneeId && c.status === destInfo.status);

        targetGroup.splice(destination.index, 0, moved);
        targetGroup.forEach((c, i) => c.position = i);

        const finalState = [...others, ...targetGroup];
        setCards(finalState);

        try {
            let dbStage = moved.originalStage || 'Backlog';
            if (destInfo.status === 'done') dbStage = 'Fertig';
            if (destInfo.status === 'backlog') dbStage = 'Backlog';
            if (destInfo.status === 'flow' || destInfo.status === 'flow1') {
                if (['Backlog', 'Fertig', 'Archiv'].includes(dbStage)) dbStage = 'In Bearbeitung';
            }

            const updates = targetGroup.map(c => {
                const isMoved = c.cardId === moved.cardId;
                const payload = {
                    position: c.position,
                    ...(isMoved ? {
                        stage: dbStage,
                        card_data: { ...c.originalData, "Board Stage": dbStage, assigneeId: destInfo.assigneeId, position: c.position, status: destInfo.status }
                    } : {
                        card_data: { ...c.originalData, position: c.position }
                    })
                };
                return supabase.from('kanban_cards').update(payload).eq('id', c.rowId);
            });
            await Promise.all(updates);

        } catch (e) { console.error(e); }
    };

    const saveTask = async () => {
        if (!supabase) return;
        setSaving(true);
        try {
            if (editingCard) {
                const mergedData = {
                    ...editingCard.originalData,
                    description: draft.description,
                    "Due Date": draft.dueDate,
                    important: draft.important,
                    watch: draft.watch,
                    assigneeId: draft.assigneeId,
                    position: editingCard.position
                };
                await supabase.from('kanban_cards').update({ card_data: mergedData }).eq('id', editingCard.rowId);
                enqueueSnackbar(t('teamBoard.taskUpdated'), { variant: 'success' });
            } else {
                const existingInCol = cards.filter(c => c.assigneeId === draft.assigneeId && c.status === draft.status).length;
                await supabase.from('kanban_cards').insert([{
                    board_id: boardId,
                    card_id: crypto.randomUUID(),
                    stage: draft.status === 'done' ? 'Fertig' : 'Backlog',
                    position: existingInCol,
                    card_data: {
                        description: draft.description,
                        "Due Date": draft.dueDate,
                        important: draft.important,
                        watch: draft.watch,
                        assigneeId: draft.assigneeId,
                        "Board Stage": draft.status === 'done' ? 'Fertig' : 'Backlog',
                        position: existingInCol,
                        status: draft.status
                    }
                }]);
                enqueueSnackbar(t('teamBoard.taskCreated'), { variant: 'success' });
            }
            closeDialog();
            const mems = await loadMembers(await fetchClientProfiles());
            loadCards(mems);
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    const deleteTask = async () => {
        if (!editingCard || !supabase) return;
        if (!confirm(t('teamBoard.deletePrompt'))) return;
        await supabase.from('kanban_cards').delete().eq('id', editingCard.rowId);
        setCards(prev => prev.filter(c => c.cardId !== editingCard.cardId));
        closeDialog();
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
            enqueueSnackbar(t('teamBoard.flowCompleted'), { variant: 'success' });
        } catch (e) { console.error(e); } finally { setFlowSaving(false); }
    };

    // --- Sub-Components ---
    const TeamKPIDialog = ({ open, onClose }: any) => (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assessment color="primary" /> {t('teamBoard.kpis')}</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={3}>
                    <Grid item xs={4}><Card sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)' }}><CardContent><Typography variant="h4" color="primary">{kpiStats.activeCount}</Typography><Typography variant="caption">{t('teamBoard.activeTasks')}</Typography></CardContent></Card></Grid>
                    <Grid item xs={4}><Card sx={{ bgcolor: 'rgba(46, 125, 50, 0.04)' }}><CardContent><Typography variant="h4" color="success.main">{kpiStats.doneCount}</Typography><Typography variant="caption">{t('teamBoard.done')}</Typography></CardContent></Card></Grid>
                    <Grid item xs={4}><Card sx={{ bgcolor: kpiStats.overdueCount > 0 ? 'rgba(211, 47, 47, 0.04)' : 'transparent' }}><CardContent><Typography variant="h4" color="error">{kpiStats.overdueCount}</Typography><Typography variant="caption">{t('teamBoard.overdue')}</Typography></CardContent></Card></Grid>
                    <Grid item xs={12}><Typography variant="subtitle1" gutterBottom>{t('teamBoard.workload')}</Typography>
                        {kpiStats.memberLoad.slice(0, 5).map((m, i) => (<Box key={i} sx={{ mb: 1 }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">{m.name}</Typography><Typography variant="body2">{m.count}</Typography></Box><LinearProgress variant="determinate" value={Math.min(100, (m.count / 5) * 100)} /></Box>))}
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions><Button onClick={onClose}>{t('teamBoard.close')}</Button></DialogActions>
        </Dialog>
    );

    const TopTopicsDialog = ({ open, onClose }: any) => {
        const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);
        const [newTitle, setNewTitle] = useState('');
        const [newDate, setNewDate] = useState<string | null>(null);

        useEffect(() => { setLocalTopics(topTopics); }, [topTopics]);

        const handleAdd = async () => {
            if (!supabase || !newTitle.trim()) return;

            const { data } = await supabase
                .from('board_top_topics')
                .insert({
                    board_id: boardId,
                    title: newTitle,
                    due_date: newDate,
                    position: localTopics.length
                })
                .select()
                .single();

            if (data) {
                setLocalTopics([...localTopics, data]);
                setNewTitle('');
                setNewDate(null);
            }
        };

        const handleDelete = async (id: string) => {
            if (!supabase) return;
            await supabase.from('board_top_topics').delete().eq('id', id);
            setLocalTopics(prev => prev.filter(t => t.id !== id));
        };

        return (
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Star color="warning" /> {t('teamBoard.topTopics')}
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        {/* Compose Area */}
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('teamBoard.createTopic')}</Typography>
                            <Stack spacing={2}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    placeholder={t('teamBoard.topicPlaceholder')}
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                />
                                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                                    <StandardDatePicker
                                        label={t('teamBoard.dueDate')}
                                        value={newDate ? dayjs(newDate) : null}
                                        onChange={(newValue) => setNewDate(newValue ? newValue.format('YYYY-MM-DD') : null)}
                                        sx={{ width: 200 }}
                                    />
                                    <Button
                                        variant="contained"
                                        onClick={handleAdd}
                                        disabled={!newTitle.trim()}
                                    >
                                        {t('teamBoard.save')}
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>

                        {/* List Area */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('teamBoard.currentTopics')}</Typography>
                            {localTopics.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">{t('teamBoard.noTopics')}</Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {localTopics.map((topic) => (
                                        <Card key={topic.id} variant="outlined">
                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                                    <Box>
                                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{topic.title}</Typography>
                                                        {topic.due_date && (
                                                            <Chip
                                                                label={`${t('teamBoard.due')}: ${dayjs(topic.due_date).format('DD.MM.YYYY')} (KW ${dayjs(topic.due_date).isoWeek()})`}
                                                                size="small"
                                                                sx={{ mt: 1 }}
                                                            />
                                                        )}
                                                    </Box>
                                                    <IconButton size="small" color="error" onClick={() => handleDelete(topic.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{t('teamBoard.close')}</Button>
                </DialogActions>
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
        const sortByPos = (a: TeamBoardCard, b: TeamBoardCard) => (a.position ?? 0) - (b.position ?? 0);
        return {
            member: m,
            flow1: mine.filter(c => c.status === 'flow1').sort(sortByPos),
            flow: mine.filter(c => c.status === 'flow').sort(sortByPos),
            done: mine.filter(c => c.status === 'done').sort(sortByPos)
        };
    }), [filteredCards, members]);

    const backlogCards = useMemo(() => filteredCards.filter(c => c.status === 'backlog').sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [filteredCards]);

    const renderCard = (card: TeamBoardCard, index: number) => {
        const borderColor = highlightCardId === card.cardId ? '#ffc107' : (card.important ? '#d32f2f' : (card.watch ? '#1976d2' : 'rgba(0,0,0,0.12)'));
        const isExternal = card.boardId !== boardId;
        const dateStr = card.dueDate ? new Date(card.dueDate).toLocaleDateString('de-DE') : null;
        const isOverdue = card.dueDate ? new Date(card.dueDate) < new Date() : false;

        return (
            <Draggable key={card.cardId} draggableId={card.cardId} index={index} isDragDisabled={!canModify}>
                {(prov, snap) => (
                    <Card
                        ref={(el) => { prov.innerRef(el); (cardRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
                        {...prov.draggableProps} {...prov.dragHandleProps}
                        sx={{
                            mb: 1,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor,
                            boxShadow: snap.isDragging ? 3 : 1,
                            bgcolor: isExternal ? '#fafafa' : alpha(theme.palette.background.paper, 0.8),
                            minHeight: MIN_CARD_HEIGHT,
                            position: 'relative',
                            // ✅ ANIMATION WIEDERHERGESTELLT
                            animation: highlightCardId === card.cardId ? `${blinkAnimation} 2s infinite` : 'none'
                        }}
                        onClick={(e) => {
                            if (!(e.target as HTMLElement).closest('button')) {
                                openEditDialog(card);
                            }
                        }}
                    >
                        {/* ✅ BUTTONS WIEDERHERGESTELLT */}
                        <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex', zIndex: 10 }}>
                            <IconButton size="small" onClick={(e) => toggleCardProperty(card, 'important', e)} sx={{ p: 0.5 }}>
                                <PriorityHighIcon sx={{ fontSize: 16, color: card.important ? 'error.main' : 'action.disabled' }} />
                            </IconButton>
                            <IconButton size="small" onClick={(e) => toggleCardProperty(card, 'watch', e)} sx={{ p: 0.5 }}>
                                <AccessTime sx={{ fontSize: 16, color: card.watch ? 'primary.main' : 'action.disabled' }} />
                            </IconButton>
                            {/* Haken für Schnell-Erledigung: NUR für Aufgabenkarten (keine Nummer) */}
                            {card.status !== 'done' && !card.originalData?.Nummer && (
                                <IconButton size="small" color="success" onClick={(e) => handleQuickFinish(card, e)} sx={{ p: 0.5 }}>
                                    <DoneAll sx={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                        </Box>

                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1 } }}>
                            <Box sx={{ display: 'flex', mb: 1 }}>
                                <Chip label={card.boardName} size="small" icon={isExternal ? <LinkIcon style={{ fontSize: 12 }} /> : undefined} sx={{ fontSize: '10px', height: 16, px: 0, bgcolor: isExternal ? '#e3f2fd' : 'rgba(0,0,0,0.05)' }} />
                            </Box>

                            <Tooltip title={card.description} placement="top-start" enterDelay={700}>
                                <Typography variant="body2" sx={{
                                    fontWeight: 500,
                                    lineHeight: 1.3,
                                    display: '-webkit-box',
                                    overflow: 'hidden',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 2,
                                    mr: 6,
                                    minHeight: '2.6em'
                                }}>
                                    {card.description}
                                </Typography>
                            </Tooltip>

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

    // Ref für Auto-Scroll
    const cardRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (highlightCardId && cardRef.current) cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [highlightCardId]);

    if (loading) return <LinearProgress sx={{ mt: 4 }} />;
    if (!supabase) return <Card><CardContent><SupabaseConfigNotice /></CardContent></Card>;

    return (
        <Box sx={{ p: 2, bgcolor: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip icon={<FilterList />} label={t('teamBoard.mine')} clickable onClick={() => setFilters(p => ({ ...p, mine: !p.mine }))} color={filters.mine ? "primary" : "default"} />
                    <Chip icon={<Warning />} label={t('teamBoard.overdue')} clickable onClick={() => setFilters(p => ({ ...p, overdue: !p.overdue }))} color={filters.overdue ? "error" : "default"} />
                    <Chip icon={<PriorityHigh />} label={t('teamBoard.important')} clickable onClick={() => setFilters(p => ({ ...p, important: !p.important }))} color={filters.important ? "warning" : "default"} />
                    <Chip icon={<AccessTime />} label={t('teamBoard.watch')} clickable onClick={() => setFilters(p => ({ ...p, watch: !p.watch }))} color={filters.watch ? "info" : "default"} />
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={t('teamBoard.topTopics')}><IconButton onClick={() => { setTopTopicsOpen(true); }}><Star color="warning" /></IconButton></Tooltip>
                    <Tooltip title={t('teamBoard.kpis')}><IconButton onClick={() => setKpiOpen(true)}><Assessment color="primary" /></IconButton></Tooltip>
                    {canConfigure && <IconButton onClick={() => setSettingsOpen(true)} title={t('teamBoard.boardSettings')}><Settings /></IconButton>}
                </Box>
            </Box>

            {isHomeBoard && <Alert severity="info" sx={{ py: 0 }}>{t('teamBoard.homeBoardInfo')}</Alert>}

            <Box sx={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
                <DragDropContext onDragEnd={handleDragEnd}>
                    {/* BACKLOG */}
                    <Box sx={{ width: BACKLOG_WIDTH, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)', borderRadius: 1, border: '1px solid var(--line)' }}>
                        <Box sx={{ p: 2, borderBottom: '1px solid var(--line)' }}><Typography variant="subtitle2">{t('teamBoard.backlog')} ({backlogCards.length})</Typography></Box>
                        <Droppable droppableId={droppableKey(null, 'backlog')}>
                            {(prov) => (
                                <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                                    {backlogCards.map((c, i) => renderCard(c, i))}
                                    {prov.placeholder}
                                    {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline />} onClick={openCreateDialog} sx={{ mt: 1 }}>Neu</Button>}
                                </Box>
                            )}
                        </Droppable>
                    </Box>

                    {/* SWIMLANES (Mit fixen Spaltenbreiten) */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)', borderRadius: 1, border: '1px solid var(--line)', overflow: 'hidden' }}>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: `${COL_WIDTHS.member} ${COL_WIDTHS.flow1} ${COL_WIDTHS.flow} ${COL_WIDTHS.done}`,
                            borderBottom: '1px solid var(--line)',
                            bgcolor: 'rgba(0,0,0,0.02)',
                            minWidth: 'fit-content' // Verhindert Quetschen
                        }}>
                            <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>{t('teamBoard.employees')}</Box>
                            <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)' }}>{t('teamBoard.flow1')}</Box>
                            <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)' }}>{t('teamBoard.flow')}</Box>
                            <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)' }}>{t('teamBoard.finished')}</Box>
                        </Box>

                        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                            <Box sx={{ minWidth: 'fit-content' }}>
                                {memberColumns.map(({ member, flow1, flow, done }) => {
                                    const isCollapsed = collapsedLanes[member.id];
                                    return (
                                        <Box key={member.id} sx={{ display: 'grid', gridTemplateColumns: `${COL_WIDTHS.member} ${COL_WIDTHS.flow1} ${COL_WIDTHS.flow} ${COL_WIDTHS.done}`, borderBottom: '1px solid var(--line)', minHeight: isCollapsed ? 50 : 140 }}>

                                            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                                    <IconButton size="small" onClick={() => toggleLaneCollapse(member.id)} sx={{ p: 0.5, ml: -1 }}>
                                                        <Typography variant="caption">{isCollapsed ? '▶' : '▼'}</Typography>
                                                    </IconButton>
                                                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: 'primary.main' }}>{getInitials(member.profile?.full_name || '?')}</Avatar>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{member.profile?.full_name || 'Unbekannt'}</Typography>
                                                </Stack>
                                                {!isCollapsed && member.profile?.company && <Typography variant="caption" color="text.secondary" sx={{ ml: 5 }}>{member.profile.company}</Typography>}
                                            </Box>

                                            {!isCollapsed && (
                                                <>
                                                    <Box sx={{ borderLeft: '1px solid var(--line)', p: 1, bgcolor: 'rgba(0,0,0,0.01)' }}>
                                                        <Droppable droppableId={droppableKey(member.profile_id, 'flow1')}>
                                                            {(prov, snap) => (
                                                                <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ height: '100%', bgcolor: snap.isDraggingOver ? 'action.hover' : 'transparent', borderRadius: 1 }}>
                                                                    {flow1.map((c, i) => renderCard(c, i))}
                                                                    {prov.placeholder}
                                                                    {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline />} onClick={() => openQuickAdd(member.profile_id, 'flow1')} sx={{ mt: 1, opacity: 0.5 }}>Neu</Button>}
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
                                                                    {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline />} onClick={() => openQuickAdd(member.profile_id, 'flow')} sx={{ mt: 1, opacity: 0.5 }}>Neu</Button>}
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
                                                </>
                                            )}
                                            {isCollapsed && <Box sx={{ gridColumn: '2 / span 3', display: 'flex', alignItems: 'center', px: 2, color: 'text.disabled', fontStyle: 'italic' }}>{t('teamBoard.collapsed')} ({flow1.length + flow.length + done.length} {t('teamBoard.tasks')})</Box>}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>
                </DragDropContext>
            </Box>

            <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingCard ? t('teamBoard.editTask') : t('teamBoard.newTask')}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField fullWidth label={t('teamBoard.description')} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} multiline minRows={2} />
                        <StandardDatePicker
                            label={t('teamBoard.due')}
                            value={draft.dueDate ? dayjs(draft.dueDate) : null}
                            onChange={(newValue) => setDraft({ ...draft, dueDate: newValue ? newValue.format('YYYY-MM-DD') : '' })}
                        />
                        <FormControlLabel control={<Checkbox checked={draft.important} onChange={e => setDraft({ ...draft, important: e.target.checked })} />} label={t('teamBoard.markImportant')} />
                        <FormControlLabel control={<Checkbox checked={draft.watch} onChange={e => setDraft({ ...draft, watch: e.target.checked })} />} label={t('teamBoard.setResubmission')} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {editingCard && <Button color="error" onClick={deleteTask}>{t('teamBoard.delete')}</Button>}
                    <Button onClick={closeDialog}>{t('teamBoard.cancel')}</Button>
                    <Button onClick={saveTask} variant="contained">{t('teamBoard.save')}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <DialogTitle>{t('teamBoard.boardSettings')}</DialogTitle>
                <DialogContent>
                    <FormControlLabel
                        control={<Switch checked={isHomeBoard} onChange={(e) => setIsHomeBoard(e.target.checked)} />}
                        label={<Box><Typography variant="body1" fontWeight="bold">{t('teamBoard.useAsHomeBoard')}</Typography><Typography variant="caption" color="text.secondary">{t('teamBoard.homeBoardDesc')}</Typography></Box>}
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSettingsOpen(false)}>{t('teamBoard.cancel')}</Button>
                    <Button variant="contained" onClick={saveBoardSettings}>{t('teamBoard.save')}</Button>
                </DialogActions>
            </Dialog>

            <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
            <TeamKPIDialog open={kpiOpen} onClose={() => setKpiOpen(false)} />
        </Box>
    );
}