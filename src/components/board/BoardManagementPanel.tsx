'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { createClient } from '@supabase/supabase-js';
import { isSuperuserEmail } from '@/constants/superuser';
import { ClientProfile, fetchClientProfiles } from '@/lib/clientProfiles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Department {
  id: string;
  name: string;
}

interface Member {
  id: string;
  profile_id: string;
}

interface AttendanceRecord {
  id: string;
  board_id: string;
  profile_id: string;
  week_start: string;
  status: string;
}

interface Topic {
  id: string;
  board_id: string;
  title: string;
  position: number;
}

interface KanbanCardRow {
  id: string;
  card_id: string;
  card_data: Record<string, unknown>;
  project_number?: string | null;
  project_name?: string | null;
}

interface EscalationRecord {
  id?: string;
  board_id: string;
  card_id: string;
  category: 'LK' | 'SK';
  project_code: string | null;
  project_name: string | null;
  reason: string | null;
  measure: string | null;
  department_id: string | null;
  responsible_id: string | null;
  target_date: string | null;
  completion_steps: number;
}

interface EscalationView extends EscalationRecord {
  title: string;
  stage?: string | null;
}

interface EscalationDraft {
  reason: string;
  measure: string;
  department_id: string | null;
  responsible_id: string | null;
  target_date: string | null;
  completion_steps: number;
}

interface BoardManagementPanelProps {
  boardId: string;
  canEdit: boolean;
  memberCanSee: boolean;
}

const ATTENDANCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'present', label: 'Anwesend' },
  { value: 'remote', label: 'Remote' },
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'absent', label: 'Abwesend' },
];

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4);
  const startFmt = weekStart.toLocaleDateString('de-DE');
  const endFmt = end.toLocaleDateString('de-DE');
  return `${startFmt} – ${endFmt}`;
}

function isoWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  const dayOfWeek = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayOfWeek + 3);
  const weekNumber = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
  return weekNumber;
}

function CompletionDial({
  steps,
  onClick,
  disabled,
}: {
  steps: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const clamped = Math.max(0, Math.min(4, steps || 0));
  const angle = (clamped / 4) * 360;
  const background = `conic-gradient(#4caf50 0deg ${angle}deg, #e0e0e0 ${angle}deg 360deg)`;
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '1px solid',
        borderColor: 'divider',
        backgroundImage: background,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'transform 0.2s ease',
        '&:hover': disabled
          ? undefined
          : {
              transform: 'scale(1.05)',
            },
      }}
    />
  );
}

function mergeMemberProfiles(members: Member[], profiles: ClientProfile[]): (Member & { profile?: ClientProfile })[] {
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
  return members.map(member => ({
    ...member,
    profile: profileMap.get(member.profile_id),
  }));
}

const stringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

function buildEscalationViews(
  boardId: string,
  cards: KanbanCardRow[],
  records: EscalationRecord[],
): EscalationView[] {
  const recordByCard = new Map(records.filter(record => record.card_id).map(record => [record.card_id, record]));

  return cards
    .map(card => {
      const rawData = (card.card_data ?? {}) as Record<string, unknown>;
      const rawCategory = stringOrNull(rawData['Eskalation']);
      const category = rawCategory?.toUpperCase();

      if (category !== 'LK' && category !== 'SK') {
        return null;
      }

      const record = recordByCard.get(card.card_id);

      const projectCode = stringOrNull(rawData['Nummer']) ?? stringOrNull(card.project_number);
      const projectName = stringOrNull(rawData['Teil']) ?? stringOrNull(card.project_name);
      const stage = stringOrNull(rawData['Board Stage']);
      const fallbackReason = stringOrNull(rawData['Grund']);
      const fallbackMeasure = stringOrNull(rawData['Maßnahme']) ?? stringOrNull(rawData['Massnahme']);
      const completion = Math.max(0, Math.min(4, record?.completion_steps ?? 0));

      const view: EscalationView = {
        id: record?.id,
        board_id: record?.board_id ?? boardId,
        card_id: card.card_id,
        category: (category as 'LK' | 'SK'),
        project_code: record?.project_code ?? projectCode,
        project_name: record?.project_name ?? projectName,
        reason: record?.reason ?? fallbackReason ?? null,
        measure: record?.measure ?? fallbackMeasure ?? null,
        department_id: record?.department_id ?? null,
        responsible_id: record?.responsible_id ?? null,
        target_date: record?.target_date ?? null,
        completion_steps: completion,
        title: [projectCode, projectName].filter(Boolean).join(' • ') || card.card_id,
        stage,
      };

      return view;
    })
    .filter((entry): entry is EscalationView => entry !== null);
}

