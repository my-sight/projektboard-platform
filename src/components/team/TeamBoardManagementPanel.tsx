'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';

interface BoardMemberRow {
  id: string;
  profile_id: string;
}

interface AttendanceRecord {
  id: string;
  board_id: string;
  profile_id: string;
  week_start: string;
  status: 'present' | 'absent' | string;
}

interface TopicRow {
  id: string;
  board_id: string;
  title: string;
  calendar_week: string | null;
  due_date: string | null; // NEU: due_date hinzugefügt
  position: number;
}

interface TopicDraft {
  title: string;
  dueDate: string; // NEU: dueDate statt calendarWeek
}

interface MemberWithProfile extends BoardMemberRow {
  profile: ClientProfile | null;
}

interface WeekHistoryItem {
  week: string;
  date: Date;
}

interface TeamBoardManagementPanelProps {
  boardId: string;
  canEdit: boolean;
  memberCanSee: boolean;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeWeekValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return isoDate(startOfWeek(parsed));
}

function expandWeekRange(values: (string | null | undefined)[], ensureWeek?: string): string[] {
  const normalized = values
    .map(normalizeWeekValue)
    .filter((value): value is string => Boolean(value));

  const ensured = normalizeWeekValue(ensureWeek);

  if (ensured) {
    normalized.push(ensured);
  }

  if (normalized.length === 0) {
    const current = isoDate(startOfWeek(new Date()));
    return [current];
  }

  const uniqueSorted = Array.from(new Set(normalized)).sort(
    (a, b) => new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime(),
  );

  const firstDate = startOfWeek(new Date(`${uniqueSorted[0]}T00:00:00`));
  const currentWeek = startOfWeek(new Date());
  const ensuredDate = ensured ? startOfWeek(new Date(`${ensured}T00:00:00`)) : null;
  const lastCandidate = startOfWeek(
    new Date(`${uniqueSorted[uniqueSorted.length - 1]}T00:00:00`),
  );

  const lastDate = new Date(
    Math.max(
      lastCandidate.getTime(),
      currentWeek.getTime(),
      ensuredDate?.getTime() ?? -Infinity,
    ),
  );

  const result: string[] = [];
  for (let cursor = new Date(firstDate); cursor.getTime() <= lastDate.getTime();) {
    result.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
    cursor.setHours(0, 0, 0, 0);
  }

  return result;
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

function isoWeekYear(date: Date): number {
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() - ((target.getDay() + 6) % 7) + 3);
  return target.getFullYear();
}

function dateFromIsoWeek(year: number, week: number): Date {
  const simple = new Date(year, 0, 4);
  const simpleDay = simple.getDay() || 7;
  simple.setDate(simple.getDate() - simpleDay + 1 + (week - 1) * 7);
  simple.setHours(0, 0, 0, 0);
  return simple;
}

function formatWeekInputValue(date: Date): string {
  const week = isoWeekNumber(date).toString().padStart(2, '0');
  const year = isoWeekYear(date);
  return `${year}-W${week}`;
}

function parseWeekInputValue(value: string): string | null {
  const trimmed = value.trim();
  const match = /^([0-9]{4})-W([0-9]{2})$/i.exec(trimmed);

  if (!match) {
    return null;
  }

  const [, yearText, weekText] = match;
  const year = Number(yearText);
  const week = Number(weekText);

  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null;
  }

  const weekDate = startOfWeek(dateFromIsoWeek(year, week));
  return isoDate(weekDate);
}

