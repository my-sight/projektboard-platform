
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClientProfiles, ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  startOfWeek,
  isoDate,
  expandWeekRange,
  formatWeekInputValue,
  isoWeekNumber,
  weekRangeLabel
} from '@/utils/dateUtils';
import {
  AttendanceRecord,
  MemberWithProfile,
  TopicDraft,
  TopicRow,
  WeekHistoryItem
} from './management/types';
import { TeamAttendanceView } from './management/TeamAttendanceView';
import { TeamMembersView } from './management/TeamMembersView';
import { TeamTopicsView } from './management/TeamTopicsView';

interface TeamBoardManagementPanelProps {
  boardId: string;
  canEdit: boolean;
  memberCanSee: boolean;
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

  // sortedWeekEntries logic
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

  const loadBaseData = async (options: { skipLoading?: boolean } = {}) => {
    if (!options.skipLoading) setLoading(true);
    setMessage(null);
    try {
      const profileList = await fetchClientProfiles();
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

          if (profile && !isSuperuserEmail(profile.email) && (profile.is_active ?? true)) {
            return { id: row.id, profile_id: userId, profile };
          }
          if (!profile && userId) {
            // console.warn('Member profile not found for ID:', userId);
            return { id: row.id, profile_id: userId, profile: null };
          }
          return null;
        })
        .filter((entry): entry is MemberWithProfile => Boolean(entry));

      setMembers(mappedMembers);

      const attendanceMap: Record<string, Record<string, AttendanceRecord>> = {};
      (attendanceResult as any[]).forEach((row) => {
        const userId = row.user_id || row.profile_id;
        const dateStr = row.week_start.split('T')[0];
        const weekKey = isoDate(startOfWeek(new Date(dateStr)));
        if (!attendanceMap[weekKey]) {
          attendanceMap[weekKey] = {};
        }
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

      // Refresh draft for current week
      const currentWeekVal = selectedWeek || isoDate(startOfWeek(new Date()));
      const draft: Record<string, boolean> = {};
      mappedMembers.forEach((member) => {
        const existing = attendanceMap[currentWeekVal]?.[member.profile_id];
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
      // Preserve 'new' draft if exists
      if (topicDrafts['new']) {
        topicDraftValues['new'] = topicDrafts['new'];
      }
      setTopicDrafts(topicDraftValues);

    } catch (cause: any) {
      console.error('❌ Fehler beim Laden des Team-Managements', cause);
      const detail = cause?.response?.message || cause?.message || JSON.stringify(cause);
      setMessage(t('boardManagement.loadError') + ': ' + detail);
    } finally {
      if (!options.skipLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const availableProfiles = useMemo(() => {
    const selected = new Set(members.map((entry) => entry.profile_id));
    const filtered = profiles.filter((profile) => {
      if (selected.has(profile.id)) return false;
      if (!profile.is_active && profile.is_active !== undefined) return false;
      if (isSuperuserEmail(profile.email)) return false;
      return true;
    });

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
    if (Number.isNaN(parsed.getTime())) return;

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

  const handleWeekOffset = (offset: number) => {
    const next = new Date(selectedWeekDate);
    next.setDate(next.getDate() + offset * 7);
    const normalized = isoDate(startOfWeek(next));
    selectWeek(normalized);
  };

  const toggleAttendanceDraft = (profileId: string) => {
    setAttendanceDraft((prev) => ({ ...prev, [profileId]: !(prev[profileId] ?? true) }));
  };

  const saveAttendance = async () => {
    setAttendanceSaving(true);
    setMessage(null);
    const weekDate = startOfWeek(new Date(selectedWeek));
    const weekStartStr = isoDate(weekDate);

    try {
      const promises = members.map(async (member) => {
        const status = attendanceDraft[member.profile_id] === false ? 'absent' : 'present';
        const { data: saved, error } = await supabase.from('board_attendance').upsert({
          board_id: boardId,
          profile_id: member.profile_id,
          week_start: weekStartStr,
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
      setMessage(`✅ ${t('boardManagement.attendanceSaved')}`);
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
      setMessage('❌ ' + t('boardManagement.attendanceSaveError') + ': ' + cause.message);
    } finally {
      setAttendanceSaving(false);
    }
  };

  const addMember = async () => {
    if (!memberSelect) return;
    try {
      const { data, error } = await supabase.from('board_members').insert({
        board_id: boardId,
        profile_id: memberSelect
      }).select().single();

      if (error || !data) throw error;

      setMessage(`✅ ${t('boardManagement.memberAdded')}`);
      setTimeout(() => setMessage(null), 3000);
      setMemberSelect('');
      await loadBaseData({ skipLoading: true });
    } catch (cause: any) {
      console.error('❌ Fehler beim Hinzufügen eines Mitglieds', cause);
      setMessage('❌ ' + t('boardManagement.memberAddError') + ': ' + cause.message);
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

      setMessage(`✅ ${t('boardManagement.memberRemoved')}`);
      setTimeout(() => setMessage(null), 3000);
      await loadBaseData({ skipLoading: true });
    } catch (cause) {
      console.error('❌ Fehler beim Entfernen eines Mitglieds', cause);
      setMessage('❌ ' + t('boardManagement.memberRemoveError'));
    } finally {
      setDeleteDialog({ open: false, memberId: null });
    }
  };

  const updateTopicDraft = (key: string, updates: Partial<TopicDraft>) => {
    setTopicDrafts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates
      }
    }));
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

      setMessage(`✅ ${t('boardManagement.topicCreated')}`);
      setTimeout(() => setMessage(null), 3000);

      setTopicDrafts(prev => {
        const copy = { ...prev };
        delete copy['new'];
        return copy;
      });
      await loadBaseData({ skipLoading: true });
    } catch (cause) {
      console.error('❌ Fehler beim Hinzufügen eines Top-Themas', cause);
      setMessage('❌ ' + t('boardManagement.topicCreateError'));
    }
  };

  const deleteTopic = async (topicId: string) => {
    try {
      await supabase.from('board_top_topics').delete().eq('id', topicId);
      await loadBaseData({ skipLoading: true });
    } catch (cause) {
      console.error('❌ Fehler beim Löschen eines Top-Themas', cause);
      setMessage('❌ ' + t('boardManagement.topicDeleteError'));
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

      <TeamMembersView
        members={members}
        availableProfiles={availableProfiles}
        memberSelect={memberSelect}
        canEdit={canEdit}
        onMemberSelectChange={setMemberSelect}
        onAddMember={addMember}
        onRemoveMember={requestRemoveMember}
      />

      <TeamAttendanceView
        members={members}
        attendanceByWeek={attendanceByWeek}
        attendanceDraft={attendanceDraft}
        selectedWeek={selectedWeek}
        historyWeeks={historyWeeks}
        canEdit={canEdit}
        attendanceSaving={attendanceSaving}
        onSave={saveAttendance}
        onWeekChange={selectWeek}
        onWeekOffset={handleWeekOffset}
        onToggleDraft={toggleAttendanceDraft}
      />

      <TeamTopicsView
        topics={topics}
        topicDrafts={topicDrafts}
        canManageTopics={canManageTopics}
        onUpdateDraft={updateTopicDraft}
        onCreateTopic={addTopic}
        onDeleteTopic={deleteTopic}
      />

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