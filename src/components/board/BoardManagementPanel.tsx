/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { isSuperuserEmail } from '@/constants/superuser';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { ClientProfile, fetchClientProfiles } from '@/lib/clientProfiles';
import { EvaluationsView } from './management/EvaluationsView';
import { EscalationsView } from './management/EscalationsView';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.locale('de');
dayjs.extend(isoWeek);
import { useLanguage } from '@/contexts/LanguageContext';
import { AttendanceView } from './management/AttendanceView';
import { MembersView } from './management/MembersView';
import { TopicsView } from './management/TopicsView';
import { Department, Member, AttendanceRecord, Topic, TopicDraft, KanbanCardRow, EscalationRecord, EscalationView, EscalationDraft, EscalationHistoryEntry } from './management/types';
import {
  startOfWeek,
  isoDate,
  normalizeWeekValue,
  expandWeekRange,
  weekRangeLabel,
  isoWeekNumber,
  isoWeekYear,
  dateFromIsoWeek,
  formatWeekInputValue,
  parseWeekInputValue
} from '@/utils/dateUtils';



interface BoardManagementPanelProps {
  boardId: string;
  canEdit: boolean;
  memberCanSee: boolean;
}

// Helper functions declared previously...
// ... (startOfWeek, isoDate, etc. - keeping them unchanged if possible, or assumed present)
// Actually I need to keep them or the replace will cut them.
// I'll try to keep the top imports and interfaces replacement separate from the body if possible, or include helpers.
// Since the file is huge, I'll assume lines 43-440 cover imports to state init.
// I will include the helper functions in the replacement to be safe or be very precise with ranges.

// Since I am replacing lines 43 through 440, I need to include EVERYTHING in between.
// That includes constants, helpers, etc.

const ESCALATION_SCHEMA_DOC_PATH = 'docs/patch-board-escalations-card-id.sql';
const ESCALATION_SCHEMA_HELP =
  `Bitte führe das SQL-Skript ${ESCALATION_SCHEMA_DOC_PATH} aus, um die fehlende Spalte "card_id" in "board_escalations" anzulegen.`;
const ESCALATION_HISTORY_DOC_PATH = 'docs/board-escalation-history.sql';
const ESCALATION_HISTORY_HELP =
  `Bitte führe das SQL-Skript ${ESCALATION_HISTORY_DOC_PATH} aus, um die Historientabelle für Eskalationen anzulegen.`;

const isMissingEscalationColumnError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('board_escalations') && normalized.includes('card_id');
};

const DEFAULT_STAGE_NAMES = [
  'Werkzeug beim Werkzeugmacher',
  'Werkzeugtransport',
  'Werkzeug in Dillenburg',
  'Werkzeug in Polen',
  'Musterung',
  'Teileversand',
  'Teile vor Ort',
  'Fertig',
];

// Date helpers imported from @/utils/dateUtils


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