export default function TeamBoardManagementPanel({ boardId, canEdit, memberCanSee }: TeamBoardManagementPanelProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [memberSelect, setMemberSelect] = useState('');
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [attendanceByWeek, setAttendanceByWeek] = useState<
    Record<string, Record<string, AttendanceRecord | undefined>>
  >({});
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, TopicDraft>>({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; memberId: string | null }>({ open: false, memberId: null });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState<string>(() => isoDate(startOfWeek(new Date())));
  const [orderedWeeks, setOrderedWeeks] = useState<string[]>(() =>
    expandWeekRange([isoDate(startOfWeek(new Date()))]),
  );

  const selectedWeekDate = useMemo(() => {
    if (!selectedWeek) {
      return startOfWeek(new Date());
    }

    const parsed = new Date(`${selectedWeek}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return startOfWeek(new Date());
    }

    return startOfWeek(parsed);
  }, [selectedWeek]);

  const selectedWeekInputValue = useMemo(
    () => formatWeekInputValue(selectedWeekDate),
    [selectedWeekDate],
  );

  const sortedWeekEntries = useMemo(() => {
    const baseWeeks = orderedWeeks.length ? orderedWeeks : [selectedWeek];
    const entries = baseWeeks.map(week => ({
      week,
      date: startOfWeek(new Date(`${week}T00:00:00`)),
    }));

    if (!entries.some(entry => entry.week === selectedWeek)) {
      entries.push({ week: selectedWeek, date: selectedWeekDate });
    }

    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [orderedWeeks, selectedWeek, selectedWeekDate]);

  const historyWeeks = useMemo(
    () => sortedWeekEntries.filter(entry => entry.week !== selectedWeek),
    [sortedWeekEntries, selectedWeek],
  );

  useEffect(() => {
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUserId(user?.id ?? null);
      }).catch(() => {
        setCurrentUserId(null);
      });
    }
  }, [supabase]);

  const isMember = useMemo(() => members.some((m) => m.profile_id === currentUserId), [members, currentUserId]);
  const canManageTopics = canEdit || isMember;

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const run = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const profileList = await fetchClientProfiles();
        if (!active) return;
        setProfiles(profileList);

        const [memberResult, attendanceResult, topicsResult] = await Promise.all([
          supabase
            .from('board_members')
            .select('id, profile_id')
            .eq('board_id', boardId)
            .order('created_at', { ascending: true }),
          supabase
            .from('board_attendance')
            .select('id, board_id, profile_id, week_start, status')
            .eq('board_id', boardId)
            .order('week_start', { ascending: true }),
          supabase
            .from('board_top_topics')
            .select('*')
            .eq('board_id', boardId)
            .order('position', { ascending: true }),
        ]);

        if (memberResult.error) throw memberResult.error;
        if (attendanceResult.error) throw attendanceResult.error;
        if (topicsResult.error) throw topicsResult.error;

        const memberRows = (memberResult.data as BoardMemberRow[] | null) ?? [];
        const mappedMembers: MemberWithProfile[] = memberRows
          .map((row) => {
            const profile = profileList.find((entry) => entry.id === row.profile_id) ?? null;
            if (profile && !isSuperuserEmail(profile.email) && (profile.is_active ?? true)) {
              return { ...row, profile };
            }
            if (!profile) {
              return { ...row, profile: null };
            }
            return null;
          })
          .filter((entry): entry is MemberWithProfile => Boolean(entry));

        setMembers(mappedMembers);

        const attendanceRows = (attendanceResult.data as AttendanceRecord[] | null) ?? [];
        const attendanceMap: Record<string, Record<string, AttendanceRecord>> = {};
        attendanceRows.forEach((row) => {
          const weekKey = isoDate(startOfWeek(new Date(row.week_start)));
          if (!attendanceMap[weekKey]) {
            attendanceMap[weekKey] = {};
          }
          attendanceMap[weekKey][row.profile_id] = row;
        });
        setAttendanceByWeek(attendanceMap);

        const allWeeks = Object.keys(attendanceMap);
        const ordered = expandWeekRange(allWeeks, isoDate(startOfWeek(new Date())));
        setOrderedWeeks(ordered);

        // Select current week or latest available
        const currentWeek = isoDate(startOfWeek(new Date()));
        setSelectedWeek(currentWeek);

        const draft: Record<string, boolean> = {};
        mappedMembers.forEach((member) => {
          const existing = attendanceMap[currentWeek]?.[member.profile_id];
          draft[member.profile_id] = existing ? existing.status !== 'absent' : true;
        });
        setAttendanceDraft(draft);

        const topicRows = (topicsResult.data as TopicRow[] | null) ?? [];
        setTopics(topicRows);
        const topicDraftValues: Record<string, TopicDraft> = {};
        topicRows.forEach((row) => {
          topicDraftValues[row.id] = {
            title: row.title ?? '',
            dueDate: row.due_date ?? '',
          };
        });
        setTopicDrafts(topicDraftValues);
      } catch (cause) {
        if (!active) return;
        console.error('❌ Fehler beim Laden des Team-Managements', cause);
        setMessage('Fehler beim Laden der Management-Daten.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [boardId, supabase]);

  const availableProfiles = useMemo(() => {
    const selected = new Set(members.map((entry) => entry.profile_id));
    return profiles.filter((profile) => {
      if (selected.has(profile.id)) {
        return false;
      }
      if (!profile.is_active && profile.is_active !== undefined) {
        return false;
      }
      if (isSuperuserEmail(profile.email)) {
        return false;
      }
      return true;
    });
  }, [members, profiles]);

  const selectWeek = (week: string) => {
    if (!week) return;

    const parsed = new Date(`${week}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const normalized = isoDate(startOfWeek(parsed));
    setSelectedWeek(normalized);
    setOrderedWeeks(prev => expandWeekRange([...prev, normalized], normalized));

    const nextDraft: Record<string, boolean> = {};
    members.forEach((member) => {
      const existing = attendanceByWeek[normalized]?.[member.profile_id];
      nextDraft[member.profile_id] = existing ? existing.status !== 'absent' : true;
    });
    setAttendanceDraft(nextDraft);
  };

  const toggleAttendanceDraft = (profileId: string) => {
    setAttendanceDraft((prev) => ({ ...prev, [profileId]: !(prev[profileId] ?? true) }));
  };

  const saveAttendance = async () => {
    if (!supabase) return;
    setAttendanceSaving(true);
    setMessage(null);
    const weekDate = startOfWeek(new Date(selectedWeek));
    const payload = members.map((member) => ({
      board_id: boardId,
      profile_id: member.profile_id,
      week_start: weekDate.toISOString().slice(0, 10),
      status: attendanceDraft[member.profile_id] === false ? 'absent' : 'present',
    }));

    try {
      const { error } = await supabase
        .from('board_attendance')
        .upsert(payload, { onConflict: 'board_id,profile_id,week_start' });
      if (error) throw error;

      setMessage('✅ Anwesenheit gespeichert');
      setTimeout(() => setMessage(null), 4000);

      const copy = { ...attendanceByWeek };
      if (!copy[selectedWeek]) {
        copy[selectedWeek] = {};
      }
      payload.forEach((entry) => {
        const existing = attendanceByWeek[selectedWeek]?.[entry.profile_id];
        copy[selectedWeek][entry.profile_id] = {
          id: existing?.id ?? `${boardId}-${entry.profile_id}-${selectedWeek}`,
          board_id: boardId,
          profile_id: entry.profile_id,
          week_start: entry.week_start,
          status: entry.status,
        };
      });
      setAttendanceByWeek(copy);
    } catch (cause) {
      console.error('❌ Fehler beim Speichern der Anwesenheit', cause);
      setMessage('❌ Anwesenheit konnte nicht gespeichert werden.');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const addMember = async () => {
    if (!supabase || !memberSelect) return;
    try {
      const { error, data } = await supabase
        .from('board_members')
        .insert({ board_id: boardId, profile_id: memberSelect })
        .select()
        .single();
      if (error) throw error;

      const profile = profiles.find((entry) => entry.id === memberSelect) ?? null;
      const nextMember: MemberWithProfile = {
        id: data.id as string,
        profile_id: memberSelect,
        profile,
      };
      setMembers((prev) => [...prev, nextMember]);
      setMemberSelect('');
      setMessage('✅ Mitglied hinzugefügt');
      setTimeout(() => setMessage(null), 3000);
    } catch (cause) {
      console.error('❌ Fehler beim Hinzufügen eines Mitglieds', cause);
      setMessage('❌ Mitglied konnte nicht hinzugefügt werden.');
    }
  };

  const requestRemoveMember = (memberId: string) => {
    setDeleteDialog({ open: true, memberId });
  };

  const confirmRemoveMember = async () => {
    if (!supabase || !deleteDialog.memberId) {
      setDeleteDialog({ open: false, memberId: null });
      return;
    }

    try {
      const { error } = await supabase
        .from('board_members')
        .delete()
        .eq('id', deleteDialog.memberId);
      if (error) throw error;

      setMembers((prev) => prev.filter((entry) => entry.id !== deleteDialog.memberId));
      setAttendanceDraft((prev) => {
        const copy = { ...prev };
        const removed = members.find((entry) => entry.id === deleteDialog.memberId);
        if (removed) {
          delete copy[removed.profile_id];
        }
        return copy;
      });
      setMessage('✅ Mitglied entfernt');
      setTimeout(() => setMessage(null), 3000);
    } catch (cause) {
      console.error('❌ Fehler beim Entfernen eines Mitglieds', cause);
      setMessage('❌ Mitglied konnte nicht entfernt werden.');
    } finally {
      setDeleteDialog({ open: false, memberId: null });
    }
  };

  const addTopic = async () => {
    if (!supabase) return;
    if (topics.length >= 5) {
      setMessage('❌ Es können maximal 5 Top-Themen angelegt werden.');
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('board_top_topics')
        .insert({ board_id: boardId, title: '', due_date: null, position: topics.length })
        .select()
        .single();
      if (error) throw error;

      const topic = data as TopicRow;
      setTopics((prev) => [...prev, topic]);
      setTopicDrafts((prev) => ({
        ...prev,
        [topic.id]: {
          title: topic.title ?? '',
          dueDate: '',
        },
      }));
    } catch (cause) {
      console.error('❌ Fehler beim Hinzufügen eines Top-Themas', cause);
      setMessage('❌ Top-Thema konnte nicht angelegt werden.');
    }
  };

  const persistTopic = async (topicId: string) => {
    if (!supabase) return;

    const draft = topicDrafts[topicId] ?? { title: '', dueDate: '' };
    const trimmedTitle = draft.title.trim();
    const dateValue = draft.dueDate;

    const current = topics.find((topic) => topic.id === topicId);
    const currentDate = current?.due_date ?? '';

    if (current && current.title === trimmedTitle && currentDate === dateValue) {
      return;
    }

    try {
      const { error } = await supabase
        .from('board_top_topics')
        .update({
          title: trimmedTitle,
          due_date: dateValue || null, // Jetzt wird due_date gespeichert
          calendar_week: null // Wir nutzen das alte Feld nicht mehr primär
        })
        .eq('id', topicId);
      if (error) throw error;

      setTopics((prev) =>
        prev.map((topic) =>
          topic.id === topicId
            ? { ...topic, title: trimmedTitle, due_date: dateValue || null }
            : topic,
        ),
      );

      // Feedback
      setMessage('✅ Top-Thema gespeichert');
      setTimeout(() => setMessage(null), 2000);

    } catch (cause) {
      console.error('❌ Fehler beim Aktualisieren eines Top-Themas', cause);
      setMessage('❌ Top-Thema konnte nicht aktualisiert werden.');
    }
  };

  const deleteTopic = async (topicId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('board_top_topics')
        .delete()
        .eq('id', topicId);
      if (error) throw error;

      setTopics((prev) => prev.filter((topic) => topic.id !== topicId));
      setTopicDrafts((prev) => {
        const copy = { ...prev };
        delete copy[topicId];
        return copy;
      });
    } catch (cause) {
      console.error('❌ Fehler beim Löschen eines Top-Themas', cause);
      setMessage('❌ Top-Thema konnte nicht gelöscht werden.');
    }
  };

  if (!supabase) {
    return (
      <Card>
        <CardContent>
          <SupabaseConfigNotice />
        </CardContent>
      </Card>
    );
  }

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
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body1">🔄 Management-Daten werden geladen...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 6 }}>
      {message && (
        <Alert severity={message.startsWith('✅') ? 'success' : message.startsWith('❌') ? 'error' : 'info'}>
          {message}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems="flex-start">
            <Box>
              <Typography variant="h6">👥 Team-Mitglieder</Typography>
              <Typography variant="body2" color="text.secondary">
                Verwalte die Mitglieder des Teamboards.
              </Typography>
            </Box>
            {canEdit && (
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Mitglied hinzufügen</InputLabel>
                  <Select
                    label="Mitglied hinzufügen"
                    value={memberSelect}
                    onChange={(event) => setMemberSelect(String(event.target.value))}
                  >
                    <MenuItem value="">
                      <em>Auswählen</em>
                    </MenuItem>
                    {availableProfiles.map((profile) => (
                      <MenuItem key={profile.id} value={profile.id}>
                        {(profile.full_name || profile.email) + (profile.company ? ` • ${profile.company}` : '')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={!memberSelect}
                  onClick={addMember}
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
            {members.map((member) => {
              const label = member.profile?.full_name || member.profile?.email || 'Unbekannt';
              const detail = member.profile?.company ? ` • ${member.profile.company}` : '';
              return (
                <Chip
                  key={member.id}
                  label={`${label}${detail}`}
                  variant="outlined"
                  onDelete={canEdit ? () => requestRemoveMember(member.id) : undefined}
                  deleteIcon={canEdit ? <DeleteIcon fontSize="small" /> : undefined}
                  sx={{ mr: 1, mb: 1 }}
                />
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6">🗓️ Anwesenheit</Typography>
              <Typography variant="body2" color="text.secondary">
                Dokumentiere, wer beim Termin anwesend war.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={() => {
                const next = new Date(selectedWeekDate);
                next.setDate(next.getDate() - 7);
                const normalized = isoDate(startOfWeek(next));
                setSelectedWeek(normalized);
                setOrderedWeeks(prev => expandWeekRange([...prev, normalized], normalized));
              }}>
                <ArrowBackIcon />
              </IconButton>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1">KW {selectedWeek.split('-')[1]}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {weekRangeLabel(startOfWeek(new Date(selectedWeek)))}
                </Typography>
              </Box>
              <IconButton onClick={() => {
                const next = new Date(selectedWeekDate);
                next.setDate(next.getDate() + 7);
                const normalized = isoDate(startOfWeek(next));
                setSelectedWeek(normalized);
                setOrderedWeeks(prev => expandWeekRange([...prev, normalized], normalized));
              }}>
                <ArrowForwardIcon />
              </IconButton>
              {canEdit && (
                <Button
                  variant="contained"
                  sx={{ ml: { md: 2 } }}
                  onClick={saveAttendance}
                  disabled={attendanceSaving || members.length === 0}
                >
                  Diese Woche speichern
                </Button>
              )}
            </Stack>
          </Stack>

          <Box sx={{ mt: 3, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mitglied</TableCell>
                  <TableCell align="center">Aktuelle KW</TableCell>
                  {historyWeeks.map((history) => (
                    <TableCell key={history.week} align="center">
                      <Stack spacing={0.5} alignItems="center">
                        <Button variant="text" size="small" onClick={() => selectWeek(history.week)}>
                          KW {history.week.split('-')[1]}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          {weekRangeLabel(history.date)}
                        </Typography>
                      </Stack>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={historyWeeks.length + 2}>
                      <Typography variant="body2" color="text.secondary">
                        Füge Mitglieder hinzu, um Anwesenheiten zu dokumentieren.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const profile = member.profile;
                    const label = profile?.full_name || profile?.email || 'Unbekannt';
                    const present = attendanceDraft[member.profile_id] ?? true;
                    return (
                      <TableRow key={member.id} hover>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2">{label}</Typography>
                            {profile?.company && (
                              <Typography variant="caption" color="text.secondary">
                                {profile.company}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={present ? 'Anwesend' : 'Abwesend'}>
                            <span>
                              <Checkbox
                                checked={present}
                                disabled={!canEdit || attendanceSaving}
                                icon={<CloseIcon color="error" />}
                                checkedIcon={<CheckIcon color="success" />}
                                onChange={() => toggleAttendanceDraft(member.profile_id)}
                              />
                            </span>
                          </Tooltip>
                        </TableCell>
                        {historyWeeks.map((history) => {
                          const record = attendanceByWeek[history.week]?.[member.profile_id];
                          if (!record) {
                            return (
                              <TableCell key={history.week} align="center">
                                <Typography variant="caption" color="text.secondary">
                                  —
                                </Typography>
                              </TableCell>
                            );
                          }
                          const wasPresent = record.status !== 'absent';
                          return (
                            <TableCell key={history.week} align="center">
                              {wasPresent ? (
                                <CheckIcon color="success" fontSize="small" />
                              ) : (
                                <CloseIcon color="error" fontSize="small" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6">⭐ Top-Themen</Typography>
              <Typography variant="body2" color="text.secondary">
                Halte die wichtigsten Themen fest (maximal fünf Einträge).
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Compose Area */}
            {canManageTopics && topics.length < 5 && (
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Neues Thema erstellen</Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Worum geht es?"
                    value={topicDrafts['new']?.title || ''}
                    onChange={(e) => setTopicDrafts(prev => ({ ...prev, 'new': { ...prev['new'], title: e.target.value, dueDate: prev['new']?.dueDate || '' } }))}
                  />
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <StandardDatePicker
                      label="Fällig am"
                      value={topicDrafts['new']?.dueDate ? dayjs(topicDrafts['new'].dueDate) : null}
                      onChange={(newValue) => setTopicDrafts(prev => ({ ...prev, 'new': { ...prev['new'], title: prev['new']?.title || '', dueDate: newValue ? newValue.format('YYYY-MM-DD') : '' } }))}
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      onClick={async () => {
                        if (!supabase) return;
                        const draft = topicDrafts['new'];
                        if (!draft?.title.trim()) return;

                        try {
                          const { data, error } = await supabase
                            .from('board_top_topics')
                            .insert({ board_id: boardId, title: draft.title, due_date: draft.dueDate || null, position: topics.length })
                            .select()
                            .single();
                          if (error) throw error;

                          setTopics(prev => [...prev, data as TopicRow]);
                          setTopicDrafts(prev => {
                            const copy = { ...prev };
                            delete copy['new'];
                            return copy;
                          });
                          setMessage('✅ Top-Thema angelegt');
                          setTimeout(() => setMessage(null), 3000);
                        } catch (e) {
                          console.error(e);
                          setMessage('❌ Fehler beim Anlegen');
                        }
                      }}
                      disabled={!topicDrafts['new']?.title.trim()}
                    >
                      Speichern
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* List Area */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Aktuelle Themen</Typography>
              {topics.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Noch keine Top-Themen erfasst.</Typography>
              ) : (
                <Stack spacing={1}>
                  {topics.map((topic) => (
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
                          {canManageTopics && (
                            <IconButton size="small" color="error" onClick={() => deleteTopic(topic.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, memberId: null })}>
        <DialogTitle>Mitglied entfernen?</DialogTitle>
        <DialogContent>
          <Typography>Dieses Mitglied wird aus dem Teamboard entfernt.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, memberId: null })}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={confirmRemoveMember}>
            Entfernen
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}