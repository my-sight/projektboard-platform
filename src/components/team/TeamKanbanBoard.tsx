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
    alpha,
    Divider,
    Paper,
    Tabs,
    Tab
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
    DoneAll, // Haken-Icon
    CheckCircleOutline,
    Inventory2,
    Description // Icon for Status Report
} from '@mui/icons-material';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { useSnackbar } from 'notistack';
import { keyframes } from '@mui/material/styles';

import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
// import SupabaseConfigNotice from '@/components/SupabaseConfigNotice'; // Removed
// import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders'; // Removed
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);
import { ProjectStatusReportDialog } from '../board/management/ProjectStatusReportDialog';

import { useLanguage } from '@/contexts/LanguageContext';
import { generateUUID } from '@/lib/uuid';

// --- Styles & Konstanten ---
const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); border-color: #ffc107; }
  50% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); border-color: #ffc107; background-color: rgba(255, 249, 196, 0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
`;

const COL_WIDTHS = {
    member: '200px',
    flow1: '260px',
    flow: '260px',
    done: '260px'
};
const MIN_CARD_HEIGHT = 100;
const BACKLOG_WIDTH = 260;

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
    createdAt?: string;
    assigneeProfile?: ClientProfile | null;
}

interface TeamKanbanBoardProps { boardId: string; onExit?: () => void; highlightCardId?: string | null; }
interface TaskDraft { description: string; dueDate: string; important: boolean; watch: boolean; assigneeId: string | null; status: TeamBoardStatus; }
interface DroppableInfo { assigneeId: string | null; status: TeamBoardStatus; }
interface TopTopic { id: string; title: string; calendar_week?: string; due_date?: string; position: number; }

const defaultDraft: TaskDraft = { description: '', dueDate: '', important: false, watch: false, assigneeId: null, status: 'backlog' };

const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2);
};
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

const redundantFields = [
    'Nummer', 'Teil', 'title', 'SOP_Neu', 'TR_Neu', 'MS_Neu',
    'SOP-Datum', 'TR-Datum', 'assigneeId', 'userId', 'VerantwortlichId',
    'dueDate', 'Due Date', 'important', 'description',
    'Board Stage', 'position', 'order'
];

const purgeRedundantFields = (data: any) => {
    if (!data) return data;
    const purged = { ...data };
    redundantFields.forEach(f => delete purged[f]);
    return purged;
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

// Helper Component removed from top level and moved into main component scope

// --- Helper Component: ProjectPicker ---
function ProjectPicker({ selectedId, onSelect }: { selectedId: string | null, onSelect: (id: string | null) => void }) {
    const { t } = useLanguage();
    const [rootBoards, setRootBoards] = useState<any[]>([]);
    const [selectedBoardId, setSelectedBoardId] = useState<string>('');
    const [boardCards, setBoardCards] = useState<any[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>(selectedId || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRoots = async () => {
            const { data } = await supabase.from('kanban_boards')
                .select('id, name, settings')
                .is('parent_id', null)
                .order('name');

            if (data) {
                const filtered = data.filter((b: any) => {
                    const s = b.settings || {};
                    return !(s.boardType === 'team' || !!s.teamBoard || b.name === 'Team Board');
                });
                setRootBoards(filtered);
            }
        };
        fetchRoots();
    }, []);

    useEffect(() => {
        if (selectedBoardId) {
            setLoading(true);
            supabase.from('kanban_cards')
                .select('id, project_name, project_number, card_data')
                .eq('board_id', selectedBoardId)
                .then(({ data }) => {
                    const cards = (data || []).map((c: any) => {
                        const pName = c.project_name || c.card_data?.Teil || c.card_data?.title || (t('kanban.noTitle') || 'Unbenanntes Projekt');
                        const pNum = c.project_number || c.card_data?.Nummer || '';
                        return {
                            id: c.id,
                            title: pNum ? `${pNum} - ${pName}` : pName
                        };
                    }).sort((a: any, b: any) => a.title.localeCompare(b.title));
                    setBoardCards(cards);
                    setLoading(false);
                });
        } else {
            setBoardCards([]);
        }
    }, [selectedBoardId, t]);

    return (
        <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('kanban.tabDetails') || 'Verknüpftes Projekt'}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('teamBoard.homeBoardDesc') || 'Wählen Sie ein Projekt aus, um den "Projekt Status" Button zu aktivieren.'}
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                <TextField
                    select
                    label={t('kanban.boardName') || 'Board auswählen (Root)'}
                    value={selectedBoardId}
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    fullWidth
                    size="small"
                    SelectProps={{ native: true }}
                >
                    <option value="">{t('common.select') || 'Bitte wählen...'}</option>
                    {rootBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </TextField>

                <TextField
                    select
                    label="Projektkarte auswählen"
                    value={selectedCardId}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCardId(val);
                        onSelect(val);
                    }}
                    fullWidth
                    size="small"
                    disabled={!selectedBoardId && !selectedCardId}
                    SelectProps={{ native: true }}
                >
                    <option value="">{loading ? 'Lade...' : (selectedCardId && !selectedBoardId ? 'Aktuell Verknüpft' : 'Bitte wählen...')}</option>
                    {boardCards.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </TextField>
            </Box>
        </Box>
    );
}

export default function TeamKanbanBoard({ boardId, onExit, highlightCardId }: TeamKanbanBoardProps) {
    // const supabase = useMemo(() => getSupabaseBrowserClient(), []); // Removed
    const { enqueueSnackbar } = useSnackbar();
    const { t } = useLanguage();

    const convertDbToCard = useCallback((item: any, boardMap: Map<string, string>, currentBoardId: string): TeamBoardCard => {
        let d = item.card_data || {};
        if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (e) { d = {}; }
        }
        const isLocal = item.board_id === currentBoardId;
        const status = isLocal ? (d.status as TeamBoardStatus || 'backlog') : mapStageToTeamColumn(item.stage || d['Board Stage']);
        const pos = item.position ?? d.position ?? 0;

        // Relational Mapping: Overwrite local data with truth from DB columns
        const mergedData = { ...d };
        if (item.project_number) mergedData.Nummer = item.project_number;
        if (item.project_name) {
            mergedData.Teil = item.project_name;
            mergedData.title = item.project_name;
        }
        if (item.sop_date_current) mergedData.SOP_Neu = item.sop_date_current;
        if (item.ms_date_current) mergedData.TR_Neu = item.ms_date_current;
        if (item.assignee_id) mergedData.assigneeId = item.assignee_id;
        if (item.due_date) mergedData.dueDate = item.due_date;
        if (item.is_important !== undefined) mergedData.important = !!item.is_important;
        if (item.task_description) mergedData.description = item.task_description;
        if (item.is_completed !== undefined) {
            if (item.is_completed) mergedData.status = 'done';
            mergedData.TR_Completed = !!item.is_completed;
        }

        return {
            rowId: String(item.id),
            cardId: String(item.card_id || item.id),
            boardId: item.board_id,
            boardName: boardMap.get(item.board_id) || (t('kanban.unknown') || 'Unbekannt'),
            description: item.task_description || d.description || d.Teil || d.Nummer || (t('dashboard.task') || 'Aufgabe'),
            dueDate: item.due_date || d['Due Date'] || d.dueDate || null,
            important: Boolean(item.is_important ?? (d.important || d.Priorität)),
            watch: Boolean(d.watch),
            assigneeId: item.assignee_id || d.assigneeId || d.userId || d.VerantwortlichId || null,
            status: status,
            position: pos,
            createdAt: item.created || item.created_at,
            createdBy: d.createdBy,
            originalStage: item.stage || d['Board Stage'],
            originalData: mergedData,
            assigneeProfile: item.assigneeProfile || null
        };
    }, [t]);
    const { user, profile, visibilityCounter } = useAuth();
    const theme = useTheme();
    const isFetchingRef = useRef(false);

    const [members, setMembers] = useState<MemberWithProfile[]>([]);
    const [cards, setCards] = useState<TeamBoardCard[]>([]);
    const [archivedCards, setArchivedCards] = useState<TeamBoardCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [canModify, setCanModify] = useState(false);
    const [canConfigure, setCanConfigure] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [topTopics, setTopTopics] = useState<any[]>([]);
    const [topTopicsOpen, setTopTopicsOpen] = useState(false);
    const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
    const [isHomeBoard, setIsHomeBoard] = useState(false);
    const [tempIsHomeBoard, setTempIsHomeBoard] = useState(false);
    const [tempMembers, setTempMembers] = useState<MemberWithProfile[]>([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState(0);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [boardName, setBoardName] = useState('');
    const [boardDescription, setBoardDescription] = useState('');
    const [draft, setDraft] = useState<TaskDraft>(defaultDraft);
    const [editingCard, setEditingCard] = useState<TeamBoardCard | null>(null);
    const [saving, setSaving] = useState(false);
    const [dueDateError, setDueDateError] = useState(false);
    const [boardSettings, setBoardSettings] = useState<Record<string, any>>({});
    const [completedCount, setCompletedCount] = useState(0);
    const [flowSaving, setFlowSaving] = useState(false);

    const [users, setUsers] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);


    const [kpiOpen, setKpiOpen] = useState(false);
    const [filters, setFilters] = useState({ mine: false, overdue: false, important: false, watch: false });

    // Linked Project State
    const [linkedReportOpen, setLinkedReportOpen] = useState(false);
    const [linkedCard, setLinkedCard] = useState<any | null>(null);

    // Card-Specific Status Report State
    const [reportingCard, setReportingCard] = useState<any | null>(null);
    const [reportingDialogOpen, setReportingDialogOpen] = useState(false);

    const handleOpenReportingDialog = async (projectNumber: string) => {
        if (!projectNumber) return;
        try {
            // Find the project card with this number in ANY board
            const { data } = await supabase
                .from('kanban_cards')
                .select('*')
                .filter('card_data->>Nummer', 'eq', projectNumber)
                .limit(1)
                .single();

            if (data) {
                setReportingCard(data);
                setReportingDialogOpen(true);
            } else {
                enqueueSnackbar(`${t('error') || 'Fehler'}: ${t('projectNotFound', { number: projectNumber }) || `Projekt ${projectNumber} nicht gefunden`}`, { variant: 'error' });
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(t('boardManagement.loadError') || 'Fehler beim Laden des Projekts', { variant: 'error' });
        }
    };

    // Fetch Linked Card Effect
    useEffect(() => {
        const fetchLinkedCard = async () => {
            const linkedId = boardSettings?.linked_card_id;
            if (linkedId) {
                const { data } = await supabase.from('kanban_cards').select('*').eq('id', linkedId).single();
                if (data) {
                    setLinkedCard(data);
                } else {
                    setLinkedCard(null);
                }
            } else {
                setLinkedCard(null);
            }
        };
        fetchLinkedCard();
    }, [boardSettings?.linked_card_id]);

    // --- Loading ---
    const loadBoardSettings = useCallback(async () => {
        try {
            const { data: record, error } = await supabase
                .from('kanban_boards')
                .select('*')
                .eq('id', boardId)
                .single();
            if (error) throw error;

            setBoardName(record.name);
            setBoardDescription(record.description || '');

            const s = record.settings || {};
            setBoardSettings(s);
            setIsHomeBoard(!!s.isHomeBoard);
            setTempIsHomeBoard(!!s.isHomeBoard);
            setCompletedCount(Number(s.teamBoard?.completedCount || 0));
        } catch (e) {
            console.error(e);
        }
    }, [boardId]);

    const persistCompletedCount = useCallback(async (nextCount: number) => {
        const nextSettings = { ...boardSettings, teamBoard: { ...(boardSettings.teamBoard || {}), completedCount: nextCount } };
        try {
            await supabase
                .from('kanban_boards')
                .update({ settings: nextSettings })
                .eq('id', boardId);
            setBoardSettings(nextSettings);
            setCompletedCount(nextCount);
        } catch (e) {
            console.error(e);
        }
    }, [boardId, boardSettings]);

    // Initial load for settings dialog
    useEffect(() => {
        if (settingsOpen) {
            (async () => {
                try {
                    const { data: b } = await supabase.from('kanban_boards').select('name, description').eq('id', boardId).single();
                    if (b) {
                        setBoardName(b.name);
                        setBoardDescription(b.description || '');
                    }
                } catch (e) { console.error('Error loading board details', e); }
            })();
            setTempMembers(members); // Ensure members are always initialized for reordering
            setSettingsTab(0); // Reset to first tab
        }
    }, [settingsOpen, boardId, members]); // Added 'members' to deps

    const saveBoardSettings = async () => {
        const nextSettings = { ...boardSettings, isHomeBoard: tempIsHomeBoard, memberOrder: tempMembers.map(m => m.profile_id) };
        try {
            const { data, error } = await supabase.from('kanban_boards').update({
                name: boardName,
                description: boardDescription,
                settings: nextSettings
            }).eq('id', boardId).select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Speichern fehlgeschlagen: Keine Schreibrechte oder Board nicht gefunden.");
            }

            setBoardSettings(nextSettings); // Update local state immediately
            setIsHomeBoard(tempIsHomeBoard);
            setMembers(tempMembers); // Update actual members list with new order
            setSettingsOpen(false);
            enqueueSnackbar('Einstellungen gespeichert', { variant: 'success' });
        } catch (e: any) {
            console.error('Fehler beim Speichern der Board-Einstellungen:', e);
            enqueueSnackbar(`Fehler: ${e.message || 'Unbekannter Fehler'}`, { variant: 'error' });
        }
    };

    const handleMemberReorder = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(tempMembers);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setTempMembers(items);
    };

    const handleFinishDone = async () => {
        if (!confirm('Alle erledigten Karten ins Archiv verschieben?')) return;
        try {
            // Find all cards in 'done' status
            const cardsToArchive = cards.filter(c => c.status === 'done');

            await Promise.all(cardsToArchive.map(c =>
                supabase.from('kanban_cards').update({
                    card_data: { ...(c.originalData || {}), archived: true, Archived: '1' }
                }).eq('id', c.rowId)
            ));

            await persistCompletedCount(completedCount + cardsToArchive.length);
            setCards(prev => prev.filter(c => c.status !== 'done'));
            enqueueSnackbar(`${cardsToArchive.length} Aufgaben archiviert`, { variant: 'success' });
        } catch (e) {
            console.error(e);
            enqueueSnackbar(t('error'), { variant: 'error' });
        }
    };

    const loadArchive = async () => {
        try {
            const { data: records } = await supabase
                .from('kanban_cards')
                .select('*')
                .eq('board_id', boardId);

            if (!records) return;

            const archived = records
                .filter(r => (r.card_data?.archived || r.card_data?.Archived === '1'))
                .map(r => convertDbToCard(r, new Map(), boardId));

            // Sort by creation date (descending)
            archived.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

            setArchivedCards(archived);
        } catch (e) { console.error(e); }
    };

    const restoreCard = async (card: TeamBoardCard) => {
        try {
            await supabase.from('kanban_cards').update({
                card_data: { ...card.originalData, archived: false, Archived: '0' }
            }).eq('id', card.rowId);

            setArchivedCards(prev => prev.filter(c => c.rowId !== card.rowId));
            loadCards(members); // Refresh board
            enqueueSnackbar('Karte wiederhergestellt', { variant: 'success' });
        } catch (e) {
            enqueueSnackbar(t('error'), { variant: 'error' });
        }
    };

    const deleteCardPermanently = async (rowId: string) => {
        if (!confirm('Endgültig löschen?')) return;
        try {
            await supabase.from('kanban_cards').delete().eq('id', rowId);
            setArchivedCards(prev => prev.filter(c => c.rowId !== rowId));
        } catch (e) { console.error(e); }
    };

    const loadAllUsers = useCallback(async () => { try { const profiles = await fetchClientProfiles(); setUsers(profiles); return profiles; } catch (err) { return []; } }, []);

    const loadMembers = useCallback(async (availableProfiles: ClientProfile[], settings: any) => {
        try {
            const { data } = await supabase
                .from('board_members')
                .select('*')
                .eq('board_id', boardId);

            const memberList = data || [];

            const mapped = memberList.map((entry: any) => {
                const userId = entry.user_id || entry.profile_id;
                const profile = availableProfiles.find((c) => c.id === userId) ?? null;
                return (profile && (profile.is_active ?? true)) ? { ...entry, profile_id: userId, profile } : null;
            }).filter((e) => e !== null) as MemberWithProfile[];

            // Sort members according to settings if order exists
            if (settings?.memberOrder && Array.isArray(settings.memberOrder)) {
                mapped.sort((a, b) => {
                    const idxA = settings.memberOrder.indexOf(a.profile_id);
                    const idxB = settings.memberOrder.indexOf(b.profile_id);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            }

            setMembers(mapped);
            return mapped;
        } catch (e: any) {
            console.error(e);
            enqueueSnackbar(`Systemfehler: ${e.message || e}`, { variant: 'error' });
            return [];
        }
    }, [boardId]);

    const loadCards = useCallback(async (currentMembers: MemberWithProfile[]) => {
        try {
            const { data: boards } = await supabase.from('kanban_boards').select('id,name');
            const boardMap = new Map((boards || []).map((b: any) => [b.id, b.name]));

            let records;
            if (isHomeBoard) {
                const { data } = await supabase.from('kanban_cards').select('*');
                records = data || [];
            } else {
                const { data } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .eq('board_id', boardId);
                records = data || [];
            }

            const memberIds = currentMembers.map(m => m.profile_id);
            const loadedCards: TeamBoardCard[] = [];

            records.forEach(item => {
                let d = item.card_data || {};

                // Check if card or item has Archived flag
                if (d.Archived === '1' || d.archived) return;

                const isProjektkarte = !!(d.Nummer || d.project_number);
                if (isProjektkarte) return;

                const assignee = d.assigneeId || d.userId || d.VerantwortlichId;
                const isLocal = item.board_id === boardId;

                if (isLocal || (isHomeBoard && assignee && memberIds.includes(assignee))) {
                    const card = convertDbToCard(item, boardMap, boardId);
                    if (assignee) {
                        card.assigneeProfile = currentMembers.find(m => m.profile_id === assignee)?.profile || null;
                    }
                    loadedCards.push(card);
                }
            });

            loadedCards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            setCards(loadedCards);
        } catch (error) { console.error(error); }
    }, [boardId, isHomeBoard]);

    const loadTopTopics = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('board_top_topics')
                .select('*')
                .eq('board_id', boardId);
            setTopTopics((data || []) as any[]);
        } catch (e) { console.error(e); }
    }, [boardId]);

    const evaluatePermissions = useCallback(async (profiles: ClientProfile[], currentMembers: MemberWithProfile[]) => {
        if (!user) { console.warn('No auth model found'); return; }
        setCurrentUser(user);

        // PRIO 1: SUPERUSER FORCE
        if (user.email && isSuperuserEmail(user.email)) {
            // console.log('⚡️ Superuser detected (TeamBoard):', user.email);
            setCanModify(true);
            setCanConfigure(true);
            return;
        }

        // console.log('Evaluating permissions for:', user.email, user.id);

        let userProfile: any = profile;
        if (!userProfile) userProfile = profiles.find(p => p.id === user.id) || null;

        const globalRole = String(userProfile?.role ?? '').toLowerCase();
        const isSuper = isSuperuserEmail(user.email || '') || globalRole === 'admin' || globalRole === 'superuser';

        let boardRow = null;
        try {
            const { data } = await supabase.from('kanban_boards').select('*').eq('id', boardId).single();
            boardRow = data;
        } catch (e) { /* ignore */ }

        const isOwner = boardRow?.owner_id === user.id;
        const isBoardAdmin = boardRow?.board_admin_id === user.id;
        const isMember = currentMembers.some(m => m.profile_id === user.id);

        setCanModify(isSuper || isOwner || isBoardAdmin || isMember);
        setCanConfigure(isSuper || isOwner || isBoardAdmin);
    }, [boardId, user, profile]);

    useEffect(() => {
        let active = true;
        const init = async () => {
            setLoading(true);
            const settings = await loadBoardSettings();
            const profiles = await loadAllUsers();
            const mems = await loadMembers(profiles, settings);
            if (active) {
                await loadCards(mems);
                await loadTopTopics();
                await evaluatePermissions(profiles, mems);
                // console.log('Init complete. Loading:', false);
                setLoading(false);
            }
        };
        init();

        return () => {
            active = false;
        };
    }, [boardId, loadBoardSettings, loadAllUsers, loadMembers, loadCards, loadTopTopics, evaluatePermissions]);

    // centralized visibility refresh via AuthContext signal
    useEffect(() => {
        const runRefresh = async () => {
            if (isFetchingRef.current || saving) return;
            isFetchingRef.current = true;
            try {
                console.log('[TeamKanbanBoard] Visibility refresh triggered via AuthContext');
                await loadBoardSettings();
                await loadTopTopics();
                if (members.length > 0) {
                    await loadCards(members);
                }
            } finally {
                isFetchingRef.current = false;
            }
        };

        if (visibilityCounter > 0 && user) {
            runRefresh();
        }
    }, [visibilityCounter, user, members, loadBoardSettings, loadTopTopics, loadCards]);


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
            const displayName = m.profile?.full_name || m.profile?.alias || m.profile?.email || '?';
            return {
                name: displayName,
                count,
                avatar: getInitials(displayName),
                avatar_url: m.profile?.avatar_url
            };
        }).sort((a, b) => b.count - a.count);

        const currentDone = cards.filter(c => c.status === 'done').length;
        return { activeCount: active.length, backlogCount: backlog.length, doneCount: currentDone, overdueCount: overdue.length, importantCount: cards.filter(c => c.important).length, watchCount: cards.filter(c => c.watch).length, memberLoad };
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
        if (!canModify) return;
        setCards(prev => prev.map(c => c.cardId === card.cardId ? { ...c, status: 'done' } : c));
        try {
            const dbStage = 'Fertig';
            await supabase.from('kanban_cards').update({
                stage: dbStage,
                card_data: { ...card.originalData, "Board Stage": dbStage, status: 'done' }
            }).eq('id', card.rowId);
            enqueueSnackbar('Aufgabe erledigt', { variant: 'success' });
        } catch (err) { console.error(err); setCards(cards); }
    };

    const toggleCardProperty = async (card: TeamBoardCard, property: 'important' | 'watch', e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canModify) return;
        const newValue = !card[property];
        setCards(prev => prev.map(c => c.cardId === card.cardId ? { ...c, [property]: newValue } : c));
        try {
            await supabase.from('kanban_cards').update({
                card_data: { ...card.originalData, [property]: newValue }
            }).eq('id', card.rowId);
        } catch (err) { console.error(err); setCards(cards); }
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!canModify || !result.destination) return;
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

        // Sort target group by position to ensure correct insertion index
        targetGroup.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        targetGroup.splice(destination.index, 0, moved);
        targetGroup.forEach((c, i) => c.position = i);

        const finalState = [...others, ...targetGroup];
        setCards(finalState);
        setSaving(true);

        try {
            let dbStage = moved.originalStage || 'Backlog';
            if (destInfo.status === 'done') dbStage = 'Fertig';
            if (destInfo.status === 'backlog') dbStage = 'Backlog';
            if (destInfo.status === 'flow' || destInfo.status === 'flow1') {
                if (['Backlog', 'Fertig', 'Archiv'].includes(dbStage)) dbStage = 'In Bearbeitung';
            }

            const promises = targetGroup.map(c => {
                const isMoved = c.cardId === moved.cardId;
                const payload: any = {
                    position: c.position,
                    ...(isMoved ? {
                        stage: dbStage,
                        card_data: purgeRedundantFields({ ...c.originalData, "Board Stage": dbStage, assigneeId: destInfo.assigneeId, position: c.position, status: destInfo.status }),
                        // Optimized Columns (Dual-Writing)
                        assignee_id: destInfo.assigneeId || null,
                        is_completed: destInfo.status === 'done'
                    } : {
                        card_data: { ...c.originalData, position: c.position }
                    })
                };
                return supabase.from('kanban_cards').update(payload).eq('id', c.rowId);
            });

            const results = await Promise.all(promises);
            const firstError = results.find(r => r.error)?.error;
            if (firstError) {
                enqueueSnackbar(`Drag&Drop Fehler: ${firstError.message}`, { variant: 'error' });
                return;
            }

        } catch (e: any) {
            console.error(e);
            enqueueSnackbar(`Drag&Drop Systemfehler: ${e.message || e}`, { variant: 'error' });
        } finally {
            setTimeout(() => {
                setSaving(false);
            }, 1000);
        }
    };

    const saveTask = async () => {
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
                const { error } = await supabase.from('kanban_cards').update({
                    card_data: purgeRedundantFields(mergedData),
                    // Optimized Columns (Dual-Writing)
                    task_description: String(draft.description || ''),
                    due_date: draft.dueDate || null,
                    is_important: !!draft.important,
                    assignee_id: draft.assigneeId || null,
                    is_completed: editingCard.status === 'done',
                    project_name: String((editingCard.originalData as any)?.Teil || (editingCard.originalData as any)?.title || '')
                }).eq('id', editingCard.rowId);

                if (error) {
                    enqueueSnackbar(`Speicherfehler: ${error.message}`, { variant: 'error' });
                    return;
                }
                enqueueSnackbar('Aufgabe aktualisiert', { variant: 'success' });
            } else {
                const existingInCol = cards.filter(c => c.assigneeId === draft.assigneeId && c.status === draft.status).length;
                const { error } = await supabase.from('kanban_cards').insert({
                    board_id: boardId,
                    card_id: generateUUID(),
                    stage: draft.status === 'done' ? 'Fertig' : 'Backlog',
                    position: existingInCol,
                    // Optimized Columns (Dual-Writing)
                    task_description: String(draft.description || ''),
                    due_date: draft.dueDate || null,
                    is_important: !!draft.important,
                    assignee_id: draft.assigneeId || null,
                    is_completed: draft.status === 'done',
                    project_name: String(draft.description || 'Neue Aufgabe'),
                    card_data: purgeRedundantFields({
                        description: draft.description,
                        "Due Date": draft.dueDate,
                        important: draft.important,
                        watch: draft.watch,
                        assigneeId: draft.assigneeId,
                        "Board Stage": draft.status === 'done' ? 'Fertig' : 'Backlog',
                        position: existingInCol,
                        status: draft.status
                    })
                });
                if (error) {
                    enqueueSnackbar(`Erstellfehler: ${error.message}`, { variant: 'error' });
                    return;
                }
                enqueueSnackbar('Aufgabe erstellt', { variant: 'success' });
            }
            closeDialog();
            const mems = await loadMembers(await fetchClientProfiles(), boardSettings);
            loadCards(mems);
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    const deleteTask = async () => {
        if (!editingCard) return;
        if (!confirm('Karte wirklich löschen?')) return;

        try {
            await supabase.from('kanban_cards').delete().eq('id', editingCard.rowId);
            setCards(prev => prev.filter(c => c.cardId !== editingCard.cardId));
            closeDialog();
        } catch (e) {
            console.error(e);
        }
    };

    const handleCompleteFlow = async () => {
        if (!canModify || flowSaving) return;
        setFlowSaving(true);
        try {
            const doneCards = cards.filter(c => c.status === 'done');
            for (const card of doneCards) {
                await supabase.from('kanban_cards').update({
                    card_data: purgeRedundantFields({ ...card.originalData, Archived: "1", ArchivedDate: new Date().toISOString() }),
                    stage: 'Archiv'
                }).eq('id', card.rowId);
            }
            await persistCompletedCount(completedCount + doneCards.length);
            setCards(prev => prev.filter(c => c.status !== 'done'));
            enqueueSnackbar('Flow abgeschlossen', { variant: 'success' });
        } catch (e) { console.error(e); } finally { setFlowSaving(false); }
    };

    // --- Sub-Components ---
    const TeamKPIDialog = ({ open, onClose }: any) => (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assessment color="primary" /> Kennzahlen</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={3}>
                    <Grid item xs={4}><Card sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)' }}><CardContent><Typography variant="h4" color="primary">{kpiStats.activeCount}</Typography><Typography variant="caption">Aktive Aufgaben</Typography></CardContent></Card></Grid>
                    <Grid item xs={4}><Card sx={{ bgcolor: 'rgba(46, 125, 50, 0.04)' }}><CardContent><Typography variant="h4" color="success.main">{kpiStats.doneCount}</Typography><Typography variant="caption">Erledigt</Typography></CardContent></Card></Grid>
                    <Grid item xs={4}><Card sx={{ bgcolor: kpiStats.overdueCount > 0 ? 'rgba(211, 47, 47, 0.04)' : 'transparent' }}><CardContent><Typography variant="h4" color="error">{kpiStats.overdueCount}</Typography><Typography variant="caption">Überfällig</Typography></CardContent></Card></Grid>
                    <Grid item xs={12}><Typography variant="subtitle1" gutterBottom>Arbeitslast</Typography>
                        {kpiStats.memberLoad.slice(0, 5).map((m, i) => (<Box key={i} sx={{ mb: 1 }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">{m.name}</Typography><Typography variant="body2">{m.count}</Typography></Box><LinearProgress variant="determinate" value={Math.min(100, (m.count / 5) * 100)} /></Box>))}
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions><Button onClick={onClose}>Schließen</Button></DialogActions>
        </Dialog>
    );

    const TopTopicsDialog = ({ open, onClose }: any) => {
        const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);
        const [newTitle, setNewTitle] = useState('');
        const [newDate, setNewDate] = useState<string | null>(null);

        useEffect(() => { setLocalTopics(topTopics); }, [topTopics]);

        const handleAdd = async () => {
            if (!newTitle.trim()) return;

            try {
                const { data, error } = await supabase.from('board_top_topics').insert({
                    board_id: boardId,
                    title: newTitle,
                    due_date: newDate,
                    position: localTopics.length
                }).select().single();

                if (data) {
                    // map record to TopTopic interface if needed, or assume it matches enough
                    const topic: TopTopic = {
                        id: data.id,
                        title: data.title,
                        due_date: data.due_date,
                        position: data.position
                    };

                    setLocalTopics([...localTopics, topic]);
                    setNewTitle('');
                    setNewDate(null);
                }
            } catch (e) { console.error(e); }
        };

        const handleDelete = async (id: string) => {
            try {
                await supabase.from('board_top_topics').delete().eq('id', id);
                setLocalTopics(prev => prev.filter(t => t.id !== id));
            } catch (e) { console.error(e); }
        };

        return (
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Star color="warning" /> Top-Themen
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        {/* Compose Area */}
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle2" sx={{ mb: 2 }}>Neues Thema erstellen</Typography>
                            <Stack spacing={2}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    placeholder="Thema / Notiz..."
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                />
                                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                                    <StandardDatePicker
                                        label="Fällig am"
                                        value={newDate ? dayjs(newDate) : null}
                                        onChange={(newValue) => setNewDate(newValue ? newValue.format('YYYY-MM-DD') : null)}
                                        sx={{ width: 200 }}
                                    />
                                    <Button
                                        variant="contained"
                                        onClick={handleAdd}
                                        disabled={!newTitle.trim()}
                                    >
                                        Speichern
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>

                        {/* List Area */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Aktuelle Themen</Typography>
                            {localTopics.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Keine aktuellen Themen</Typography>
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
                                                                label={`Fällig: ${dayjs(topic.due_date).format('DD.MM.YYYY')} (KW ${dayjs(topic.due_date).isoWeek()})`}
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
                    <Button onClick={onClose}>Schließen</Button>
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
        const borderColor = highlightCardId === card.cardId
            ? theme.palette.warning.main
            : (card.important ? theme.palette.error.main : (card.watch ? theme.palette.primary.main : theme.palette.divider));
        const isExternal = card.boardId !== boardId;
        const dateStr = card.dueDate ? new Date(card.dueDate).toLocaleDateString('de-DE') : null;
        const isOverdue = card.dueDate ? new Date(card.dueDate) < new Date() : false;

        return (
            <Draggable key={card.cardId} draggableId={card.cardId} index={index} isDragDisabled={!canModify}>
                {(prov, snap) => (
                    <Card
                        id={`card-${card.cardId}`}
                        ref={prov.innerRef}
                        {...prov.draggableProps} {...prov.dragHandleProps}
                        sx={{
                            mb: 1,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor,
                            boxShadow: snap.isDragging ? 3 : 1,
                            bgcolor: isExternal
                                ? (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#fafafa')
                                : alpha(theme.palette.background.paper, 0.15),
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Chip
                                    label={card.boardName}
                                    size="small"
                                    variant="outlined"
                                    icon={isExternal ? <LinkIcon style={{ fontSize: 12 }} /> : undefined}
                                    sx={{
                                        fontSize: '10px',
                                        height: 16,
                                        px: 0,
                                        bgcolor: 'transparent',
                                        color: theme.palette.text.secondary,
                                        borderColor: isExternal ? alpha(theme.palette.primary.main, 0.3) : 'divider'
                                    }}
                                />
                                {card.originalData?.Nummer && (
                                    <Chip
                                        label={card.originalData.Nummer}
                                        size="small"
                                        variant="outlined"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenReportingDialog(card.originalData.Nummer);
                                        }}
                                        sx={{
                                            fontSize: '10px',
                                            height: 16,
                                            fontWeight: 700,
                                            bgcolor: 'transparent',
                                            color: theme.palette.primary.main,
                                            borderColor: theme.palette.primary.main,
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            }
                                        }}
                                    />
                                )}
                                {/* Display SOP and MS dates from originalData if available */}
                                {(() => {
                                    const d = card.originalData || {};
                                    const sop = d.SOP_Neu || d.SOP_Datum;
                                    const ms = d.MS_Neu || d.MS_Datum || d.TR_Neu || d.TR_Datum;
                                    return (
                                        <>
                                            {sop && (
                                                <Chip
                                                    label={`SOP: ${sop}`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: '9px',
                                                        height: 16,
                                                        color: '#ed6c02',
                                                        borderColor: alpha('#ed6c02', 0.5),
                                                        bgcolor: 'transparent'
                                                    }}
                                                />
                                            )}
                                            {ms && (
                                                <Chip
                                                    label={`MS: ${ms}`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: '9px',
                                                        height: 16,
                                                        color: '#0288d1',
                                                        borderColor: alpha('#0288d1', 0.5),
                                                        bgcolor: 'transparent'
                                                    }}
                                                />
                                            )}
                                        </>
                                    );
                                })()}
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

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {card.assigneeProfile && (
                                        <Tooltip title={card.assigneeProfile.full_name || card.assigneeProfile.name || '?'}>
                                            <Avatar
                                                src={card.assigneeProfile.avatar_url || undefined}
                                                sx={{ width: 16, height: 16, fontSize: '0.6rem' }}
                                            >
                                                {getInitials(card.assigneeProfile.full_name || card.assigneeProfile.name || '?')}
                                            </Avatar>
                                        </Tooltip>
                                    )}
                                </Box>
                                {dateStr && (
                                    <Chip
                                        icon={<AccessTime sx={{ fontSize: '14px !important' }} />}
                                        label={dateStr}
                                        size="small"
                                        variant="outlined"
                                        color={isOverdue ? 'error' : 'default'}
                                        sx={{ height: 20, fontSize: '10px', fontWeight: 600 }}
                                    />
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                )}
            </Draggable>
        );
    };

    // Auto-Scroll Logic for Highlighted Card
    useEffect(() => {
        if (highlightCardId) {
            // Short timeout to ensure DOM is ready
            setTimeout(() => {
                const el = document.getElementById(`card-${highlightCardId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [highlightCardId, filteredCards]);

    if (loading && members.length === 0) return <LinearProgress sx={{ mt: 4 }} />;


    return (
        <Box sx={{ p: 2, bgcolor: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Header Row: Title & Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">{boardName || (t('home.teamBoard') || 'Team Board')}</Typography>
                    {boardDescription && <Typography variant="body2" color="text.secondary">{boardDescription}</Typography>}
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={t('teamBoard.topTopics') || 'Top-Themen'}><IconButton onClick={() => { setTopTopicsOpen(true); }} color="default"><Star /></IconButton></Tooltip>
                    <Tooltip title={t('teamBoard.kpis') || 'Kennzahlen'}><IconButton onClick={() => setKpiOpen(true)} color="default"><Assessment /></IconButton></Tooltip>
                    {canConfigure && <IconButton onClick={() => setSettingsOpen(true)} title={t('teamBoard.boardSettings') || 'Board-Einstellungen'} color="default"><Settings /></IconButton>}
                </Box>
            </Box>

            {/* Filter Row */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                    icon={<FilterList />}
                    label={t('teamBoard.mine') || 'Meine'}
                    clickable
                    onClick={() => {
                        const newMineState = !filters.mine;
                        setFilters(p => ({ ...p, mine: newMineState }));

                        if (newMineState && currentUser?.id) {
                            // Collapse all except mine
                            const newCollapsed: Record<string, boolean> = {};
                            members.forEach(m => {
                                if (m.profile_id !== currentUser.id) {
                                    newCollapsed[m.profile_id] = true;
                                    // Also use member.id if that's what's used for keys, 
                                    // checking toggleLaneCollapse usage: toggleLaneCollapse(member.id)
                                    // member.id seems to be the board_member table id, but let's check what logic uses.
                                    // render loop uses: key={member.id} and collapsedLanes[member.id]
                                    newCollapsed[m.id] = true;
                                }
                            });
                            setCollapsedLanes(newCollapsed);
                        } else {
                            // Expand all
                            setCollapsedLanes({});
                        }
                    }}
                    color={filters.mine ? "primary" : "default"}
                    variant="outlined"
                    sx={{ bgcolor: 'transparent' }}
                />
                <Chip icon={<Warning />} label={t('teamBoard.overdue') || 'Überfällig'} clickable onClick={() => setFilters(p => ({ ...p, overdue: !p.overdue }))} color={filters.overdue ? "error" : "default"} variant="outlined" sx={{ bgcolor: 'transparent' }} />
                <Chip icon={<PriorityHigh />} label={t('teamBoard.important') || 'Wichtig'} clickable onClick={() => setFilters(p => ({ ...p, important: !p.important }))} color={filters.important ? "warning" : "default"} variant="outlined" sx={{ bgcolor: 'transparent' }} />
                <Chip icon={<AccessTime />} label={t('teamBoard.watch') || 'Wiedervorlage'} clickable onClick={() => setFilters(p => ({ ...p, watch: !p.watch }))} color={filters.watch ? "info" : "default"} variant="outlined" sx={{ bgcolor: 'transparent' }} />

                <Box sx={{ flexGrow: 1 }} />

                {linkedCard && (
                    <Chip
                        icon={<Description style={{ fontSize: '1rem' }} />}
                        label={linkedCard.card_data?.Teil || linkedCard.card_data?.title || linkedCard.task_description || (t('dashboard.projects') || 'Projekt')}
                        onClick={() => setLinkedReportOpen(true)}
                        color="primary"
                        variant="outlined"
                        clickable
                        size="medium"
                        sx={{ maxWidth: 300 }}
                    />
                )}
            </Box>

            {isHomeBoard && <Alert severity="info" sx={{ py: 0 }}>{t('homeBoardInfo') || 'Dies ist ein Sammelboard (Heimatboard). Es zeigt Aufgaben aus allen Team-Boards an.'}</Alert>}

            <Box sx={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
                <DragDropContext onDragEnd={handleDragEnd}>
                    {/* BACKLOG */}
                    <Box sx={{ width: BACKLOG_WIDTH, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)', borderRadius: 1, border: '1px solid var(--line)' }}>
                        <Box sx={{ p: 2, borderBottom: '1px solid var(--line)' }}><Typography variant="subtitle2">{t('teamBoard.backlog') || 'Backlog'} ({backlogCards.length})</Typography></Box>
                        <Droppable droppableId={droppableKey(null, 'backlog')}>
                            {(prov) => (
                                <Box ref={prov.innerRef} {...prov.droppableProps} sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                                    {backlogCards.map((c, i) => renderCard(c, i))}
                                    {prov.placeholder}
                                    {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline />} onClick={openCreateDialog} sx={{ mt: 1 }}>{t('teamBoard.new') || 'Neu'}</Button>}
                                </Box>
                            )}
                        </Droppable>
                    </Box>

                    {/* SWIMLANES (Mit fixen Spaltenbreiten) */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'var(--panel)', borderRadius: 1, border: '1px solid var(--line)', overflow: 'hidden' }}>
                        <Box sx={{ flex: 1, overflow: 'auto' }}>
                            <Box sx={{ minWidth: 'fit-content' }}>
                                {/* Header Row */}
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `${COL_WIDTHS.member} ${COL_WIDTHS.flow1} ${COL_WIDTHS.flow} ${COL_WIDTHS.done}`,
                                    borderBottom: '1px solid var(--line)',
                                    bgcolor: 'rgba(0,0,0,0.02)',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 10,
                                    backdropFilter: 'blur(5px)'
                                }}>
                                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', bgcolor: 'var(--panel)' }}>{t('dashboard.team') || 'Team'}</Box>
                                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)', bgcolor: 'var(--panel)' }}>{t('teamBoard.flow1') || 'Flow 1'}</Box>
                                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)', bgcolor: 'var(--panel)' }}>{t('teamBoard.flow') || 'Flow'}</Box>
                                    <Box sx={{ p: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary', borderLeft: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--panel)' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {t('teamBoard.done') || 'Erledigt'}
                                            <Chip
                                                label={completedCount + cards.filter(c => c.status === 'done').length}
                                                size="small"
                                                variant="outlined"
                                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'transparent', color: 'success.main', borderColor: 'success.main' }}
                                            />
                                        </Box>
                                        <Tooltip title={t('kanban.archive') || 'Archiv'}>
                                            <IconButton
                                                onClick={handleFinishDone}
                                                sx={{
                                                    p: 0.5,
                                                    color: 'primary.main',
                                                    bgcolor: 'rgba(25, 118, 210, 0.1)',
                                                    '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.2)' },
                                                    flexShrink: 0
                                                }}
                                            >
                                                <Inventory2 sx={{ fontSize: 20 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>

                                {/* Rows */}
                                {memberColumns.map(({ member, flow1, flow, done }) => {
                                    const isCollapsed = collapsedLanes[member.id];
                                    return (
                                        <Box key={member.id} sx={{ display: 'grid', gridTemplateColumns: `${COL_WIDTHS.member} ${COL_WIDTHS.flow1} ${COL_WIDTHS.flow} ${COL_WIDTHS.done}`, borderBottom: '1px solid var(--line)', minHeight: isCollapsed ? 50 : 140 }}>

                                            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                                    <IconButton size="small" onClick={() => toggleLaneCollapse(member.id)} sx={{ p: 0.5, ml: -1 }}>
                                                        <Typography variant="caption">{isCollapsed ? '▶' : '▼'}</Typography>
                                                    </IconButton>
                                                    <Avatar
                                                        src={member.profile?.avatar_url || undefined}
                                                        sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: 'primary.main' }}
                                                    >
                                                        {getInitials(member.profile?.alias || member.profile?.full_name || '?')}
                                                    </Avatar>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                            {member.profile?.alias || member.profile?.full_name || (t('kanban.unknown') || 'Unbekannt')}
                                                        </Typography>
                                                        {member.profile?.alias && member.profile?.full_name && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mt: -0.5 }}>
                                                                {member.profile.full_name}
                                                            </Typography>
                                                        )}
                                                    </Box>
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
                                                                    {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline />} onClick={() => openQuickAdd(member.profile_id, 'flow1')} sx={{ mt: 1, opacity: 0.5 }}>{t('teamBoard.new') || 'Neu'}</Button>}
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
                                                                    {canModify && <Button fullWidth size="small" startIcon={<AddCircleOutline />} onClick={() => openQuickAdd(member.profile_id, 'flow')} sx={{ mt: 1, opacity: 0.5 }}>{t('teamBoard.new') || 'Neu'}</Button>}
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
                                            {isCollapsed && <Box sx={{ gridColumn: '2 / span 3', display: 'flex', alignItems: 'center', px: 2, color: 'text.disabled', fontStyle: 'italic' }}>{t('teamBoard.collapsedTasks', { count: flow1.length + flow.length + done.length }) || `Eingeklappt (${flow1.length + flow.length + done.length} Aufgaben)`}</Box>}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>
                </DragDropContext>
            </Box>

            <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingCard ? (t('teamBoard.editTask') || 'Aufgabe bearbeiten') : (t('teamBoard.newTask') || 'Neue Aufgabe')}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField fullWidth label={t('teamBoard.description') || 'Beschreibung'} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} multiline minRows={2} />
                        <StandardDatePicker
                            label={t('teamBoard.due') || 'Fällig'}
                            value={draft.dueDate ? dayjs(draft.dueDate) : null}
                            onChange={(newValue) => setDraft({ ...draft, dueDate: newValue ? newValue.format('YYYY-MM-DD') : '' })}
                        />
                        <FormControlLabel control={<Checkbox checked={draft.important} onChange={e => setDraft({ ...draft, important: e.target.checked })} />} label={t('teamBoard.markImportant') || 'Als wichtig markieren'} />
                        <FormControlLabel control={<Checkbox checked={draft.watch} onChange={e => setDraft({ ...draft, watch: e.target.checked })} />} label={t('teamBoard.setResubmission') || 'Wiedervorlage setzen'} />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between' }}>
                    <Box>
                        {editingCard && <Button color="error" onClick={deleteTask}>{t('common.delete') || 'Löschen'}</Button>}
                        <Button onClick={closeDialog} sx={{ ml: editingCard ? 1 : 0 }}>{t('common.cancel') || 'Abbrechen'}</Button>
                    </Box>
                    <Button onClick={saveTask} variant="contained">{t('common.save') || 'Speichern'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <DialogTitle>{t('teamBoard.boardSettings') || 'Board-Einstellungen'}</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs value={settingsTab} onChange={(_, v) => setSettingsTab(v)}>
                            <Tab label={t('kanban.metaData') || 'Meta-Daten'} />
                            <Tab label={t('dashboard.team') || 'Team'} />
                        </Tabs>
                    </Box>

                    {settingsTab === 0 && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <FormControlLabel
                                control={<Switch checked={tempIsHomeBoard} onChange={(e) => setTempIsHomeBoard(e.target.checked)} />}
                                label={<Box><Typography variant="body1" fontWeight="bold">{t('teamBoard.useAsHomeBoard') || 'Als Heimatboard nutzen'}</Typography><Typography variant="caption" color="text.secondary">{t('teamBoard.homeBoardDesc') || 'Aggregiert Karten von allen anderen Team-Boards'}</Typography></Box>}
                            />
                            <Divider />
                            <TextField
                                fullWidth
                                label={t('kanban.boardName') || 'Name des Boards'}
                                value={boardName}
                                onChange={(e) => setBoardName(e.target.value)}
                            />
                            <TextField
                                fullWidth
                                label={t('teamBoard.description') || 'Beschreibung'}
                                value={boardDescription}
                                onChange={(e) => setBoardDescription(e.target.value)}
                                multiline
                                minRows={3}
                            />
                            <Divider />
                            <ProjectPicker
                                selectedId={boardSettings.linked_card_id || ''}
                                onSelect={(id) => setBoardSettings(prev => ({ ...prev, linked_card_id: id }))}
                            />
                            <Tooltip title={t('kanban.openArchive') || 'Archiv öffnen'}>
                                <IconButton onClick={() => { setSettingsOpen(false); setArchiveOpen(true); loadArchive(); }}>
                                    <Inventory2 />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    )}

                    {settingsTab === 1 && (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('teamBoard.memberOrder') || 'Reihenfolge der Teammitglieder'}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                {t('teamBoard.memberOrderDesc') || 'Ziehen Sie die Mitglieder, um die Reihenfolge der Lanes im Board zu ändern.'}
                            </Typography>

                            <DragDropContext onDragEnd={handleMemberReorder}>
                                <Droppable droppableId="members-list">
                                    {(provided) => (
                                        <Box {...provided.droppableProps} ref={provided.innerRef}>
                                            <Stack spacing={1}>
                                                {tempMembers.map((m, index) => (
                                                    <Draggable key={m.profile_id} draggableId={m.profile_id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <Paper
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                variant="outlined"
                                                                sx={{
                                                                    p: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 1.5,
                                                                    bgcolor: snapshot.isDragging ? 'action.selected' : 'background.paper',
                                                                    boxShadow: snapshot.isDragging ? theme.shadows[3] : 'none',
                                                                    cursor: 'grab'
                                                                }}
                                                            >
                                                                <Avatar
                                                                    src={m.profile?.avatar_url || undefined}
                                                                    sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                                                                >
                                                                    {getInitials(m.profile?.alias || m.profile?.full_name || '?')}
                                                                </Avatar>
                                                                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                                                    {m.profile?.alias || m.profile?.full_name || (t('kanban.unknown') || 'Unbekannt')}
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>☰</Typography>
                                                            </Paper>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </Stack>
                                        </Box>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between' }}>
                    <Button onClick={() => setSettingsOpen(false)}>{t('common.cancel') || 'Abbrechen'}</Button>
                    <Button variant="contained" onClick={saveBoardSettings}>{t('common.save') || 'Speichern'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{t('kanban.archive') || 'Archiv'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {archivedCards.length === 0 && <Typography color="text.secondary" align="center">{t('kanban.archiveEmpty') || 'Keine archivierten Karten'}</Typography>}
                        {archivedCards.map(card => (
                            <Paper key={card.rowId} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">{card.description}</Typography>
                                    <Typography variant="body2" color="text.secondary">{card.boardName} - {new Date(card.createdAt || Date.now()).toLocaleDateString()}</Typography>
                                </Box>
                                <Box>
                                    <Button size="small" onClick={() => restoreCard(card)}>{t('kanban.restore') || 'Wiederherstellen'}</Button>
                                    <IconButton size="small" color="error" onClick={() => deleteCardPermanently(card.rowId)}><Delete /></IconButton>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'flex-start' }}>
                    <Button onClick={() => setArchiveOpen(false)}>{t('close') || 'Schließen'}</Button>
                </DialogActions>
            </Dialog>

            <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
            <TeamKPIDialog open={kpiOpen} onClose={() => setKpiOpen(false)} />

            {linkedCard && (
                <ProjectStatusReportDialog
                    open={linkedReportOpen}
                    onClose={() => setLinkedReportOpen(false)}
                    card={linkedCard}
                    boardId={linkedCard.board_id}
                />
            )}

            {reportingCard && (
                <ProjectStatusReportDialog
                    open={reportingDialogOpen}
                    onClose={() => setReportingDialogOpen(false)}
                    card={reportingCard}
                    boardId={reportingCard.board_id}
                />
            )}
        </Box>
    );
}