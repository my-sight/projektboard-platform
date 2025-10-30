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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';

interface BoardMember {
  id: string;
  profile_id: string;
}

interface MemberWithProfile extends BoardMember {
  profile: ClientProfile | null;
}

export type TeamBoardStatus = 'backlog' | 'flow1' | 'flow' | 'done';

interface TeamBoardCard {
  rowId: string;
  cardId: string;
  description: string;
  dueDate: string | null;
  important: boolean;
  assigneeId: string | null;
  status: TeamBoardStatus;
  position: number;
}

interface TeamKanbanBoardProps {
  boardId: string;
}

interface TaskDraft {
  description: string;
  dueDate: string;
  important: boolean;
}

interface DroppableInfo {
  assigneeId: string | null;
  status: TeamBoardStatus;
}

const statusLabels: Record<TeamBoardStatus, string> = {
  backlog: 'Aufgabenspeicher',
  flow1: 'Flow-1',
  flow: 'Flow',
  done: 'Fertig',
};

const CARD_HEIGHT = 92;
const CARD_WIDTH = 260;

const defaultDraft: TaskDraft = {
  description: '',
  dueDate: '',
  important: false,
};

const droppableKey = (assigneeId: string | null, status: TeamBoardStatus) =>
  `team|${assigneeId ?? 'unassigned'}|${status}`;

const parseDroppableKey = (value: string): DroppableInfo => {
  if (!value.startsWith('team|')) {
    return { assigneeId: null, status: 'backlog' };
  }
  const [, rawAssignee, rawStatus] = value.split('|');
  const status = (['backlog', 'flow1', 'flow', 'done'] as TeamBoardStatus[]).includes(rawStatus as TeamBoardStatus)
    ? (rawStatus as TeamBoardStatus)
    : 'backlog';
  const assigneeId = rawAssignee === 'unassigned' ? null : rawAssignee;
  return { assigneeId, status };
};

const buildCardData = (card: TeamBoardCard) => ({
  type: 'teamTask',
  description: card.description,
  dueDate: card.dueDate,
  important: card.important,
  assigneeId: card.assigneeId,
  status: card.status,
});

const createColumnsMapFromCards = (cards: TeamBoardCard[]) => {
  const map = new Map<string, TeamBoardCard[]>();

  cards.forEach((card) => {
    const key = droppableKey(card.assigneeId, card.status);
    const entries = map.get(key) ?? [];
    entries.push({ ...card });
    map.set(key, entries);
  });

  return map;
};

const flattenColumnsMap = (map: Map<string, TeamBoardCard[]>) => {
  const flattened: TeamBoardCard[] = [];

  Array.from(map.keys())
    .sort()
    .forEach((key) => {
      const entries = map.get(key) ?? [];
      entries
        .map((entry) => ({ ...entry }))
        .forEach((entry, index) => {
          flattened.push({ ...entry, position: index });
        });
    });

  return flattened;
};

const buildPersistPayload = (boardId: string, cards: TeamBoardCard[]) =>
  cards.map((card) => ({
    board_id: boardId,
    card_id: card.cardId,
    card_data: buildCardData(card),
    stage: droppableKey(card.assigneeId, card.status),
    position: card.position ?? 0,
    project_number: null,
    project_name: null,
  }));

const normalizeCard = (row: any): TeamBoardCard | null => {
  const stageInfo = typeof row.stage === 'string' ? parseDroppableKey(row.stage) : { assigneeId: null, status: 'backlog' as TeamBoardStatus };
  const payload = (row.card_data ?? {}) as Record<string, unknown>;
  if (payload && payload.type && payload.type !== 'teamTask' && !String(row.stage || '').startsWith('team|')) {
    return null;
  }

  const description = typeof payload.description === 'string' ? payload.description : '';
  const dueDate = typeof payload.dueDate === 'string' && payload.dueDate ? payload.dueDate : null;
  const important = Boolean(payload.important);

  let status: TeamBoardStatus = stageInfo.status;
  if (typeof payload.status === 'string' && ['backlog', 'flow1', 'flow', 'done'].includes(payload.status)) {
    status = payload.status as TeamBoardStatus;
  }

  let assigneeId: string | null = stageInfo.assigneeId;
  if (typeof payload.assigneeId === 'string') {
    assigneeId = payload.assigneeId;
  } else if (payload.assigneeId === null) {
    assigneeId = null;
  }

  return {
    rowId: String(row.id),
    cardId: String(row.card_id ?? row.id ?? crypto.randomUUID()),
    description,
    dueDate,
    important,
    assigneeId,
    status,
    position: typeof row.position === 'number' ? row.position : 0,
  };
};

