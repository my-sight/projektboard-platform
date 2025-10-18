'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { createClient } from '@supabase/supabase-js';
import { isSuperuserEmail } from '@/constants/superuser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  is_active: boolean;
}

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

interface Escalation {
  id: string;
  board_id: string;
  category: 'LK' | 'SK';
  project_code: string | null;
  project_name: string | null;
  reason: string | null;
  department_id: string | null;
  responsible_id: string | null;
  target_date: string | null;
  completion_steps: number;
  created_at?: string;
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

function mergeMemberProfiles(members: Member[], profiles: Profile[]): (Member & { profile?: Profile })[] {
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
  return members.map(member => ({
    ...member,
    profile: profileMap.get(member.profile_id),
  }));
}

export default function BoardManagementPanel({ boardId, canEdit, memberCanSee }: BoardManagementPanelProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<(Member & { profile?: Profile })[]>([]);
  const [memberSelect, setMemberSelect] = useState('');

  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord | undefined>>({});

  const [topics, setTopics] = useState<Topic[]>([]);

  const [escalations, setEscalations] = useState<Escalation[]>([]);

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
      const [profilesResult, departmentsResult, membersResult, topicsResult, escalationsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
        supabase.from('departments').select('*').order('name'),
        supabase.from('board_members').select('*').eq('board_id', boardId).order('created_at'),
        supabase.from('board_top_topics').select('*').eq('board_id', boardId).order('position'),
        supabase.from('board_escalations').select('*').eq('board_id', boardId).order('created_at'),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (departmentsResult.error) throw new Error(departmentsResult.error.message);
      if (membersResult.error) throw new Error(membersResult.error.message);
      if (topicsResult.error) throw new Error(topicsResult.error.message);
      if (escalationsResult.error) throw new Error(escalationsResult.error.message);

      const profileRows = (profilesResult.data as Profile[]) ?? [];
      const memberRows = mergeMemberProfiles((membersResult.data as Member[]) ?? [], profileRows);

      setProfiles(profileRows);
      setDepartments((departmentsResult.data as Department[]) ?? []);
      setMembers(memberRows);
      setTopics((topicsResult.data as Topic[]) ?? []);
      setEscalations((escalationsResult.data as Escalation[]) ?? []);
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

  const addEscalation = async (category: 'LK' | 'SK') => {
    try {
      const { data, error } = await supabase
        .from('board_escalations')
        .insert({
          board_id: boardId,
          category,
          project_code: '',
          project_name: '',
          completion_steps: 0,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (data) {
        setEscalations(prev => [...prev, data as Escalation]);
      }
    } catch (error) {
      handleError(error, 'Fehler beim Hinzufügen einer Eskalation');
    }
  };

  const updateEscalation = async (escalationId: string, payload: Partial<Escalation>) => {
    try {
      const { error } = await supabase
        .from('board_escalations')
        .update(payload)
        .eq('id', escalationId);

      if (error) throw new Error(error.message);

      setEscalations(prev =>
        prev.map(entry => (entry.id === escalationId ? { ...entry, ...payload } : entry)),
      );
    } catch (error) {
      handleError(error, 'Fehler beim Aktualisieren der Eskalation');
    }
  };

  const deleteEscalation = async (escalationId: string) => {
    try {
      const { error } = await supabase
        .from('board_escalations')
        .delete()
        .eq('id', escalationId);

      if (error) throw new Error(error.message);

      setEscalations(prev => prev.filter(entry => entry.id !== escalationId));
    } catch (error) {
      handleError(error, 'Fehler beim Löschen der Eskalation');
    }
  };

  const cycleCompletion = async (escalation: Escalation) => {
    const next = (escalation.completion_steps ?? 0) >= 4 ? 0 : (escalation.completion_steps ?? 0) + 1;
    await updateEscalation(escalation.id, { completion_steps: next });
  };

  const departmentName = (departmentId: string | null) =>
    departments.find(entry => entry.id === departmentId)?.name ?? '';

  const departmentIdByName = (name: string) =>
    departments.find(entry => entry.name === name)?.id ?? null;

  const responsibleOptions = (departmentId: string | null) => {
    const name = departmentName(departmentId);
    return profiles.filter(profile => profile.company === name && profile.is_active);
  };

  const renderEscalationRow = (escalation: Escalation) => {
    const responsible = profiles.find(profile => profile.id === escalation.responsible_id);
    return (
      <Grid container spacing={2} key={escalation.id} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <TextField
            label="Projektnummer"
            value={escalation.project_code ?? ''}
            onChange={(event) => updateEscalation(escalation.id, { project_code: event.target.value })}
            fullWidth
            disabled={!canEdit}
            size="small"
            sx={{ mb: 1 }}
          />
          <TextField
            label="Projektname"
            value={escalation.project_name ?? ''}
            onChange={(event) => updateEscalation(escalation.id, { project_name: event.target.value })}
            fullWidth
            disabled={!canEdit}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            label="Grund"
            value={escalation.reason ?? ''}
            onChange={(event) => updateEscalation(escalation.id, { reason: event.target.value })}
            fullWidth
            disabled={!canEdit}
            multiline
            minRows={3}
          />
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Abteilung</InputLabel>
            <Select
              value={departmentName(escalation.department_id)}
              label="Abteilung"
              disabled={!canEdit}
              onChange={(event) => updateEscalation(escalation.id, {
                department_id: departmentIdByName(event.target.value),
                responsible_id: null,
              })}
            >
              <MenuItem value="">
                <em>Keine</em>
              </MenuItem>
              {departments.map(department => (
                <MenuItem key={department.id} value={department.name}>
                  {department.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Verantwortung</InputLabel>
            <Select
              value={escalation.responsible_id ?? ''}
              label="Verantwortung"
              disabled={!canEdit}
              onChange={(event) => updateEscalation(escalation.id, { responsible_id: event.target.value || null })}
            >
              <MenuItem value="">
                <em>Keine</em>
              </MenuItem>
              {responsibleOptions(escalation.department_id).map(option => (
                <MenuItem key={option.id} value={option.id}>
                  {option.full_name || option.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField
            label="Zieltermin"
            type="date"
            value={escalation.target_date ?? ''}
            onChange={(event) => updateEscalation(escalation.id, { target_date: event.target.value })}
            fullWidth
            disabled={!canEdit}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ mb: 2 }}
          />
          <Tooltip title="Kuchendiagramm Fortschritt">
            <Box>
              <CompletionDial
                steps={escalation.completion_steps ?? 0}
                onClick={() => cycleCompletion(escalation)}
                disabled={!canEdit}
              />
            </Box>
          </Tooltip>
        </Grid>
        <Grid item xs={12} md={2}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {responsible && (
              <Chip label={responsible.full_name || responsible.email} size="small" />
            )}
            {canEdit && (
              <IconButton color="error" onClick={() => deleteEscalation(escalation.id)}>
                <DeleteIcon />
              </IconButton>
            )}
          </Stack>
        </Grid>
      </Grid>
    );
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="h6">⭐ Top-Themen</Typography>
            {canEdit && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addTopic}
                disabled={topics.length >= 5}
              >
                weiteres Thema
              </Button>
            )}
          </Stack>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {topics.map(topic => (
              <Stack direction="row" spacing={1} key={topic.id} alignItems="center">
                <TextField
                  fullWidth
                  value={topic.title ?? ''}
                  placeholder="Top Thema"
                  onChange={(event) =>
                    setTopics(prev =>
                      prev.map(entry =>
                        entry.id === topic.id ? { ...entry, title: event.target.value } : entry,
                      ),
                    )
                  }
                  onBlur={(event) => updateTopic(topic.id, event.target.value)}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <IconButton color="error" onClick={() => deleteTopic(topic.id)}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
            ))}
            {topics.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Noch keine Top-Themen erfasst.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="h6">🚨 Projekte in Eskalation</Typography>
            <Stack direction="row" spacing={1}>
              {canEdit && (
                <>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addEscalation('LK')}>
                    LK hinzufügen
                  </Button>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addEscalation('SK')}>
                    SK hinzufügen
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" sx={{ mb: 1 }}>LK</Typography>
          {filteredEscalations.LK.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Keine LK Eskalationen vorhanden.
            </Typography>
          )}
          {filteredEscalations.LK.map(renderEscalationRow)}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" sx={{ mb: 1 }}>SK</Typography>
          {filteredEscalations.SK.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Keine SK Eskalationen vorhanden.
            </Typography>
          )}
          {filteredEscalations.SK.map(renderEscalationRow)}
        </CardContent>
      </Card>
    </Stack>
  );
}
