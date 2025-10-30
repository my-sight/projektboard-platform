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
  position: number;
  calendar_week: string | null;
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
  canView: boolean;
  canManageTopics: boolean;
}

const formatWeekKey = (date: Date): string => {
  const temp = new Date(date);
  const target = startOfWeek(temp);
  const year = target.getFullYear();
  const week = isoWeekNumber(target);
  return `${year}-${String(week).padStart(2, '0')}`;
};

const parseWeekKey = (value: string): Date => {
  const [yearPart, weekPart] = value.split('-');
  const year = Number(yearPart);
  const week = Number(weekPart);
  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    return startOfWeek(new Date());
  }
  const simple = new Date(Date.UTC(year, 0, 1));
  const day = simple.getUTCDay();
  const diff = (day <= 4 ? day - 1 : day - 8);
  simple.setUTCDate(simple.getUTCDate() - diff + (week - 1) * 7);
  return startOfWeek(simple);
};

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

const weekRangeLabel = (date: Date): string => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const formatter = new Intl.DateTimeFormat('de-DE');
  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

const shiftWeek = (weekKey: string, delta: number): string => {
  const base = parseWeekKey(weekKey);
  base.setDate(base.getDate() + delta * 7);
  return formatWeekKey(base);
};

export default function TeamBoardManagementPanel({
  boardId,
  canEdit,
  canView,
  canManageTopics,
}: TeamBoardManagementPanelProps) {
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
  const [selectedWeek, setSelectedWeek] = useState<string>(formatWeekKey(new Date()));
  const [historyWeeks, setHistoryWeeks] = useState<WeekHistoryItem[]>([]);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [topicDrafts, setTopicDrafts] = useState<
    Record<string, { title: string; calendarWeek: string }>
  >({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; memberId: string | null }>({ open: false, memberId: null });

  useEffect(() => {
    if (!supabase) {
      return;
    }

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
            .select('id, board_id, title, position, calendar_week')
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
          const weekKey = formatWeekKey(new Date(row.week_start));
          if (!attendanceMap[weekKey]) {
            attendanceMap[weekKey] = {};
          }
          attendanceMap[weekKey][row.profile_id] = row;
        });
        setAttendanceByWeek(attendanceMap);

        const allWeeks = Object.keys(attendanceMap)
          .map((week) => ({ week, date: parseWeekKey(week) }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        const nextSelected = allWeeks.length ? allWeeks[0].week : formatWeekKey(new Date());
        setSelectedWeek(nextSelected);
        setHistoryWeeks(allWeeks.filter((item) => item.week !== nextSelected).slice(0, 10));

        const draft: Record<string, boolean> = {};
        mappedMembers.forEach((member) => {
          const existing = attendanceMap[nextSelected]?.[member.profile_id];
          draft[member.profile_id] = existing ? existing.status !== 'absent' : true;
        });
        setAttendanceDraft(draft);

        const topicRows = (topicsResult.data as TopicRow[] | null) ?? [];
        setTopics(topicRows);
        const topicDraftValues: Record<string, { title: string; calendarWeek: string }> = {};
        topicRows.forEach((row) => {
          topicDraftValues[row.id] = {
            title: row.title ?? '',
            calendarWeek: row.calendar_week ?? '',
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

  const selectWeek = (weekKey: string) => {
    setSelectedWeek(weekKey);
    const nextDraft: Record<string, boolean> = {};
    members.forEach((member) => {
      const existing = attendanceByWeek[weekKey]?.[member.profile_id];
      nextDraft[member.profile_id] = existing ? existing.status !== 'absent' : true;
    });
    setAttendanceDraft(nextDraft);
    setHistoryWeeks((prev) => {
      const weekSet = new Map<string, WeekHistoryItem>();
      prev.forEach((item) => weekSet.set(item.week, item));
      Object.keys(attendanceByWeek).forEach((week) => {
        if (week !== weekKey) {
          weekSet.set(week, { week, date: parseWeekKey(week) });
        }
      });
      weekSet.delete(weekKey);
      const sorted = Array.from(weekSet.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
      return sorted.slice(0, 10);
    });
  };

  const toggleAttendanceDraft = (profileId: string) => {
    setAttendanceDraft((prev) => ({ ...prev, [profileId]: !(prev[profileId] ?? true) }));
  };

  const saveAttendance = async () => {
    if (!supabase) return;
    setAttendanceSaving(true);
    setMessage(null);
    const weekDate = parseWeekKey(selectedWeek);
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

      // Refresh attendance map
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
        .insert({
          board_id: boardId,
          title: '',
          position: topics.length,
          calendar_week: null,
        })
        .select()
        .single();
      if (error) throw error;

      const topic = data as TopicRow;
      setTopics((prev) => [...prev, topic]);
      setTopicDrafts((prev) => ({
        ...prev,
        [topic.id]: {
          title: topic.title ?? '',
          calendarWeek: topic.calendar_week ?? '',
        },
      }));
    } catch (cause) {
      console.error('❌ Fehler beim Hinzufügen eines Top-Themas', cause);
      setMessage('❌ Top-Thema konnte nicht angelegt werden.');
    }
  };

  const persistTopic = async (topicId: string) => {
    if (!supabase) return;
    try {
      const draft = topicDrafts[topicId] ?? { title: '', calendarWeek: '' };
      const trimmedTitle = draft.title.trim();
      const trimmedWeek = draft.calendarWeek.trim();
      const normalizedWeek = trimmedWeek === '' ? null : trimmedWeek;
      const current = topics.find((entry) => entry.id === topicId);
      const currentWeek = current?.calendar_week ?? null;
      if (current && current.title === trimmedTitle && currentWeek === normalizedWeek) {
        if (current.title !== draft.title || (currentWeek ?? '') !== (draft.calendarWeek ?? '')) {
          setTopicDrafts((prev) => ({
            ...prev,
            [topicId]: { title: trimmedTitle, calendarWeek: trimmedWeek },
          }));
        }
        return;
      }
      const { error } = await supabase
        .from('board_top_topics')
        .update({ title: trimmedTitle, calendar_week: normalizedWeek })
        .eq('id', topicId);
      if (error) throw error;
      setTopics((prev) =>
        prev.map((entry) =>
          entry.id === topicId
            ? { ...entry, title: trimmedTitle, calendar_week: normalizedWeek }
            : entry,
        ),
      );
      setTopicDrafts((prev) => ({
        ...prev,
        [topicId]: { title: trimmedTitle, calendarWeek: trimmedWeek },
      }));
      setMessage('✅ Top-Thema aktualisiert');
      setTimeout(() => setMessage(null), 3000);
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

  if (!canView) {
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
              <IconButton onClick={() => selectWeek(shiftWeek(selectedWeek, -1))}>
                <ArrowBackIcon />
              </IconButton>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1">KW {selectedWeek.split('-')[1]}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {weekRangeLabel(parseWeekKey(selectedWeek))}
                </Typography>
              </Box>
              <IconButton onClick={() => selectWeek(shiftWeek(selectedWeek, 1))}>
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
            {canManageTopics && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addTopic}
                disabled={topics.length >= 5}
              >
                Neues Thema
              </Button>
            )}
          </Stack>

          <Stack spacing={2} sx={{ mt: 3 }}>
            {topics.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Noch keine Top-Themen erfasst.
              </Typography>
            )}
            {topics.map((topic) => {
              const draft =
                topicDrafts[topic.id] ?? {
                  title: topic.title ?? '',
                  calendarWeek: topic.calendar_week ?? '',
                };
              return (
                <Stack
                  key={topic.id}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                >
                  <TextField
                    label="Thema"
                    value={draft.title}
                    onChange={(event) =>
                      setTopicDrafts((prev) => ({
                        ...prev,
                        [topic.id]: {
                          title: event.target.value,
                          calendarWeek: (prev[topic.id] ?? draft).calendarWeek,
                        },
                      }))
                    }
                    onBlur={() => persistTopic(topic.id)}
                    fullWidth
                    disabled={!canEdit}
                  />
                  <TextField
                    label="KW"
                    value={draft.calendarWeek}
                    onChange={(event) =>
                      setTopicDrafts((prev) => ({
                        ...prev,
                        [topic.id]: {
                          title: (prev[topic.id] ?? draft).title,
                          calendarWeek: event.target.value,
                        },
                      }))
                    }
                    onBlur={() => persistTopic(topic.id)}
                    disabled={!canEdit}
                    sx={{ width: { xs: '100%', md: 160 } }}
                    placeholder="z. B. KW 12"
                  />
                  {canEdit && (
                    <Button color="error" onClick={() => deleteTopic(topic.id)} startIcon={<DeleteIcon />}>Löschen</Button>
                  )}
                </Stack>
              );
            })}
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
