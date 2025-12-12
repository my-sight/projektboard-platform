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
  Switch,
  FormControlLabel,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
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
  const { user } = useAuth();
  const currentUserId = user?.id || null;

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

  const isMember = useMemo(() => members.some((m) => m.profile_id === currentUserId), [members, currentUserId]);
  const canManageTopics = canEdit || isMember;

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setMessage(null);
      console.log('TeamBoardManagementPanel loading for boardId:', boardId);
      try {
        const profileList = await fetchClientProfiles();
        if (!active) return;
        setProfiles(profileList);

        const [memberResult, attendanceResult, topicsResult] = await Promise.all([
          (async () => {
            const { data } = await supabase.from('board_members').select('*').eq('board_id', boardId);
            return data || [];
          })(),
          (async () => {
            const { data } = await supabase.from('board_attendance').select('*').eq('board_id', boardId);
            return data || [];
          })(),
          (async () => {
            const { data } = await supabase.from('board_top_topics').select('*').eq('board_id', boardId);
            return data || [];
          })()
        ]);

        const mappedMembers: MemberWithProfile[] = memberResult
          .map((row) => {
            const userId = row.user_id || row.profile_id;
            const profile = profileList.find((entry) => entry.id === userId) ?? null;

            console.log('Mapping member:', { rowId: row.id, userId, profileFound: !!profile, email: profile?.email });

            if (profile && !isSuperuserEmail(profile.email) && (profile.is_active ?? true)) {
              return { id: row.id, profile_id: userId, profile };
            }
            if (!profile && userId) {
              console.warn('Member profile not found for ID:', userId);
              return { id: row.id, profile_id: userId, profile: null };
            }
            return null;
          })
          .filter((entry): entry is MemberWithProfile => Boolean(entry));

        setMembers(mappedMembers);

        const attendanceMap: Record<string, Record<string, AttendanceRecord>> = {};
        (attendanceResult as any[]).forEach((row) => {
          // PB date strings usually iso8601, but row.week_start might be date only depending on schema type 'date' which returns string
          // Fix: row.user_id is the field in DB, but we might have been looking for profile_id before.
          // In migration, user_id is the relation to users collection.
          const userId = row.user_id || row.profile_id;

          const dateStr = row.week_start.split('T')[0];
          const weekKey = isoDate(startOfWeek(new Date(dateStr)));
          if (!attendanceMap[weekKey]) {
            attendanceMap[weekKey] = {};
          }
          // Store using profile_id (userId) as key to match member.profile_id
          if (userId) {
            attendanceMap[weekKey][userId] = {
              id: row.id,
              board_id: row.board_id,
              profile_id: userId,
              week_start: row.week_start,
              status: row.status
            } as AttendanceRecord;
          }
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

        const topicRows = topicsResult.map(r => ({ id: r.id, board_id: r.board_id, title: r.title, calendar_week: r.calendar_week, due_date: r.due_date, position: r.position })) as TopicRow[];
        setTopics(topicRows);
        const topicDraftValues: Record<string, TopicDraft> = {};
        topicRows.forEach((row) => {
          topicDraftValues[row.id] = {
            title: row.title ?? '',
            dueDate: row.due_date ?? '',
          };
        });
        setTopicDrafts(topicDraftValues);
      } catch (cause: any) {
        if (!active) return;
        console.error('❌ Fehler beim Laden des Team-Managements', cause);
        const detail = cause?.response?.message || cause?.message || JSON.stringify(cause);
        setMessage(t('boardManagement.loadError') + ': ' + detail);
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
  }, [boardId]);

  const availableProfiles = useMemo(() => {
    const selected = new Set(members.map((entry) => entry.profile_id));
    const filtered = profiles.filter((profile) => {
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

    // Sort by Department/Company then Name
    return filtered.sort((a, b) => {
      const deptA = (a.department || a.company || t('boardManagement.noDepartment')).toLowerCase();
      const deptB = (b.department || b.company || t('boardManagement.noDepartment')).toLowerCase();
      if (deptA < deptB) return -1;
      if (deptA > deptB) return 1;

      const nameA = (a.full_name || a.name || a.email || '').toLowerCase();
      const nameB = (b.full_name || b.name || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members, profiles, t]);

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
    setAttendanceSaving(true);
    setMessage(null);
    const weekDate = startOfWeek(new Date(selectedWeek));
    const weekStartStr = isoDate(weekDate); // Fix: Use local date string to avoid UTC-1 shift (Sunday issue)

    try {
      // Iterate and update/create
      // We need to know if it exists. attendanceByWeek has this info (including ID)
      const promises = members.map(async (member) => {
        const status = attendanceDraft[member.profile_id] === false ? 'absent' : 'present';

        // Use upsert to handle both creation and updates (and race conditions)
        // Column is 'profile_id', NOT 'user_id'
        const { data: saved, error } = await supabase.from('board_attendance').upsert({
          board_id: boardId,
          profile_id: member.profile_id,
          week_start: weekStartStr, // Sending 'YYYY-MM-DD' is safest for 'date' column
          status
        }, {
          onConflict: 'board_id,profile_id,week_start'
        }).select().single();

        if (error) {
          console.error('DEBUG: Upsert Error:', error);
          throw error;
        }
        if (!saved) throw new Error('Failed to save attendance');

        return {
          id: saved.id,
          board_id: saved.board_id,
          profile_id: saved.profile_id,
          week_start: saved.week_start,
          status: saved.status
        } as AttendanceRecord;
      });

      const results = await Promise.all(promises);

      setMessage(t('boardManagement.attendanceSaved'));
      setTimeout(() => setMessage(null), 4000);

      const copy = { ...attendanceByWeek };
      if (!copy[selectedWeek]) {
        copy[selectedWeek] = {};
      }

      results.forEach(res => {
        if (res) copy[selectedWeek][res.profile_id] = res;
      });
      setAttendanceByWeek(copy);

    } catch (cause: any) {
      console.error('❌ Fehler beim Speichern der Anwesenheit', cause);
      setMessage(t('boardManagement.attendanceSaveError') + ': ' + cause.message);
    } finally {
      setAttendanceSaving(false);
    }
  };

  const addMember = async () => {
    if (!memberSelect) return;
    try {
      const { data, error } = await supabase.from('board_members').insert({
        board_id: boardId,
        user_id: memberSelect,
        profile_id: memberSelect // Maintain both for compatibility
      }).select().single();

      if (error || !data) throw error;

      const profile = profiles.find((entry) => entry.id === memberSelect) ?? null;
      const nextMember: MemberWithProfile = {
        id: data.id,
        profile_id: memberSelect,
        profile,
      };
      setMembers((prev) => [...prev, nextMember]);
      setMemberSelect('');
      setMessage(t('boardManagement.memberAdded'));
      setTimeout(() => setMessage(null), 3000);
    } catch (cause: any) {
      console.error('❌ Fehler beim Hinzufügen eines Mitglieds', cause);
      setMessage(t('boardManagement.memberAddError') + ': ' + cause.message);
    }
  };

  const requestRemoveMember = (memberId: string) => {
    setDeleteDialog({ open: true, memberId });
  };

  const confirmRemoveMember = async () => {
    if (!deleteDialog.memberId) {
      setDeleteDialog({ open: false, memberId: null });
      return;
    }

    try {
      await supabase.from('board_members').delete().eq('id', deleteDialog.memberId);

      setMembers((prev) => prev.filter((entry) => entry.id !== deleteDialog.memberId));
      setAttendanceDraft((prev) => {
        const copy = { ...prev };
        const removed = members.find((entry) => entry.id === deleteDialog.memberId);
        if (removed) {
          delete copy[removed.profile_id];
        }
        return copy;
      });
      setMessage(t('boardManagement.memberRemoved'));
      setTimeout(() => setMessage(null), 3000);
    } catch (cause) {
      console.error('❌ Fehler beim Entfernen eines Mitglieds', cause);
      setMessage(t('boardManagement.memberRemoveError'));
    } finally {
      setDeleteDialog({ open: false, memberId: null });
    }
  };

  const addTopic = async () => {
    const draft = topicDrafts['new'];
    if (!draft?.title.trim()) return;

    try {
      const { data, error } = await supabase.from('board_top_topics').insert({
        board_id: boardId,
        title: draft.title,
        due_date: draft.dueDate || null,
        position: topics.length,
      }).select().single();

      if (error || !data) throw error;

      const topic = { id: data.id, board_id: data.board_id, title: data.title, due_date: data.due_date, position: data.position, calendar_week: data.calendar_week } as TopicRow;
      setTopics((prev) => [...prev, topic]);
      setTopicDrafts((prev) => {
        const copy = { ...prev };
        delete copy['new'];
        // Initialize the new topic in drafts (though it's not strictly necessary if we only edit existing ones)
        copy[topic.id] = {
          title: topic.title ?? '',
          dueDate: topic.due_date ?? '',
        };
        return copy;
      });
      setMessage(t('boardManagement.topicCreated'));
      setTimeout(() => setMessage(null), 3000);
    } catch (cause) {
      console.error('❌ Fehler beim Hinzufügen eines Top-Themas', cause);
      setMessage(t('boardManagement.topicCreateError'));
    }
  };

  const persistTopic = async (topicId: string) => {
    const draft = topicDrafts[topicId] ?? { title: '', dueDate: '' };
    const trimmedTitle = draft.title.trim();
    const dateValue = draft.dueDate;

    const current = topics.find((topic) => topic.id === topicId);
    const currentDate = current?.due_date ?? '';

    if (current && current.title === trimmedTitle && currentDate === dateValue) {
      return;
    }

    try {
      await supabase.from('board_top_topics').update({
        title: trimmedTitle,
        due_date: dateValue || null
      }).eq('id', topicId);

      setTopics((prev) =>
        prev.map((topic) =>
          topic.id === topicId
            ? { ...topic, title: trimmedTitle, due_date: dateValue || null }
            : topic,
        ),
      );

      // Feedback
      setMessage(t('boardManagement.topicSaved'));
      setTimeout(() => setMessage(null), 2000);

    } catch (cause) {
      console.error('❌ Fehler beim Aktualisieren eines Top-Themas', cause);
      setMessage(t('boardManagement.topicUpdateError'));
    }
  };

  const deleteTopic = async (topicId: string) => {
    try {
      await supabase.from('board_top_topics').delete().eq('id', topicId);

      setTopics((prev) => prev.filter((topic) => topic.id !== topicId));
      setTopicDrafts((prev) => {
        const copy = { ...prev };
        delete copy[topicId];
        return copy;
      });
    } catch (cause) {
      console.error('❌ Fehler beim Löschen eines Top-Themas', cause);
      setMessage(t('boardManagement.topicDeleteError'));
    }
  };



  if (!memberCanSee) {
    return (
      <Card>
        <CardContent>
          <Typography>{t('boardManagement.noPermission')}</Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body1">{t('boardManagement.loading')}</Typography>
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
              <Typography variant="h6">👥 {t('boardManagement.teamMembers')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('boardManagement.manageMembers')}
              </Typography>
            </Box>
            {canEdit && (
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>{t('boardManagement.addMember')}</InputLabel>
                  <Select
                    label={t('boardManagement.addMember')}
                    value={memberSelect}
                    onChange={(event) => setMemberSelect(String(event.target.value))}
                  >
                    <MenuItem value="">
                      <em>{t('boardManagement.select')}</em>
                    </MenuItem>
                    {availableProfiles.map((profile) => (
                      <MenuItem key={profile.id} value={profile.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {profile.full_name || profile.name || profile.email}
                          </Typography>
                          {(profile.department || profile.company) && (
                            <Typography variant="caption" color="text.secondary">
                              {profile.department || profile.company}
                            </Typography>
                          )}
                        </Box>
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
                  {t('boardManagement.add')}
                </Button>
              </Stack>
            )}
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
            {members.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('boardManagement.noMembers')}
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
              <Typography variant="h6">🗓️ {t('boardManagement.attendance')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('boardManagement.attendanceDesc')}
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
                <Typography variant="subtitle1">KW {isoWeekNumber(selectedWeekDate)}</Typography>
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
                  {t('boardManagement.saveWeek')}
                </Button>
              )}
            </Stack>
          </Stack>

          <Box sx={{ mt: 3, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('boardManagement.member')}</TableCell>
                  <TableCell align="center">{t('boardManagement.currentWeek')}</TableCell>
                  {historyWeeks.map((history) => (
                    <TableCell key={history.week} align="center">
                      <Stack spacing={0.5} alignItems="center">
                        <Button variant="text" size="small" onClick={() => selectWeek(history.week)}>
                          KW {isoWeekNumber(startOfWeek(new Date(history.week)))}
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
                        {t('boardManagement.addMembersHint')}
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
                          <Tooltip title={present ? t('boardManagement.present') : t('boardManagement.absent')}>
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
              <Typography variant="h6">⭐ {t('boardManagement.topTopicsTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('boardManagement.topTopicsDesc')}
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Compose Area */}
            {canManageTopics && topics.length < 5 && (
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('boardManagement.createTopicTitle')}</Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder={t('boardManagement.topicContent')}
                    value={topicDrafts['new']?.title || ''}
                    onChange={(e) => setTopicDrafts(prev => ({ ...prev, 'new': { ...prev['new'], title: e.target.value, dueDate: prev['new']?.dueDate || '' } }))}
                  />
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <StandardDatePicker
                      label={t('boardManagement.topicDue')}
                      value={topicDrafts['new']?.dueDate ? dayjs(topicDrafts['new'].dueDate) : null}
                      onChange={(newValue) => setTopicDrafts(prev => ({ ...prev, 'new': { ...prev['new'], title: prev['new']?.title || '', dueDate: newValue ? newValue.format('YYYY-MM-DD') : '' } }))}
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      onClick={addTopic}
                      disabled={!topicDrafts['new']?.title.trim()}
                    >
                      {t('boardManagement.saveButton')}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* List Area */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('boardManagement.currentTopicsTitle')}</Typography>
              {topics.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('boardManagement.noTopicsCaptured')}</Typography>
              ) : (
                <Stack spacing={1}>
                  {topics.map((topic) => (
                    <Card key={topic.id} variant="outlined">
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                          <Box>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{topic.title}</Typography>
                            {topic.due_date &&
                              <Chip
                                label={`${t('boardManagement.dueLabel')}: ${dayjs(topic.due_date).format('DD.MM.YYYY')} (KW ${dayjs(topic.due_date).isoWeek()})`}
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            }
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
        <DialogTitle>{t('boardManagement.removeMemberTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('boardManagement.removeMemberDesc')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, memberId: null })}>{t('boardManagement.cancelButton')}</Button>
          <Button color="error" variant="contained" onClick={confirmRemoveMember}>
            {t('boardManagement.removeButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}