export default function BoardManagementPanel({ boardId, canEdit, memberCanSee }: BoardManagementPanelProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<(Member & { profile?: ClientProfile })[]>([]);
  const [memberSelect, setMemberSelect] = useState('');

  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord | undefined>>({});

  const [topics, setTopics] = useState<Topic[]>([]);
  const [escalations, setEscalations] = useState<EscalationView[]>([]);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [editingEscalation, setEditingEscalation] = useState<EscalationView | null>(null);
  const [escalationDraft, setEscalationDraft] = useState<EscalationDraft | null>(null);

  const availableProfiles = useMemo(() => {
    const memberIds = new Set(members.map(member => member.profile_id));
    return profiles.filter(
      profile =>
        (profile.is_active || isSuperuserEmail(profile.email)) &&
        !memberIds.has(profile.id),
    );
  }, [members, profiles]);

  const filteredEscalations = useMemo(() => ({
    LK: escalations.filter(entry => entry.category === 'LK'),
    SK: escalations.filter(entry => entry.category === 'SK'),
  }), [escalations]);

  const profileById = useMemo(() => {
    const map = new Map<string, ClientProfile>();
    profiles.forEach(profile => {
      map.set(profile.id, profile);
    });
    return map;
  }, [profiles]);

  const attendanceFor = (profileId: string): string => {
    const record = attendance[profileId];
    return record?.status ?? 'present';
  };

  const handleError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    const message = error instanceof Error ? error.message : String(error);
    setMessage(`❌ ${fallback}: ${message}`);
    setTimeout(() => setMessage(''), 4000);
  };

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const profilePromise = fetchClientProfiles();

      const [
        departmentsResult,
        membersResult,
        topicsResult,
        escalationsResult,
        cardsResult,
      ] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('board_members').select('*').eq('board_id', boardId).order('created_at'),
        supabase.from('board_top_topics').select('*').eq('board_id', boardId).order('position'),
        supabase.from('board_escalations').select('*').eq('board_id', boardId),
        supabase
          .from('kanban_cards')
          .select('id, card_id, card_data, project_number, project_name')
          .eq('board_id', boardId),
      ]);

      const profileRows = await profilePromise;

      if (departmentsResult.error) throw new Error(departmentsResult.error.message);
      if (membersResult.error) throw new Error(membersResult.error.message);
      if (topicsResult.error) throw new Error(topicsResult.error.message);
      if (escalationsResult.error) throw new Error(escalationsResult.error.message);
      if (cardsResult.error) throw new Error(cardsResult.error.message);

      const departmentRows = (departmentsResult.data as Department[]) ?? [];
      const memberRows = mergeMemberProfiles((membersResult.data as Member[]) ?? [], profileRows);
      const topicRows = (topicsResult.data as Topic[]) ?? [];
      const escalationRecords = (escalationsResult.data as EscalationRecord[]) ?? [];
      const cardRows = (cardsResult.data as KanbanCardRow[]) ?? [];
      const escalationViews = buildEscalationViews(boardId, cardRows, escalationRecords);

      setProfiles(profileRows);
      setDepartments(departmentRows);
      setMembers(memberRows);
      setTopics(topicRows);
      setEscalations(escalationViews);
    } catch (error) {
      handleError(error, 'Fehler beim Laden der Board-Daten');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (week: Date) => {
    try {
      const { data, error } = await supabase
        .from('board_attendance')
        .select('*')
        .eq('board_id', boardId)
        .eq('week_start', isoDate(week));

      if (error) throw new Error(error.message);

      const map: Record<string, AttendanceRecord> = {};
      (data as AttendanceRecord[] | null)?.forEach(entry => {
        map[entry.profile_id] = entry;
      });
      setAttendance(map);
    } catch (error) {
      handleError(error, 'Fehler beim Laden der Anwesenheit');
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [boardId]);

  useEffect(() => {
    loadAttendance(weekStart);
  }, [boardId, weekStart]);

  const adjustWeek = (offset: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offset * 7);
    setWeekStart(startOfWeek(next));
  };

  const upsertAttendance = async (profileId: string, status: string) => {
    try {
      const { error, data } = await supabase
        .from('board_attendance')
        .upsert(
          {
            board_id: boardId,
            profile_id: profileId,
            week_start: isoDate(weekStart),
            status,
          },
          { onConflict: 'board_id,profile_id,week_start' },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (data) {
        setAttendance(prev => ({ ...prev, [profileId]: data as AttendanceRecord }));
      }
    } catch (error) {
      handleError(error, 'Fehler beim Speichern der Anwesenheit');
    }
  };

  const addMember = async () => {
    if (!memberSelect) return;
    try {
      const { data, error } = await supabase
        .from('board_members')
        .insert({ board_id: boardId, profile_id: memberSelect })
        .select()
        .single();

      if (error) throw new Error(error.message);

      const profile = profiles.find(entry => entry.id === memberSelect);
      setMembers(prev => [...prev, { ...(data as Member), profile }]);
      setMemberSelect('');
    } catch (error) {
      handleError(error, 'Fehler beim Hinzufügen des Mitglieds');
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('board_members')
        .delete()
        .eq('id', memberId);

      if (error) throw new Error(error.message);

      setMembers(prev => prev.filter(member => member.id !== memberId));
    } catch (error) {
      handleError(error, 'Fehler beim Entfernen des Mitglieds');
    }
  };

  const addTopic = async () => {
    if (topics.length >= 5) return;
    try {
      const { data, error } = await supabase
        .from('board_top_topics')
        .insert({
          board_id: boardId,
          title: '',
          position: topics.length,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (data) {
        setTopics(prev => [...prev, data as Topic]);
      }
    } catch (error) {
      handleError(error, 'Fehler beim Hinzufügen eines Top-Themas');
    }
  };

  const updateTopic = async (topicId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('board_top_topics')
        .update({ title })
        .eq('id', topicId);

      if (error) throw new Error(error.message);

      setTopics(prev => prev.map(topic => (topic.id === topicId ? { ...topic, title } : topic)));
    } catch (error) {
      handleError(error, 'Fehler beim Aktualisieren des Top-Themas');
    }
  };

  const deleteTopic = async (topicId: string) => {
    try {
      const { error } = await supabase
        .from('board_top_topics')
        .delete()
        .eq('id', topicId);

      if (error) throw new Error(error.message);

      setTopics(prev => prev.filter(topic => topic.id !== topicId));
    } catch (error) {
      handleError(error, 'Fehler beim Löschen des Top-Themas');
    }
  };


  const departmentName = (departmentId: string | null) =>
    departments.find(entry => entry.id === departmentId)?.name ?? '';

  const departmentIdByName = (name: string) =>
    departments.find(entry => entry.name === name)?.id ?? null;

  const responsibleOptions = (departmentId: string | null) => {
    const name = departmentName(departmentId);
    return profiles.filter(profile => {
      const matchesDepartment = name ? profile.company === name : true;
      const active = profile.is_active || isSuperuserEmail(profile.email);
      return matchesDepartment && active;
    });
  };

  const openEscalationEditor = (entry: EscalationView) => {
    setEditingEscalation(entry);
    setEscalationDraft({
      reason: entry.reason ?? '',
      measure: entry.measure ?? '',
      department_id: entry.department_id ?? null,
      responsible_id: entry.responsible_id ?? null,
      target_date: entry.target_date ?? null,
      completion_steps: entry.completion_steps ?? 0,
    });
    setEscalationDialogOpen(true);
  };

  const closeEscalationEditor = () => {
    setEscalationDialogOpen(false);
    setEditingEscalation(null);
    setEscalationDraft(null);
  };

  const updateEscalationDraft = (changes: Partial<EscalationDraft>) => {
    setEscalationDraft(prev => (prev ? { ...prev, ...changes } : prev));
  };

  const saveEscalation = async () => {
    if (!editingEscalation || !escalationDraft) return;

    try {
      const payload = {
        board_id: boardId,
        card_id: editingEscalation.card_id,
        category: editingEscalation.category,
        project_code: editingEscalation.project_code,
        project_name: editingEscalation.project_name,
        reason: stringOrNull(escalationDraft.reason),
        measure: stringOrNull(escalationDraft.measure),
        department_id: escalationDraft.department_id,
        responsible_id: escalationDraft.responsible_id,
        target_date: escalationDraft.target_date,
        completion_steps: Math.max(0, Math.min(4, escalationDraft.completion_steps ?? 0)),
      };

      const { data, error } = await supabase
        .from('board_escalations')
        .upsert(payload, { onConflict: 'board_id,card_id' })
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);

      setEscalations(prev =>
        prev.map(entry =>
          entry.card_id === editingEscalation.card_id
            ? {
                ...entry,
                id: (data as EscalationRecord | null)?.id ?? entry.id,
                reason: payload.reason ?? null,
                measure: payload.measure ?? null,
                department_id: payload.department_id ?? null,
                responsible_id: payload.responsible_id ?? null,
                target_date: payload.target_date ?? null,
                completion_steps: payload.completion_steps ?? 0,
              }
            : entry,
        ),
      );

      setMessage('✅ Eskalation gespeichert');
      setTimeout(() => setMessage(''), 4000);
      closeEscalationEditor();
    } catch (error) {
      handleError(error, 'Fehler beim Speichern der Eskalation');
    }
  };

  const cycleDraftCompletion = () => {
    if (!escalationDraft) return;
    const current = escalationDraft.completion_steps ?? 0;
    const next = current >= 4 ? 0 : current + 1;
    updateEscalationDraft({ completion_steps: next });
  };

  if (!memberCanSee) {
    return (
      <Card>
        <CardContent>
          <Typography>Keine Berechtigung zum Anzeigen der Management-Ansicht.</Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="body1">🔄 Management-Daten werden geladen...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 6 }}>
      {message && <Alert severity={message.startsWith('❌') ? 'error' : 'success'}>{message}</Alert>}

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
            <Box>
              <Typography variant="h6">👥 Board-Mitglieder</Typography>
              <Typography variant="body2" color="text.secondary">
                Füge Mitglieder hinzu, um Anwesenheit und Verantwortlichkeiten zu erfassen.
              </Typography>
            </Box>
            {canEdit && (
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Mitglied hinzufügen</InputLabel>
                  <Select
                    label="Mitglied hinzufügen"
                    value={memberSelect}
                    onChange={(event) => setMemberSelect(event.target.value)}
                  >
                    <MenuItem value="">
                      <em>Auswählen</em>
                    </MenuItem>
                    {availableProfiles.map(profile => (
                      <MenuItem key={profile.id} value={profile.id}>
                        {(profile.full_name || profile.email) + (profile.company ? ` • ${profile.company}` : '')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addMember}
                  disabled={!memberSelect}
                >
                  Hinzufügen
                </Button>
              </Stack>
            )}
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
            {members.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Noch keine Mitglieder hinterlegt.
              </Typography>
            )}
            {members.map(member => {
              const label = member.profile?.full_name || member.profile?.email || 'Unbekannt';
              const detail = member.profile?.company ? ` (${member.profile.company})` : '';
              const deletable = canEdit && !isSuperuserEmail(member.profile?.email ?? null);
              return (
                <Chip
                  key={member.id}
                  label={`${label}${detail}`}
                  onDelete={deletable ? () => removeMember(member.id) : undefined}
                  sx={{ mr: 1, mb: 1 }}
                  color={member.profile?.is_active ? 'primary' : 'default'}
                />
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h6">🗓️ Anwesenheit</Typography>
              <Typography variant="body2" color="text.secondary">
                Woche {isoWeekNumber(weekStart)} ({weekRangeLabel(weekStart)})
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <IconButton onClick={() => adjustWeek(-1)}>
                <ArrowBackIcon />
              </IconButton>
              <IconButton onClick={() => adjustWeek(1)}>
                <ArrowForwardIcon />
              </IconButton>
            </Stack>
          </Stack>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            {members.map(member => (
              <Grid item xs={12} md={6} lg={4} key={member.id}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    {member.profile?.full_name || member.profile?.email}
                  </Typography>
                  <FormControl size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={attendanceFor(member.profile_id)}
                      disabled={!canEdit}
                      onChange={(event) => upsertAttendance(member.profile_id, event.target.value)}
                    >
                      {ATTENDANCE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
            <Box>
              <Typography variant="h6">🚨 Projekte in Eskalation</Typography>
              <Typography variant="body2" color="text.secondary">
                Es werden automatisch alle Karten angezeigt, die im Board als LK oder SK markiert sind.
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {(['LK', 'SK'] as const).map(category => {
            const entries = filteredEscalations[category];
            return (
              <Box key={category} sx={{ mb: category === 'LK' ? 3 : 0 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {category} Eskalationen
                </Typography>

                {entries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {category === 'LK'
                      ? 'Keine LK Eskalationen vorhanden.'
                      : 'Keine SK Eskalationen vorhanden.'}
                  </Typography>
                ) : (
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    {entries.map(entry => {
                      const responsible = entry.responsible_id ? profileById.get(entry.responsible_id) : undefined;
                      const department = departmentName(entry.department_id);
                      const targetLabel = entry.target_date
                        ? new Date(entry.target_date).toLocaleDateString('de-DE')
                        : 'Kein Termin';

                      return (
                        <Box
                          key={entry.card_id}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 2,
                          }}
                        >
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', md: 'center' }}
                          >
                            <Box>
                              <Typography variant="subtitle2">
                                {entry.project_code || entry.project_name
                                  ? `${entry.project_code ?? ''}${entry.project_code && entry.project_name ? ' – ' : ''}${entry.project_name ?? ''}`
                                  : entry.title}
                              </Typography>
                              {entry.stage && (
                                <Typography variant="body2" color="text.secondary">
                                  Phase: {entry.stage}
                                </Typography>
                              )}
                            </Box>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Tooltip title="Fortschritt (Bearbeitung im Popup)">
                                <Box>
                                  <CompletionDial steps={entry.completion_steps ?? 0} onClick={() => {}} disabled />
                                </Box>
                              </Tooltip>
                              <Button
                                variant="outlined"
                                onClick={() => openEscalationEditor(entry)}
                                disabled={!canEdit}
                              >
                                Bearbeiten
                              </Button>
                            </Stack>
                          </Stack>

                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">
                                Grund
                              </Typography>
                              <Typography variant="body2">
                                {entry.reason || 'Kein Grund hinterlegt.'}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">
                                Maßnahme
                              </Typography>
                              <Typography variant="body2">
                                {entry.measure || 'Keine Maßnahme hinterlegt.'}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography variant="caption" color="text.secondary">
                                Abteilung
                              </Typography>
                              <Typography variant="body2">
                                {department || 'Keine Abteilung zugewiesen.'}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography variant="caption" color="text.secondary">
                                Verantwortung
                              </Typography>
                              <Typography variant="body2">
                                {responsible
                                  ? `${responsible.full_name || responsible.email}${responsible.company ? ` • ${responsible.company}` : ''}`
                                  : 'Keine Verantwortung zugewiesen.'}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography variant="caption" color="text.secondary">
                                Zieltermin
                              </Typography>
                              <Typography variant="body2">
                                {targetLabel}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      );
                    })}
                  </Stack>
                )}

                {category === 'LK' && <Divider sx={{ my: 2 }} />}
              </Box>
            );
          })}
        </CardContent>
      </Card>



      <Dialog open={escalationDialogOpen} onClose={closeEscalationEditor} maxWidth="sm" fullWidth>
        <DialogTitle>
          Eskalation bearbeiten
          {editingEscalation && (
            <Typography variant="body2" color="text.secondary">
              {editingEscalation.project_code || editingEscalation.project_name
                ? `${editingEscalation.project_code ?? ''}${editingEscalation.project_code && editingEscalation.project_name ? ' – ' : ''}${editingEscalation.project_name ?? ''}`
                : editingEscalation.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {escalationDraft ? (
            <Stack spacing={2}>
              <TextField
                label="Grund"
                value={escalationDraft.reason}
                onChange={(event) => updateEscalationDraft({ reason: event.target.value })}
                fullWidth
                multiline
                minRows={3}
                disabled={!canEdit}
              />
              <TextField
                label="Maßnahme"
                value={escalationDraft.measure}
                onChange={(event) => updateEscalationDraft({ measure: event.target.value })}
                fullWidth
                multiline
                minRows={3}
                disabled={!canEdit}
              />
              <FormControl fullWidth size="small" disabled={!canEdit}>
                <InputLabel>Abteilung</InputLabel>
                <Select
                  value={escalationDraft.department_id ?? ''}
                  label="Abteilung"
                  onChange={(event) =>
                    updateEscalationDraft({
                      department_id: event.target.value ? String(event.target.value) : null,
                      responsible_id: null,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>Keine</em>
                  </MenuItem>
                  {departments.map(department => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" disabled={!canEdit}>
                <InputLabel>Verantwortung</InputLabel>
                <Select
                  value={escalationDraft.responsible_id ?? ''}
                  label="Verantwortung"
                  onChange={(event) =>
                    updateEscalationDraft({
                      responsible_id: event.target.value ? String(event.target.value) : null,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>Keine</em>
                  </MenuItem>
                  {responsibleOptions(escalationDraft.department_id ?? null).map(option => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.full_name || option.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Zieltermin"
                type="date"
                value={escalationDraft.target_date ?? ''}
                onChange={(event) => updateEscalationDraft({ target_date: event.target.value || null })}
                fullWidth
                disabled={!canEdit}
                InputLabelProps={{ shrink: true }}
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Tooltip title="Fortschritt">
                  <Box>
                    <CompletionDial
                      steps={escalationDraft.completion_steps ?? 0}
                      onClick={cycleDraftCompletion}
                      disabled={!canEdit}
                    />
                  </Box>
                </Tooltip>
                <Typography variant="body2">{escalationDraft.completion_steps ?? 0} / 4 Schritte</Typography>
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2">Keine Eskalation ausgewählt.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEscalationEditor}>Abbrechen</Button>
          <Button onClick={saveEscalation} variant="contained" disabled={!canEdit}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
