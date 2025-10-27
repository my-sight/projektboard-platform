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
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
  assigneeId: string | null;
  status: TeamBoardStatus;
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
  assigneeId: null,
  status: 'backlog',
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
  const [flowSaving, setFlowSaving] = useState(false);
  const [boardSettings, setBoardSettings] = useState<Record<string, any>>({});
  const [completedCount, setCompletedCount] = useState(0);

  const persistAllCards = useCallback(
    async (entries: TeamBoardCard[]) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          const accessToken = data.session?.access_token;
          const refreshToken = data.session?.refresh_token;

          if (accessToken) {
            headers['x-supabase-access-token'] = accessToken;
          }

          if (refreshToken) {
            headers['x-supabase-refresh-token'] = refreshToken;
          }
        } catch (error) {
          console.warn('⚠️ Konnte Supabase-Session für Teamboard-Speicherung nicht laden:', error);
        }
      }

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
    if (!supabase) return;

    const { data, error } = await supabase
      .from('kanban_board_settings')
      .select('settings')
      .eq('board_id', boardId)
      .is('user_id', null)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const settings = (data?.settings as Record<string, any> | null) ?? {};
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
      if (!supabase) return;

      const nextSettings = {
        ...boardSettings,
        teamBoard: {
          ...(boardSettings.teamBoard as Record<string, unknown> | undefined),
          completedCount: nextCount,
        },
      };

      const { error } = await supabase
        .from('kanban_board_settings')
        .upsert({
          board_id: boardId,
          user_id: null,
          settings: nextSettings,
        });

      if (error) {
        throw error;
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
        setCanModify(elevated || member);
      } catch (cause) {
        console.error('⚠️ Konnte Berechtigungen nicht auswerten', cause);
        setCanModify(false);
      }
    },
    [members, supabase],
  );

  const openCreateDialog = () => {
    if (!canModify) return;
    setEditingCard(null);
    setDraft(defaultDraft);
    setDialogOpen(true);
  };

  const openEditDialog = (card: TeamBoardCard) => {
    if (!canModify) return;
    setEditingCard(card);
    setDraft({
      description: card.description,
      dueDate: card.dueDate ?? '',
      important: card.important,
      assigneeId: card.assigneeId,
      status: card.status,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingCard(null);
    setDraft(defaultDraft);
  };

  const handleDraftChange = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
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

    if (draft.status !== 'backlog' && !draft.assigneeId) {
      setError('Bitte ein Teammitglied auswählen, um den Status zu setzen.');
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
          dueDate: draft.dueDate || null,
          important: draft.important,
          assigneeId: draft.assigneeId,
          status: draft.status,
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
          dueDate: draft.dueDate || null,
          important: draft.important,
          assigneeId: draft.assigneeId,
          status: draft.status,
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
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
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
      }}
    >
      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Grid container spacing={3} alignItems="flex-start">
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
              label="Fälligkeitsdatum"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={draft.dueDate}
              onChange={(event) => handleDraftChange('dueDate', event.target.value)}
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
            <FormControl fullWidth>
              <InputLabel>Verantwortlich</InputLabel>
              <Select
                label="Verantwortlich"
                value={draft.assigneeId ?? ''}
                onChange={(event) => {
                  const value = event.target.value ? String(event.target.value) : null;
                  handleDraftChange('assigneeId', value);
                  if (!value && draft.status !== 'backlog') {
                    handleDraftChange('status', 'backlog');
                  }
                }}
              >
                <MenuItem value="">
                  <em>Keinem Mitglied zugeordnet</em>
                </MenuItem>
                {members.map((member) => {
                  const profile = member.profile;
                  if (!profile) {
                    return null;
                  }
                  return (
                    <MenuItem key={member.profile_id} value={member.profile_id}>
                      {profile.full_name || profile.email}
                      {profile.company ? ` • ${profile.company}` : ''}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={draft.status}
                onChange={(event) => handleDraftChange('status', event.target.value as TeamBoardStatus)}
              >
                <MenuItem value="backlog">Aufgabenspeicher</MenuItem>
                <MenuItem value="flow1" disabled={!draft.assigneeId}>
                  Flow-1
                </MenuItem>
                <MenuItem value="flow" disabled={!draft.assigneeId}>
                  Flow
                </MenuItem>
                <MenuItem value="done" disabled={!draft.assigneeId}>
                  Fertig
                </MenuItem>
              </Select>
            </FormControl>
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