export default function TeamKanbanBoard({ boardId }: TeamKanbanBoardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
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

  const persistAllCards = useCallback(
    async (entries: TeamBoardCard[]) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(await buildSupabaseAuthHeaders(supabase)),
      };

      const response = await fetch(`/api/boards/${boardId}/cards`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cards: buildPersistPayload(boardId, entries) }),
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }
    },
    [boardId, supabase],
  );

  const loadBoardSettings = useCallback(async () => {
    const headers = await buildSupabaseAuthHeaders(supabase);
    const response = await fetch(`/api/boards/${boardId}/settings`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok && response.status !== 404) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload?.error ?? `HTTP ${response.status}`);
    }

    if (response.status === 404) {
      setBoardSettings({});
      setCompletedCount(0);
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      settings?: Record<string, unknown> | null;
    };

    const settings = (payload.settings as Record<string, any> | null) ?? {};
    setBoardSettings(settings);

    const rawCount = Number(
      settings?.teamBoard && typeof settings.teamBoard.completedCount === 'number'
        ? settings.teamBoard.completedCount
        : 0,
    );

    setCompletedCount(Number.isFinite(rawCount) ? rawCount : 0);
  }, [boardId, supabase]);

  const persistCompletedCount = useCallback(
    async (nextCount: number) => {
      const nextSettings = {
        ...boardSettings,
        teamBoard: {
          ...(boardSettings.teamBoard as Record<string, unknown> | undefined),
          completedCount: nextCount,
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(await buildSupabaseAuthHeaders(supabase)),
      };

      const response = await fetch(`/api/boards/${boardId}/settings`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ settings: nextSettings }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }

      setBoardSettings(nextSettings);
      setCompletedCount(nextCount);
    },
    [boardId, boardSettings, supabase],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadedProfiles = await fetchClientProfiles();
        if (!active) return;

        await loadBoardSettings();
        await loadMembers(loadedProfiles);
        await loadCards();
        await evaluatePermissions(loadedProfiles);
      } catch (cause) {
        if (!active) return;
        console.error('❌ Fehler beim Laden des Teamboards', cause);
        setError('Fehler beim Laden des Teamboards.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAll();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, supabase, loadBoardSettings]);

  const loadMembers = useCallback(
    async (availableProfiles: ClientProfile[]) => {
      if (!supabase) return;
      const { data, error: membershipError } = await supabase
        .from('board_members')
        .select('id, profile_id')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true });

      if (membershipError) {
        throw membershipError;
      }

      const rows = (data as BoardMember[] | null) ?? [];
      const mapped: MemberWithProfile[] = rows
        .map((entry) => {
          const profile = availableProfiles.find((candidate) => candidate.id === entry.profile_id) ?? null;
          if (profile && (profile.is_active ?? true) && !isSuperuserEmail(profile.email)) {
            return { ...entry, profile };
          }
          if (!profile) {
            return { ...entry, profile: null };
          }
          return null;
        })
        .filter((entry): entry is MemberWithProfile => Boolean(entry));

      setMembers(mapped);
    },
    [boardId, supabase],
  );

  const loadCards = useCallback(async () => {
    if (!supabase) return;
    const { data, error: cardsError } = await supabase
      .from('kanban_cards')
      .select('id, card_id, card_data, stage, position')
      .eq('board_id', boardId)
      .order('position', { ascending: true });

    if (cardsError) {
      throw cardsError;
    }

    const rows = (data as any[] | null) ?? [];
    const normalized = rows
      .map((row) => normalizeCard(row))
      .filter((card): card is TeamBoardCard => Boolean(card))
      .map((card) => ({
        ...card,
        position: card.position ?? 0,
      }));

    normalized.sort((a, b) => {
      const aKey = droppableKey(a.assigneeId, a.status);
      const bKey = droppableKey(b.assigneeId, b.status);
      if (aKey === bKey) {
        return a.position - b.position;
      }
      return aKey.localeCompare(bKey);
    });

    setCards(normalized);
  }, [boardId, supabase]);

  const evaluatePermissions = useCallback(
    async (availableProfiles: ClientProfile[]) => {
      if (!supabase) {
        setCanModify(false);
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error('⚠️ Fehler bei auth.getUser', authError);
          setCanModify(false);
          return;
        }

        const authUser = authData.user;
        if (!authUser) {
          setCanModify(false);
          return;
        }

        const email = authUser.email ?? '';
        const profile = availableProfiles.find((candidate) => candidate.id === authUser.id);
        const role = String(profile?.role ?? '').toLowerCase();

        const elevated =
          role === 'admin' ||
          role === 'owner' ||
          role === 'manager' ||
          role === 'superuser' ||
          isSuperuserEmail(email);

        const member = members.some((entry) => entry.profile_id === authUser.id);
        let isOwner = false;
        let isBoardAdmin = false;
        try {
          const { data: boardInfo, error: boardError } = await supabase
            .from('kanban_boards')
            .select('owner_id, board_admin_id')
            .eq('id', boardId)
            .maybeSingle();
          if (boardError) {
            console.error('⚠️ Fehler beim Laden der Board-Daten:', boardError);
          } else if (boardInfo) {
            isOwner = boardInfo.owner_id === authUser.id;
            isBoardAdmin = boardInfo.board_admin_id === authUser.id;
          }
        } catch (boardLoadError) {
          console.error('⚠️ Konnte Board-Details nicht laden', boardLoadError);
        }

        setCanModify(elevated || member || isOwner || isBoardAdmin);
      } catch (cause) {
        console.error('⚠️ Konnte Berechtigungen nicht auswerten', cause);
        setCanModify(false);
      }
    },
    [boardId, members, supabase],
  );

  const openCreateDialog = () => {
    if (!canModify) return;
    setEditingCard(null);
    setDraft(defaultDraft);
    setDueDateError(false);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (card: TeamBoardCard) => {
    if (!canModify) return;
    setEditingCard(card);
    setDraft({
      description: card.description,
      dueDate: card.dueDate ?? '',
      important: card.important,
    });
    setDueDateError(!card.dueDate);
    setError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingCard(null);
    setDraft(defaultDraft);
    setDueDateError(false);
  };

  const handleDraftChange = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    if (key === 'dueDate') {
      const missing = !value;
      setDueDateError(missing);
      if (!missing) {
        setError(null);
      }
    }
  };

  const columnsMap = useMemo(() => {
    const map = new Map<string, TeamBoardCard[]>();
    cards.forEach((card) => {
      const key = droppableKey(card.assigneeId, card.status);
      const entries = map.get(key) ?? [];
      entries.push(card);
      map.set(key, entries);
    });
    map.forEach((entries) => entries.sort((a, b) => a.position - b.position));
    return map;
  }, [cards]);

  const handleDragEnd = async (result: DropResult) => {
    if (!canModify) return;
    if (!result.destination) return;

    const sourceId = result.source.droppableId;
    const destId = result.destination.droppableId;

    if (sourceId === destId && result.source.index === result.destination.index) {
      return;
    }

    const working = createColumnsMapFromCards(cards);
    const sourceEntries = [...(working.get(sourceId) ?? [])];

    if (result.source.index < 0 || result.source.index >= sourceEntries.length) {
      return;
    }

    const [removed] = sourceEntries.splice(result.source.index, 1);
    working.set(sourceId, sourceEntries);

    const destInfo = parseDroppableKey(destId);
    const updatedCard: TeamBoardCard = {
      ...removed,
      assigneeId: destInfo.assigneeId,
      status: destInfo.status,
    };

    const destEntries =
      sourceId === destId ? sourceEntries : [...(working.get(destId) ?? [])];

    destEntries.splice(result.destination.index, 0, updatedCard);
    working.set(destId, destEntries);

    const flattened = flattenColumnsMap(working);
    setCards(flattened);
    try {
      await persistAllCards(flattened);
    } catch (cause) {
      console.error('❌ Fehler beim Aktualisieren nach Drag & Drop', cause);
      setError('Fehler beim Speichern der Aufgabenpositionen.');
      await loadCards();
    }
  };

  const saveTask = async () => {
    if (!supabase) return;
    if (!draft.description.trim()) {
      setError('Bitte eine Aufgabenbeschreibung eingeben.');
      return;
    }

    if (!draft.dueDate) {
      setDueDateError(true);
      setError('Bitte einen Zieltermin festlegen.');
      return;
    }

    const currentStatus = editingCard ? editingCard.status : 'backlog';
    const currentAssigneeId = editingCard ? editingCard.assigneeId : null;

    if (currentStatus !== 'backlog' && !currentAssigneeId) {
      setError('Bitte ordne die Aufgabe einem Teammitglied in der passenden Spalte zu.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const working = createColumnsMapFromCards(cards);

      if (editingCard) {
        const previousKey = droppableKey(editingCard.assigneeId, editingCard.status);
        const previousEntries = [...(working.get(previousKey) ?? [])];
        const previousIndex = previousEntries.findIndex((entry) => entry.cardId === editingCard.cardId);

        if (previousIndex !== -1) {
          previousEntries.splice(previousIndex, 1);
        }

        const updatedCard: TeamBoardCard = {
          ...editingCard,
          description: draft.description.trim(),
          dueDate: draft.dueDate,
          important: draft.important,
          assigneeId: currentAssigneeId,
          status: currentStatus,
        };

        working.set(previousKey, previousEntries);

        const nextKey = droppableKey(updatedCard.assigneeId, updatedCard.status);
        const targetEntries =
          nextKey === previousKey ? previousEntries : [...(working.get(nextKey) ?? [])];

        const insertIndex = nextKey === previousKey && previousIndex >= 0 ? previousIndex : targetEntries.length;
        targetEntries.splice(insertIndex, 0, updatedCard);
        working.set(nextKey, targetEntries);
      } else {
        const cardId = `team-${crypto.randomUUID()}`;
        const newCard: TeamBoardCard = {
          rowId: cardId,
          cardId,
          description: draft.description.trim(),
          dueDate: draft.dueDate,
          important: draft.important,
          assigneeId: null,
          status: 'backlog',
          position: 0,
        };

        const targetKey = droppableKey(newCard.assigneeId, newCard.status);
        const targetEntries = [...(working.get(targetKey) ?? [])];
        targetEntries.push(newCard);
        working.set(targetKey, targetEntries);
      }

      const nextCards = flattenColumnsMap(working);
      setCards(nextCards);
      await persistAllCards(nextCards);
      closeDialog();
    } catch (cause) {
      console.error('❌ Fehler beim Speichern der Aufgabe', cause);
      setError('Fehler beim Speichern der Aufgabe.');
      await loadCards();
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!supabase || !editingCard) return;
    setSaving(true);
    setError(null);
    try {
      const working = createColumnsMapFromCards(cards);
      const previousKey = droppableKey(editingCard.assigneeId, editingCard.status);
      const previousEntries = [...(working.get(previousKey) ?? [])];
      const index = previousEntries.findIndex((entry) => entry.cardId === editingCard.cardId);

      if (index === -1) {
        throw new Error('Aufgabe konnte nicht gefunden werden.');
      }

      previousEntries.splice(index, 1);
      working.set(previousKey, previousEntries);

      const nextCards = flattenColumnsMap(working);
      setCards(nextCards);
      await persistAllCards(nextCards);
      closeDialog();
    } catch (cause) {
      console.error('❌ Fehler beim Löschen der Aufgabe', cause);
      setError('Fehler beim Löschen der Aufgabe.');
      await loadCards();
    } finally {
      setSaving(false);
    }
  };

  const backlogCards = useMemo(
    () => cards.filter((card) => card.status === 'backlog').sort((a, b) => a.position - b.position),
    [cards],
  );

  const memberColumns = useMemo(() => {
    return members.map((member) => {
      const rowCards = cards.filter((card) => card.assigneeId === member.profile_id);
      return {
        member,
        flow1: rowCards.filter((card) => card.status === 'flow1').sort((a, b) => a.position - b.position),
        flow: rowCards.filter((card) => card.status === 'flow').sort((a, b) => a.position - b.position),
        done: rowCards.filter((card) => card.status === 'done').sort((a, b) => a.position - b.position),
      };
    });
  }, [cards, members]);

  const doneCardsCount = useMemo(
    () => cards.filter((card) => card.status === 'done').length,
    [cards],
  );

  const handleCompleteFlow = useCallback(async () => {
    if (!canModify || flowSaving) {
      return;
    }

    const finishedCards = cards.filter((card) => card.status === 'done');

    if (finishedCards.length === 0) {
      return;
    }

    setFlowSaving(true);
    setError(null);

    try {
      const remainingCards = cards.filter((card) => card.status !== 'done');
      await persistAllCards(remainingCards);
      await persistCompletedCount(completedCount + finishedCards.length);
      setCards(remainingCards);
    } catch (cause) {
      console.error('❌ Fehler beim Abschließen des Flows', cause);
      setError('Flow konnte nicht abgeschlossen werden.');
      await loadCards();
    } finally {
      setFlowSaving(false);
    }
  }, [canModify, cards, completedCount, flowSaving, loadCards, persistAllCards, persistCompletedCount]);

  const renderCard = (card: TeamBoardCard, index: number) => {
    const dueDateLabel = card.dueDate ? new Date(card.dueDate).toLocaleDateString('de-DE') : null;
    const overdue = card.dueDate ? new Date(card.dueDate) < new Date(new Date().toDateString()) : false;
    return (
      <Draggable key={card.cardId} draggableId={card.cardId} index={index} isDragDisabled={!canModify}>
        {(provided, snapshot) => (
          <Card
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            sx={{
              width: '100%',
              maxWidth: CARD_WIDTH,
              minWidth: { xs: '100%', sm: CARD_WIDTH },
              mb: 1.5,
              borderRadius: 2.5,
              boxShadow: snapshot.isDragging
                ? '0 18px 30px rgba(15, 23, 42, 0.22)'
                : '0 4px 14px rgba(15, 23, 42, 0.08)',
              position: 'relative',
              cursor: canModify ? 'grab' : 'default',
              transition: 'transform 0.14s ease, box-shadow 0.14s ease',
              border: '1px solid',
              borderColor: card.important ? 'error.light' : 'rgba(148, 163, 184, 0.35)',
              height: CARD_HEIGHT,
              minHeight: CARD_HEIGHT,
              maxHeight: CARD_HEIGHT,
              display: 'flex',
              flexDirection: 'column',
              background: (theme) =>
                snapshot.isDragging
                  ? theme.palette.background.paper
                  : 'linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.92) 100%)',
              '&:hover': {
                transform: snapshot.isDragging ? 'scale(1.02)' : 'translateY(-2px)',
                boxShadow: '0 10px 22px rgba(15, 23, 42, 0.16)',
              },
            }}
            onClick={() => openEditDialog(card)}
          >
            {card.important && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#d32f2f',
                }}
              />
            )}
            <CardContent
              sx={{
                pr: 3,
                py: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                height: '100%',
              }}
            >
              <Tooltip
                title={card.description}
                placement="top-start"
                arrow
                disableInteractive
                enterDelay={1000}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    whiteSpace: 'normal',
                    textTransform: 'none',
                  }}
                >
                  {card.description || 'Ohne Beschreibung'}
                </Typography>
              </Tooltip>
              <Box sx={{ mt: 'auto' }}>
                {dueDateLabel && (
                  <Typography
                    variant="caption"
                    color={overdue ? 'error.main' : 'text.secondary'}
                    sx={{ fontWeight: overdue ? 600 : 500 }}
                  >
                    Fällig: {dueDateLabel}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        )}
      </Draggable>
    );
  };

  if (!supabase) {
    return (
      <Box sx={{ p: 4 }}>
        <SupabaseConfigNotice />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="body1">🔄 Teamboard wird geladen...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        background: 'linear-gradient(180deg, rgba(240, 244, 255, 0.8) 0%, rgba(255, 255, 255, 0.95) 45%)',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        flexGrow: 1,
        minWidth: 0,
      }}
    >
      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto', pr: { md: 1 } }}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Grid container spacing={3} alignItems="flex-start" wrap="nowrap" sx={{ minWidth: 0 }}>
          <Grid item xs={12} md={3}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'rgba(148, 163, 184, 0.28)',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Aufgabenspeicher</Typography>
                    {canModify && (
                      <IconButton color="primary" size="small" onClick={openCreateDialog}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <Droppable droppableId={droppableKey(null, 'backlog')}>
                    {(provided) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          minHeight: 220,
                          border: '1px solid',
                          borderColor: 'rgba(148, 163, 184, 0.22)',
                          borderRadius: 2,
                          p: 1.5,
                          backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.08),
                          transition: 'background-color 0.12s ease',
                          '&:hover': {
                            backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.16),
                          },
                        }}
                      >
                        {backlogCards.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Keine Aufgaben im Speicher.
                          </Typography>
                        )}
                        {backlogCards.map((card, index) => renderCard(card, index))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={9}>
            <Card
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'rgba(148, 163, 184, 0.28)',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="h6">Team-Flow</Typography>
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <Box component="thead">
                        <Box
                          component="tr"
                          sx={{
                            '& th': {
                              borderBottom: '1px solid',
                              borderColor: 'rgba(148, 163, 184, 0.3)',
                              py: 1,
                              px: 1.5,
                              textTransform: 'uppercase',
                              fontSize: '0.75rem',
                              letterSpacing: '0.06em',
                              color: 'text.secondary',
                            },
                          }}
                        >
                          <Box component="th" align="left">Mitglied</Box>
                          <Box component="th" align="center" width="25%">
                            {statusLabels.flow1}
                          </Box>
                          <Box component="th" align="center" width="25%">
                            {statusLabels.flow}
                          </Box>
                          <Box component="th" align="center" width="25%">
                            <Stack spacing={1} alignItems="center">
                              <Box component="span">{statusLabels.done}</Box>
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                                <Chip
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  label={`${completedCount} gesamt`}
                                />
                                {canModify && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={handleCompleteFlow}
                                    disabled={flowSaving || doneCardsCount === 0}
                                    sx={{ textTransform: 'none' }}
                                  >
                                    Flow abschließen
                                  </Button>
                                )}
                              </Stack>
                            </Stack>
                          </Box>
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {memberColumns.length === 0 && (
                          <Box component="tr">
                            <Box component="td" colSpan={4} sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
                              Keine Mitglieder hinterlegt. Füge Mitglieder im Management-Bereich hinzu.
                            </Box>
                          </Box>
                        )}
                        {memberColumns.map(({ member, flow1, flow, done }) => {
                          const label = member.profile?.full_name || member.profile?.email || 'Unbekannt';
                          return (
                            <Box
                              component="tr"
                              key={member.id}
                              sx={{
                                '& td': {
                                  borderBottom: '1px solid',
                                  borderColor: 'rgba(148, 163, 184, 0.2)',
                                  px: 1.5,
                                  py: 1.5,
                                  verticalAlign: 'top',
                                  backgroundColor: 'rgba(255,255,255,0.9)',
                                },
                              }}
                            >
                              <Box component="td" width="25%">
                                <Stack spacing={0.5}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    {label}
                                  </Typography>
                                  {member.profile?.company && (
                                    <Typography variant="caption" color="text.secondary">
                                      {member.profile.company}
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                              {(['flow1', 'flow', 'done'] as TeamBoardStatus[]).map((status) => {
                                const droppableId = droppableKey(member.profile_id, status);
                                const rows = status === 'flow1' ? flow1 : status === 'flow' ? flow : done;
                                return (
                                  <Box component="td" key={droppableId} width="25%">
                                    <Droppable droppableId={droppableId}>
                                      {(providedDroppable) => (
                                        <Box
                                          ref={providedDroppable.innerRef}
                                          {...providedDroppable.droppableProps}
                                          sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'stretch',
                                            minHeight: 160,
                                            border: '1px solid',
                                            borderColor: 'rgba(148, 163, 184, 0.22)',
                                            borderRadius: 2,
                                            p: 1.5,
                                            backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.06),
                                            transition: 'background-color 0.12s ease',
                                            '&:hover': {
                                              backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.16),
                                            },
                                          }}
                                        >
                                          {rows.length === 0 && (
                                            <Typography variant="body2" color="text.secondary" align="center">
                                              —
                                            </Typography>
                                          )}
                                          {rows.map((card, index) => renderCard(card, index))}
                                          {providedDroppable.placeholder}
                                        </Box>
                                      )}
                                    </Droppable>
                                  </Box>
                                );
                              })}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          </Grid>
        </DragDropContext>
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCard ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Aufgabenbeschreibung"
              value={draft.description}
              onChange={(event) => handleDraftChange('description', event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Zieltermin"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={draft.dueDate}
              onChange={(event) => handleDraftChange('dueDate', event.target.value)}
              onBlur={() => setDueDateError(!draft.dueDate)}
              required
              error={dueDateError && !draft.dueDate}
              helperText={dueDateError && !draft.dueDate ? 'Bitte einen Zieltermin auswählen.' : undefined}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.important}
                  onChange={(event) => handleDraftChange('important', event.target.checked)}
                />
              }
              label="Wichtige Aufgabe markieren"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {editingCard && (
            <Button color="error" onClick={deleteTask} disabled={saving} startIcon={<DeleteIcon />}>
              Löschen
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={closeDialog} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={saveTask} disabled={saving} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
