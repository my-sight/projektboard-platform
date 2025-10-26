'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
  }, [boardId, supabase]);

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

  const persistColumns = useCallback(
    async (columns: Map<string, TeamBoardCard[]>) => {
      if (!supabase) return;
      const updates: Array<Record<string, unknown>> = [];
      columns.forEach((entries, columnKey) => {
        entries.forEach((entry, index) => {
          updates.push({
            id: entry.rowId,
            board_id: boardId,
            card_id: entry.cardId,
            stage: columnKey,
            position: index,
            card_data: buildCardData(entry),
          });
        });
      });

      if (updates.length === 0) {
        return;
      }

      const { error: updateError } = await supabase.from('kanban_cards').upsert(updates);
      if (updateError) {
        throw updateError;
      }
    },
    [boardId, supabase],
  );

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

    const card = cards.find((entry) => entry.cardId === result.draggableId);
    if (!card) {
      return;
    }

    const working = new Map(columnsMap);
    const sourceColumn = [...(working.get(sourceId) ?? [])];
    const destColumn = sourceId === destId ? sourceColumn : [...(working.get(destId) ?? [])];

    const sourceIdx = sourceColumn.findIndex((entry) => entry.cardId === card.cardId);
    if (sourceIdx === -1) {
      return;
    }

    const [removed] = sourceColumn.splice(sourceIdx, 1);
    const destInfo = parseDroppableKey(destId);
    const updatedCard: TeamBoardCard = {
      ...removed,
      assigneeId: destInfo.assigneeId,
      status: destInfo.status,
    };

    destColumn.splice(result.destination.index, 0, updatedCard);

    const normalizePositions = (entries: TeamBoardCard[]): TeamBoardCard[] =>
      entries.map((entry, index) => ({ ...entry, position: index }));

    const updatedDest = normalizePositions(destColumn);
    const updatedSource = sourceId === destId ? updatedDest : normalizePositions(sourceColumn);

    working.set(destId, updatedDest);
    working.set(sourceId, updatedSource);

    const flattened: TeamBoardCard[] = [];
    working.forEach((entries) => {
      entries.forEach((entry) => {
        flattened.push(entry);
      });
    });

    setCards(flattened);
    try {
      await persistColumns(working);
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

    const payload = {
      description: draft.description.trim(),
      dueDate: draft.dueDate || null,
      important: draft.important,
      assigneeId: draft.assigneeId,
      status: draft.status,
    };

    const stage = droppableKey(draft.assigneeId, draft.status);

    try {
      if (editingCard) {
        const { error: updateError } = await supabase
          .from('kanban_cards')
          .update({
            card_data: { type: 'teamTask', ...payload },
            stage,
          })
          .eq('id', editingCard.rowId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const existing = cards.filter((card) => droppableKey(card.assigneeId, card.status) === stage);
        const nextPosition = existing.length;
        const cardId = `team-${crypto.randomUUID()}`;

        const { error: insertError } = await supabase.from('kanban_cards').insert({
          board_id: boardId,
          card_id: cardId,
          card_data: { type: 'teamTask', ...payload },
          stage,
          position: nextPosition,
        });

        if (insertError) {
          throw insertError;
        }
      }

      await loadCards();
      closeDialog();
    } catch (cause) {
      console.error('❌ Fehler beim Speichern der Aufgabe', cause);
      setError('Fehler beim Speichern der Aufgabe.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!supabase || !editingCard) return;
    setSaving(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('id', editingCard.rowId);

      if (deleteError) {
        throw deleteError;
      }

      await loadCards();
      closeDialog();
    } catch (cause) {
      console.error('❌ Fehler beim Löschen der Aufgabe', cause);
      setError('Fehler beim Löschen der Aufgabe.');
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
              mb: 1.5,
              borderRadius: 2,
              boxShadow: snapshot.isDragging ? 6 : 1,
              position: 'relative',
              cursor: canModify ? 'grab' : 'default',
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
            <CardContent sx={{ pr: 3 }}>
              <Tooltip title={card.description} placement="top-start">
                <Typography variant="subtitle2" noWrap>
                  {card.description || 'Ohne Beschreibung'}
                </Typography>
              </Tooltip>
              {dueDateLabel && (
                <Typography
                  variant="caption"
                  color={overdue ? 'error' : 'text.secondary'}
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  Fällig: {dueDateLabel}
                </Typography>
              )}
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
    <Box sx={{ p: 3 }}>
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
            <Card sx={{ height: '100%' }}>
              <CardContent>
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
                          minHeight: 200,
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1.5,
                          backgroundColor: '#f9fafb',
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
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Team-Flow</Typography>
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                      <Box component="thead">
                        <Box component="tr" sx={{ '& th': { borderBottom: '1px solid', borderColor: 'divider', py: 1, px: 1.5 } }}>
                          <Box component="th" align="left">Mitglied</Box>
                          <Box component="th" align="center" width="25%">
                            {statusLabels.flow1}
                          </Box>
                          <Box component="th" align="center" width="25%">
                            {statusLabels.flow}
                          </Box>
                          <Box component="th" align="center" width="25%">
                            {statusLabels.done}
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
                              sx={{ '& td': { borderBottom: '1px solid', borderColor: 'divider', px: 1.5, py: 1.5, verticalAlign: 'top' } }}
                            >
                              <Box component="td" width="25%">
                                <Stack spacing={0.5}>
                                  <Typography variant="subtitle2">{label}</Typography>
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
                                            minHeight: 160,
                                            border: '1px dashed',
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            p: 1.5,
                                            backgroundColor: '#fdfdfd',
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