function extractStageOrder(settings: unknown): string[] {
  if (!settings || typeof settings !== 'object') {
    return [];
  }

  const maybeCols = (settings as { cols?: Array<{ name?: string }> }).cols;

  if (!Array.isArray(maybeCols)) {
    return [];
  }

  return Array.from(
    new Set(
      maybeCols
        .map(col => (col && typeof col === 'object' ? stringOrNull((col as any).name) : null))
        .filter((name): name is string => Boolean(name)),
    ),
  );
}

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

      // ✅ UPDATE: Akzeptiere LK, SK, Y und R
      if (category !== 'LK' && category !== 'SK' && category !== 'Y' && category !== 'R') {
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
        category: category as 'LK' | 'SK' | 'Y' | 'R',
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
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<(Member & { profile?: ClientProfile })[]>([]);
  const [memberSelect, setMemberSelect] = useState('');

  const [selectedWeek, setSelectedWeek] = useState<string>(() => isoDate(startOfWeek(new Date())));
  const [orderedWeeks, setOrderedWeeks] = useState<string[]>(() =>
    expandWeekRange([isoDate(startOfWeek(new Date()))]),
  );
  const [attendanceByWeek, setAttendanceByWeek] = useState<
    Record<string, Record<string, AttendanceRecord | undefined>>
  >({});
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, boolean>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [escalationHistory, setEscalationHistory] = useState<Record<string, EscalationHistoryEntry[]>>({});
  const [escalationHistoryReady, setEscalationHistoryReady] = useState(true);
  const { user } = useAuth();
  const currentProfileId = user?.id || null;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, TopicDraft>>({});
  const [escalations, setEscalations] = useState<EscalationView[]>([]);
  const [escalationSchemaReady, setEscalationSchemaReady] = useState(true);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [editingEscalation, setEditingEscalation] = useState<EscalationView | null>(null);
  const [escalationDraft, setEscalationDraft] = useState<EscalationDraft | null>(null);
  const [stageChartData, setStageChartData] = useState<{ stage: string; count: number }[]>([]);

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

  const availableProfiles = useMemo(() => {
    const memberIds = new Set(members.map(member => member.profile_id));
    const filtered = profiles.filter(profile => {
      if (isSuperuserEmail(profile.email)) {
        return false;
      }

      const isActive = profile.is_active ?? true;
      return isActive && !memberIds.has(profile.id);
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

  // ✅ UPDATE: Gruppierung - LK/Y in "Y" und SK/R in "R"
  const filteredEscalations = useMemo(
    () => ({
      Y: escalations.filter(entry => entry.category === 'LK' || entry.category === 'Y'),
      R: escalations.filter(entry => entry.category === 'SK' || entry.category === 'R'),
    }),
    [escalations],
  );

  const profileById = useMemo(() => {
    const map = new Map<string, ClientProfile>();
    profiles.forEach(profile => {
      map.set(profile.id, profile);
    });
    return map;
  }, [profiles]);

  const toggleAttendanceDraft = (profileId: string) => {
    setAttendanceDraft(prev => ({ ...prev, [profileId]: !(prev[profileId] ?? true) }));
  };

  const selectWeek = (week: string) => {
    if (!week) return;

    const parsed = new Date(`${week}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const normalized = isoDate(startOfWeek(parsed));
    setSelectedWeek(normalized);
    setOrderedWeeks(prev => expandWeekRange([...prev, normalized], normalized));
  };

  const handleWeekInputChange = (value: string) => {
    const parsed = parseWeekInputValue(value);

    if (parsed) {
      setSelectedWeek(parsed);
      setOrderedWeeks(prev => expandWeekRange([...prev, parsed], parsed));
    }
  };

  useEffect(() => {
    const records = attendanceByWeek[selectedWeek] ?? {};
    const draft: Record<string, boolean> = {};
    members.forEach(member => {
      const record = records[member.profile_id];
      draft[member.profile_id] = record?.status !== 'absent';
    });
    setAttendanceDraft(draft);
  }, [attendanceByWeek, members, selectedWeek]);

  const handleError = (error: unknown, fallback: string) => {
    console.error(fallback, error);
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingEscalationColumnError(message)) {
      setEscalationSchemaReady(false);
      setMessage(`❌ ${fallback}: ${ESCALATION_SCHEMA_HELP}`);
      setTimeout(() => setMessage(''), 10000);
      return;
    }

    setMessage(`❌ ${fallback}: ${message}`);
    setTimeout(() => setMessage(''), 4000);
  };

  async function loadBaseData(options?: { skipLoading?: boolean }): Promise<boolean> {
    const skipLoading = options?.skipLoading ?? false;
    try {
      if (!skipLoading) {
        setLoading(true);
      }

      const profilePromise = fetchClientProfiles();

      const [
        departmentsResult,
        membersResult,
        topicsResult,
        escalationsResult,
        cardsResult,
        boardResult,
        historyResult,
      ] = await Promise.all([
        (async () => (await supabase.from('departments').select('*')).data || [])(),
        (async () => (await supabase.from('board_members').select('*').eq('board_id', boardId)).data || [])(),
        (async () => (await supabase.from('board_top_topics').select('*').eq('board_id', boardId)).data || [])(),
        (async () => (await supabase.from('board_escalations').select('*').eq('board_id', boardId)).data || [])(),
        // kanban_cards: in PB we filtered by board_id. 
        // Supabase 'kanban_cards' table has 'board_id'.
        (async () => (await supabase.from('kanban_cards').select('*').eq('board_id', boardId)).data || [])(),
        (async () => (await supabase.from('kanban_boards').select('*').eq('id', boardId).single()).data)(),
        (async () => (await supabase.from('board_escalation_history').select('*').eq('board_id', boardId)).data || [])(),
      ]);

      // Client-side sorting
      const sortCreated = (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime();
      const sortPosition = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);
      const sortChangedAtDesc = (a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime();
      const sortName = (a: any, b: any) => (a.name || '').localeCompare(b.name || '');

      departmentsResult.sort(sortName);
      membersResult.sort(sortCreated);
      topicsResult.sort(sortPosition);
      historyResult.sort(sortChangedAtDesc);

      const profileRows = (await profilePromise).filter(
        profile => !isSuperuserEmail(profile.email),
      );

      const departmentRows = departmentsResult.map(d => ({ id: d.id, name: d.name }));
      const memberRows = mergeMemberProfiles(membersResult.map(m => ({ id: m.id, profile_id: m.profile_id })), profileRows);

      const topicRows = topicsResult.map(t => ({ id: t.id, board_id: t.board_id, title: t.title, due_date: t.due_date, position: t.position }));

      const escalationRecords = escalationsResult.map(e => ({
        id: e.id,
        board_id: e.board_id,
        card_id: e.card_id,
        category: e.category,
        project_code: e.project_code,
        project_name: e.project_name,
        reason: e.reason,
        measure: e.measure,
        department_id: e.department_id,
        responsible_id: e.responsible_id,
        target_date: e.target_date,
        completion_steps: e.completion_steps
      })) as EscalationRecord[];

      const cardRows = cardsResult.map(c => ({
        id: c.id,
        card_id: c.column_id ? c.id : c.id, // NOTE: PB might not store 'card_id' separately like Supabase did? 
        // Wait, 'card_id' in Supabase usually referred to the ID of the card.
        // In PB, id is the ID.
        // BUT, buildEscalationViews uses c.card_id to map to escalation.card_id.
        // I should ensure kanban_cards in PB has 'card_data'.
        // The setup script says: { name: 'card_data', type: 'json' }, { name: 'column_id', ... }
        // So 'id' is the unique ID.
        // Let's assume c.id is what we want.
        card_data: c.card_data,
        project_number: c.card_data?.Nummer, // Fallback if not explicit column
        project_name: c.card_data?.Teil
      })) as KanbanCardRow[];

      // Fix assumption: 'card_id' in KanbanCardRow should probably be 'id' from DB
      // Supabase query was: select('id, card_id, card_data, ...')
      // If card_id is expected to be a separate field, PB might not have it unless I added it.
      // But standard kanban cards usually use 'id'.
      // I'll map id to card_id for compatibility.
      const compatibleCardRows = cardsResult.map(c => ({
        id: c.id,
        card_id: c.id, // Use DB ID
        card_data: c.card_data,
        project_number: c.card_data?.Nummer,
        project_name: c.card_data?.Teil,
        board_id: c.board_id
      })) as KanbanCardRow[];

      const escalationViews = buildEscalationViews(boardId, compatibleCardRows, escalationRecords);
      const settingsRow = boardResult;
      const stageOrder = extractStageOrder(settingsRow?.settings);
      const baseStages = stageOrder.length ? stageOrder : DEFAULT_STAGE_NAMES;
      const stageCounts = compatibleCardRows.reduce((map, row) => {
        const raw = (row.card_data ?? {}) as Record<string, unknown>;
        const stage =
          stringOrNull(raw['Board Stage']) ??
          stringOrNull(raw['stage'] as string | undefined) ??
          'Unbekannt';
        map.set(stage, (map.get(stage) ?? 0) + 1);
        return map;
      }, new Map<string, number>());
      baseStages.forEach(stage => {
        if (!stageCounts.has(stage)) {
          stageCounts.set(stage, 0);
        }
      });
      const additionalStages = Array.from(stageCounts.keys()).filter(
        stage => !baseStages.includes(stage),
      );
      const stageList = [
        ...baseStages,
        ...additionalStages.sort((a, b) =>
          a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }),
        ),
      ];
      const chartData = stageList.map(stage => ({ stage, count: stageCounts.get(stage) ?? 0 }));

      setProfiles(profileRows);
      setDepartments(departmentRows as Department[]);
      setMembers(memberRows);
      setTopics(topicRows);
      // Initialize topic drafts once using complete objects
      const topicDraftValues: Record<string, TopicDraft> = {};
      topicRows.forEach(topic => {
        topicDraftValues[topic.id] = {
          title: topic.title ?? '',
          dueDate: topic.due_date ?? '',
        };
      });
      setTopicDrafts(topicDraftValues);
      setEscalations(escalationViews);
      setEscalationSchemaReady(true); // Always true with PB

      const historyRows = historyResult.map(h => ({
        id: h.id,
        board_id: h.board_id,
        card_id: h.card_id,
        escalation_id: h.escalation_id,
        changed_at: h.changed_at,
        changed_by: h.changed_by,
        changes: h.changes
      })) as EscalationHistoryEntry[];

      const historyMap: Record<string, EscalationHistoryEntry[]> = {};
      historyRows.forEach(entry => {
        const list = historyMap[entry.card_id] ?? [];
        historyMap[entry.card_id] = [...list, entry];
      });
      setEscalationHistory(historyMap);
      setEscalationHistoryReady(true);
      setStageChartData(chartData);
      return true;
    } catch (error) {
      handleError(error, t('boardManagement.loadBoardError'));
      return false;
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  }

  const loadAttendanceHistory = async () => {
    try {
      const { data: rawData } = await supabase.from('board_attendance').select('*').eq('board_id', boardId);
      const data = rawData || [];

      // Sort client-side
      data.sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());

      console.log('UseEffect Load Attendance', data.length);
      const map: Record<string, Record<string, AttendanceRecord | undefined>> = {};
      data.forEach(entry => {
        // PB date strings can be "YYYY-MM-DD HH:mm:ss.SSSZ" or "YYYY-MM-DD"
        // Robust way: Parse to Date, then to ISO string
        // Consistent date key generation
        let weekKey = '';
        try {
          // If it's a date string 'YYYY-MM-DD', just use it? 
          // Best to normalize using our isoDate helper to match selectedWeek
          // entry.week_start is from DB (date or timestamptz)
          const d = new Date(entry.week_start || entry.date || new Date());
          weekKey = isoDate(d);
        } catch (e) {
          weekKey = isoDate(new Date());
        }

        if (!map[weekKey]) {
          map[weekKey] = {};
        }

        const userId = entry.profile_id || entry.user_id; // Fix: Support profile_id

        if (userId) {
          map[weekKey][userId] = {
            id: entry.id,
            board_id: entry.board_id,
            profile_id: userId,
            week_start: entry.week_start,
            status: entry.status
          } as AttendanceRecord;
        } else {
          console.warn('Entry missing profile_id/user_id:', entry);
        }
      });
      console.log('Attendance Map Keys:', Object.keys(map));
      setAttendanceByWeek(map);
      const ordered = expandWeekRange(Object.keys(map), selectedWeek);
      setOrderedWeeks(ordered);

      if (!ordered.includes(selectedWeek) && ordered.length > 0) {
        setSelectedWeek(ordered[ordered.length - 1]);
      }
    } catch (error) {
      handleError(error, t('boardManagement.loadAttendanceError'));
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [boardId]);

  useEffect(() => {
    loadAttendanceHistory();
  }, [boardId]);

  const adjustWeek = (offset: number) => {
    if (!offset) return;

    const next = new Date(selectedWeekDate);
    next.setDate(next.getDate() + offset * 7);
    const normalized = isoDate(startOfWeek(next));
    setSelectedWeek(normalized);
    setOrderedWeeks(prev => expandWeekRange([...prev, normalized], normalized));
  };

  const saveAttendance = async () => {
    if (!canEdit || members.length === 0) {
      return;
    }

    try {
      setAttendanceSaving(true);
      const weekKey = selectedWeek.split('T')[0];

      // Prepare updates
      const promises = members.map(async (member) => {
        const present = attendanceDraft[member.profile_id] ?? true;
        const status = present ? 'present' : 'absent';

        // Use upsert for robustness
        const payload = {
          board_id: boardId,
          profile_id: member.profile_id,
          week_start: isoDate(new Date(selectedWeek)),
          status
        };
        console.log('DEBUG: Upserting Attendance:', payload);

        const { error } = await supabase.from('board_attendance').upsert(payload, { onConflict: 'board_id,profile_id,week_start' });

        if (error) {
          console.error('Attendance save error', error);
          throw error;
        }
      });

      await Promise.all(promises);

      setMessage(t('boardManagement.attendanceSaved'));
      setTimeout(() => setMessage(''), 4000);
      await loadAttendanceHistory();
    } catch (error) {
      handleError(error, t('boardManagement.saveAttendanceError'));
    } finally {
      setAttendanceSaving(false);
    }
  };

  const addMember = async () => {
    if (!memberSelect || !canEdit) return;

    try {
      if (members.some(m => m.profile_id === memberSelect)) {
        return;
      }

      const { error } = await supabase.from('board_members').insert({
        board_id: boardId,
        profile_id: memberSelect
      });

      if (error) {
        throw error;
      }

      setMemberSelect('');
      await loadBaseData({ skipLoading: true });
    } catch (error) {
      console.error(error);
      handleError(error, t('boardManagement.addMemberError'));
    }
  };

  const removeMember = async (id: string) => {
    if (!canEdit) return;
    try {
      await supabase.from('board_members').delete().eq('id', id);
      await loadBaseData({ skipLoading: true });
    } catch (error) {
      handleError(error, t('boardManagement.removeMemberError'));
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

  const createTopic = async () => {
    const draft = topicDrafts['new'];
    if (!draft?.title.trim()) return;

    try {
      const { data, error } = await supabase.from('board_top_topics').insert({
        board_id: boardId,
        title: draft.title,
        due_date: draft.dueDate || null,
        position: topics.length
      }).select().single();

      if (error || !data) throw error;

      setTopics(prev => [...prev, data as unknown as Topic]);
      setTopicDrafts(prev => {
        const copy = { ...prev };
        delete copy['new'];
        return copy;
      });
      setMessage(t('boardManagement.topicCreated'));
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      console.error(e);
      setMessage(t('boardManagement.topicCreateError'));
    }
  };

  const deleteTopic = async (id: string) => {
    if (!canEdit) return;
    try {
      await supabase.from('board_top_topics').delete().eq('id', id);
      setTopics(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      handleError(error, t('boardManagement.deleteTopicError'));
    }
  };

  const departmentName = (departmentId: string | null) =>
    departments.find(entry => entry.id === departmentId)?.name ?? '';

  const responsibleOptions = (departmentId: string | null) => {
    const name = departmentName(departmentId);
    return profiles.filter(profile => {
      if (isSuperuserEmail(profile.email)) {
        return false;
      }

      const matchesDepartment = name ? profile.company === name : true;
      const isActive = profile.is_active ?? true;
      return matchesDepartment && isActive;
    });
  };

  const canEditEscalations = memberCanSee;

  /* useEffect(() => {
    // Auth subscription not strictly needed here with useAuth
  }, []); */

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

  const handleClearEscalationFields = () => {
    if (!canEditEscalations) return;

    if (window.confirm(t('boardManagement.clearPrompt'))) {
      if (window.confirm(t('boardManagement.clearConfirm'))) {
        updateEscalationDraft({
          reason: '',
          measure: '',
          department_id: null,
          responsible_id: null,
          target_date: null,
          completion_steps: 0
        });
      }
    }
  };

  const saveEscalation = async () => {
    if (!canEditEscalations) {
      setMessage(t('boardManagement.noEditPermission'));
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    if (!editingEscalation || !escalationDraft) return;

    try {
      const currentEscalation = editingEscalation;

      const payload = {
        board_id: boardId,
        card_id: currentEscalation.card_id,
        category: currentEscalation.category,
        project_code: currentEscalation.project_code,
        project_name: currentEscalation.project_name,
        reason: stringOrNull(escalationDraft.reason),
        measure: stringOrNull(escalationDraft.measure),
        department_id: escalationDraft.department_id,
        responsible_id: escalationDraft.responsible_id,
        target_date: escalationDraft.target_date,
        completion_steps: Math.max(0, Math.min(4, escalationDraft.completion_steps ?? 0)),
      };

      let escalationId = currentEscalation.id;
      let resultRecord: EscalationRecord;

      if (escalationId) {
        const { data, error } = await supabase.from('board_escalations')
          .update(payload)
          .eq('id', escalationId)
          .select().single();
        if (error || !data) throw error;
        resultRecord = data as EscalationRecord;
      } else {
        // Upsert by card_id + board_id
        // Supabase upsert requires a unique constraint. If not present, we can do check-then-insert/update.
        // Let's do manual check to be safe as per PB logic.
        const { data: existing } = await supabase.from('board_escalations')
          .select('id')
          .eq('board_id', boardId)
          .eq('card_id', currentEscalation.card_id)
          .single();

        if (existing) {
          escalationId = existing.id;
          const { data, error } = await supabase.from('board_escalations')
            .update(payload)
            .eq('id', escalationId)
            .select().single();
          if (error || !data) throw error;
          resultRecord = data as EscalationRecord;
        } else {
          const { data, error } = await supabase.from('board_escalations')
            .insert(payload)
            .select().single();
          if (error || !data) throw error;
          resultRecord = data as EscalationRecord;
        }
      }
      setEscalations(prev =>
        prev.map(entry =>
          entry.card_id === currentEscalation.card_id
            ? {
              ...entry,
              id: resultRecord.id, // Ensure we have the ID
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

      if (escalationHistoryReady && currentProfileId && resultRecord.id) {
        try {
          await supabase.from('board_escalation_history').insert({
            board_id: boardId,
            card_id: currentEscalation.card_id,
            escalation_id: resultRecord.id,
            changed_by: currentProfileId,
            changes: payload,
            changed_at: new Date().toISOString()
          });
        } catch (historyError) {
          console.error('⚠️ Fehler beim Schreiben der Eskalationshistorie', historyError);
        }
      }

      closeEscalationEditor();
      const refreshed = await loadBaseData({ skipLoading: true });

      if (refreshed) {
        setMessage(t('boardManagement.escalationSaved'));
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (error) {
      handleError(error, t('boardManagement.saveEscalationError'));
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
          <Typography>{t('boardManagement.noPermission')}</Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="body1">{t('boardManagement.loading')}</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 6 }}>
      {message && <Alert severity={message.startsWith('❌') ? 'error' : 'success'}>{message}</Alert>}

      <MembersView
        members={members}
        availableProfiles={availableProfiles}
        memberSelect={memberSelect}
        onMemberSelectChange={setMemberSelect}
        onAddMember={addMember}
        onRemoveMember={removeMember}
        canEdit={canEdit}
      />

      <AttendanceView
        members={members}
        attendanceByWeek={attendanceByWeek}
        selectedWeek={selectedWeek}
        selectedWeekDate={selectedWeekDate}
        historyWeeks={historyWeeks}
        canEdit={canEdit}
        attendanceDraft={attendanceDraft}
        attendanceSaving={attendanceSaving}
        onSave={saveAttendance}
        onWeekChange={selectWeek}
        onWeekOffset={adjustWeek}
        onWeekInputChange={handleWeekInputChange}
        onToggleDraft={toggleAttendanceDraft}
      />

      <TopicsView
        topics={topics}
        topicDrafts={topicDrafts}
        onUpdateDraft={updateTopicDraft}
        onCreateTopic={createTopic}
        onDeleteTopic={deleteTopic}
        canEdit={canEdit}
      />

      <EvaluationsView stageChartData={stageChartData} />

      <EscalationsView
        filteredEscalations={filteredEscalations}
        profiles={profiles}
        departments={departments}
        escalationHistory={escalationHistory}
        canEdit={canEdit}
        schemaReady={escalationSchemaReady}
        schemaHelpText={ESCALATION_SCHEMA_HELP}
        dialogOpen={escalationDialogOpen}
        editingEscalation={editingEscalation}
        draft={escalationDraft}
        onOpenEditor={openEscalationEditor}
        onCloseEditor={closeEscalationEditor}
        onUpdateDraft={updateEscalationDraft}
        onSave={saveEscalation}
        onClearFields={handleClearEscalationFields}
        onCycleCompletion={cycleDraftCompletion}
      />
    </Stack>
  );
}