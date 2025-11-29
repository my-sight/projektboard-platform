/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
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
import { isSuperuserEmail } from '@/constants/superuser';
import { ClientProfile, fetchClientProfiles } from '@/lib/clientProfiles';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  status: 'present' | 'absent' | string;
}

interface Topic {
  id: string;
  board_id: string;
  title: string;
  calendar_week: string | null;
  position: number;
}

interface TopicDraft {
  title: string;
  calendarWeek: string;
}

interface KanbanCardRow {
  id: string;
  card_id: string;
  card_data: Record<string, unknown>;
  project_number?: string | null;
  project_name?: string | null;
}

// ✅ UPDATE: Kategorien erweitert auf Y und R
interface EscalationRecord {
  id?: string;
  board_id: string;
  card_id: string;
  category: 'LK' | 'SK' | 'Y' | 'R';
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

interface EscalationHistoryEntry {
  id: string;
  board_id: string;
  card_id: string;
  escalation_id: string | null;
  changed_at: string;
  changed_by: string | null;
  changes?: Record<string, unknown> | null;
}

interface BoardManagementPanelProps {
  boardId: string;
  canEdit: boolean;
  memberCanSee: boolean;
}

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
  for (let cursor = new Date(firstDate); cursor.getTime() <= lastDate.getTime(); ) {
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
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  if (!supabase) {
    return (
      <Box sx={{ p: 3 }}>
        <SupabaseConfigNotice />
      </Box>
    );
  }

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
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

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
    return profiles.filter(profile => {
      if (isSuperuserEmail(profile.email)) {
        return false;
      }

      const isActive = profile.is_active ?? true;
      return isActive && !memberIds.has(profile.id);
    });
  }, [members, profiles]);

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

      if (!supabase) {
        setMessage('❌ Supabase-Client ist nicht konfiguriert.');
        setTimeout(() => setMessage(''), 4000);
        return false;
      }
      const profilePromise = fetchClientProfiles();

      const [
        departmentsResult,
        membersResult,
        topicsResult,
        escalationsResult,
        cardsResult,
        settingsResult,
        historyResult,
      ] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('board_members').select('*').eq('board_id', boardId).order('created_at'),
        supabase.from('board_top_topics').select('*').eq('board_id', boardId).order('position'),
        supabase.from('board_escalations').select('*').eq('board_id', boardId),
        supabase
          .from('kanban_cards')
          .select('id, card_id, card_data, project_number, project_name')
          .eq('board_id', boardId),
        supabase
          .from('kanban_board_settings')
          .select('settings')
          .eq('board_id', boardId)
          .maybeSingle(),
        supabase
          .from('board_escalation_history')
          .select('*')
          .eq('board_id', boardId)
          .order('changed_at', { ascending: false }),
      ]);

      const profileRows = (await profilePromise).filter(
        profile => !isSuperuserEmail(profile.email),
      );

      if (departmentsResult.error) throw new Error(departmentsResult.error.message);
      if (membersResult.error) throw new Error(membersResult.error.message);
      if (topicsResult.error) throw new Error(topicsResult.error.message);
      let escalationSchemaMissing = false;
      if (escalationsResult.error) {
        const message = escalationsResult.error.message;
        if (message && isMissingEscalationColumnError(message)) {
          escalationSchemaMissing = true;
        } else {
          throw new Error(message ?? 'Unbekannter Fehler beim Laden der Eskalationen');
        }
      }
      if (cardsResult.error) throw new Error(cardsResult.error.message);
      if (settingsResult.error && settingsResult.error.code !== 'PGRST116') {
        throw new Error(settingsResult.error.message);
      }
      let historyRows: EscalationHistoryEntry[] = [];
      if (historyResult.error) {
        const message = historyResult.error.message ?? '';
        if (message.toLowerCase().includes('board_escalation_history')) {
          setEscalationHistoryReady(false);
          setMessage(`⚠️ ${ESCALATION_HISTORY_HELP}`);
          setTimeout(() => setMessage(''), 10000);
        } else {
          throw new Error(historyResult.error.message);
        }
      } else {
        setEscalationHistoryReady(true);
        historyRows = (historyResult.data as EscalationHistoryEntry[] | null) ?? [];
      }

      const departmentRows = (departmentsResult.data as Department[]) ?? [];
      const memberRows = mergeMemberProfiles((membersResult.data as Member[]) ?? [], profileRows);
      const topicRows = (topicsResult.data as Topic[]) ?? [];
      const escalationRecords = escalationSchemaMissing
        ? []
        : ((escalationsResult.data as EscalationRecord[]) ?? []);
      const cardRows = (cardsResult.data as KanbanCardRow[]) ?? [];
      const escalationViews = buildEscalationViews(boardId, cardRows, escalationRecords);
      const settingsRow = (settingsResult.data as { settings?: unknown } | null) ?? null;
      const stageOrder = extractStageOrder(settingsRow?.settings);
      const baseStages = stageOrder.length ? stageOrder : DEFAULT_STAGE_NAMES;
      const stageCounts = cardRows.reduce((map, row) => {
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
      setDepartments(departmentRows);
      setMembers(memberRows);
      setTopics(topicRows);
      // Initialize topic drafts once using complete objects
      const topicDraftValues: Record<string, TopicDraft> = {};
      topicRows.forEach(topic => {
        topicDraftValues[topic.id] = {
          title: topic.title ?? '',
          calendarWeek: topic.calendar_week ?? '',
        };
      });
      setTopicDrafts(topicDraftValues);
      setEscalations(escalationViews);
      setEscalationSchemaReady(!escalationSchemaMissing);
      if (escalationSchemaMissing) {
        setMessage(`⚠️ ${ESCALATION_SCHEMA_HELP}`);
        setTimeout(() => setMessage(''), 10000);
      }
      const historyMap: Record<string, EscalationHistoryEntry[]> = {};
      historyRows.forEach(entry => {
        const list = historyMap[entry.card_id] ?? [];
        historyMap[entry.card_id] = [...list, entry];
      });
      setEscalationHistory(historyMap);
      setStageChartData(chartData);
      return true;
    } catch (error) {
      handleError(error, 'Fehler beim Laden der Board-Daten');
      return false;
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  }

  const loadAttendanceHistory = async () => {
    try {
      if (!supabase) {
        setMessage('❌ Supabase-Client ist nicht konfiguriert.');
        setTimeout(() => setMessage(''), 4000);
        return;
      }
      const { data, error } = await supabase
        .from('board_attendance')
        .select('*')
        .eq('board_id', boardId)
        .order('week_start', { ascending: false });

      if (error) throw new Error(error.message);

      const map: Record<string, Record<string, AttendanceRecord | undefined>> = {};
      (data as AttendanceRecord[] | null)?.forEach(entry => {
        const key = entry.week_start;
        if (!map[key]) {
          map[key] = {};
        }
        map[key][entry.profile_id] = entry;
      });

      setAttendanceByWeek(map);
      const ordered = expandWeekRange(Object.keys(map), selectedWeek);
      setOrderedWeeks(ordered);

      if (!ordered.includes(selectedWeek) && ordered.length > 0) {
        setSelectedWeek(ordered[ordered.length - 1]);
      }
    } catch (error) {
      handleError(error, 'Fehler beim Laden der Anwesenheit');
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
      const payload = members.map(member => ({
        board_id: boardId,
        profile_id: member.profile_id,
        week_start: selectedWeek,
        status: (attendanceDraft[member.profile_id] ?? true) ? 'present' : 'absent',
      }));

      const { error } = await supabase
        .from('board_attendance')
        .upsert(payload, { onConflict: 'board_id,profile_id,week_start' });

      if (error) throw new Error(error.message);

      await loadAttendanceHistory();
      setMessage('✅ Anwesenheit gespeichert');
      setTimeout(() => setMessage(''), 4000);
    } catch (error) {
      handleError(error, 'Fehler beim Speichern der Anwesenheit');
    } finally {
      setAttendanceSaving(false);
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
          calendar_week: null,
          position: topics.length,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (data) {
        const topic = data as Topic;
        setTopics(prev => [...prev, topic]);
        setTopicDrafts(prev => ({
          ...prev,
          [topic.id]: {
            title: topic.title ?? '',
            calendarWeek: topic.calendar_week ?? '',
          },
        }));
      }
    } catch (error) {
      handleError(error, 'Fehler beim Hinzufügen eines Top-Themas');
    }
  };

  const persistTopic = async (topicId: string) => {
    try {
      const draft = topicDrafts[topicId] ?? { title: '', calendarWeek: '' };
      const trimmedTitle = draft.title.trim();
      const weekValue = draft.calendarWeek.trim();
      const current = topics.find(topic => topic.id === topicId);
      const currentWeek = current?.calendar_week ?? '';
      // If nothing changed, update draft if needed and return
      if (current && current.title === trimmedTitle && currentWeek === weekValue) {
        if (draft.title !== trimmedTitle || draft.calendarWeek !== weekValue) {
          setTopicDrafts(prev => ({
            ...prev,
            [topicId]: { title: trimmedTitle, calendarWeek: weekValue },
          }));
        }
        return;
      }
      // Persist changes in database
      const { error } = await supabase
        .from('board_top_topics')
        .update({ title: trimmedTitle, calendar_week: weekValue || null })
        .eq('id', topicId);
      if (error) throw new Error(error.message);
      setTopics(prev =>
        prev.map(topic =>
          topic.id === topicId
            ? { ...topic, title: trimmedTitle, calendar_week: weekValue || null }
            : topic,
        ),
      );
      setTopicDrafts(prev => ({
        ...prev,
        [topicId]: { title: trimmedTitle, calendarWeek: weekValue },
      }));
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
      setTopicDrafts(prev => {
        const next = { ...prev };
        delete next[topicId];
        return next;
      });
    } catch (error) {
      handleError(error, 'Fehler beim Löschen des Top-Themas');
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

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(result => {
        setCurrentProfileId(result.data.user?.id ?? null);
      })
      .catch(() => {
        setCurrentProfileId(null);
      });
  }, [supabase]);

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

    if (window.confirm("Möchten Sie wirklich alle Felder dieser Eskalation leeren?")) {
      if (window.confirm("Sind Sie ganz sicher? Alle Eingaben (Grund, Maßnahme, Termine) werden entfernt.")) {
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
      setMessage('❌ Keine Berechtigung zum Bearbeiten von Eskalationen.');
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    if (!editingEscalation || !escalationDraft) return;
    if (!escalationSchemaReady) {
      setMessage(`❌ Eskalationen können erst gespeichert werden, nachdem ${ESCALATION_SCHEMA_HELP}`);
      setTimeout(() => setMessage(''), 10000);
      return;
    }

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

      const { data, error } = await supabase
        .from('board_escalations')
        .upsert(payload, { onConflict: 'board_id,card_id' })
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);

      setEscalations(prev =>
        prev.map(entry =>
          entry.card_id === currentEscalation.card_id
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
      const escalationId = (data as EscalationRecord | null)?.id ?? currentEscalation.id ?? null;

      if (escalationHistoryReady && currentProfileId && escalationId) {
        const { error: historyError } = await supabase
          .from('board_escalation_history')
          .insert({
            board_id: boardId,
            card_id: currentEscalation.card_id,
            escalation_id: escalationId,
            changed_by: currentProfileId,
            changes: payload,
          });
        if (historyError) {
          console.error('⚠️ Fehler beim Schreiben der Eskalationshistorie', historyError);
        }
      }

      closeEscalationEditor();
      const refreshed = await loadBaseData({ skipLoading: true });

      if (refreshed) {
        setMessage('✅ Eskalation gespeichert');
        setTimeout(() => setMessage(''), 4000);
      }
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
                  color={(member.profile?.is_active ?? true) ? 'primary' : 'default'}
                />
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ md: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h6">🗓️ Anwesenheit</Typography>
                <Typography variant="body2" color="text.secondary">
                  KW {isoWeekNumber(selectedWeekDate)} · {weekRangeLabel(selectedWeekDate)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <IconButton onClick={() => adjustWeek(-1)} aria-label="Vorherige Woche">
                  <ArrowBackIcon />
                </IconButton>
                <TextField
                  type="week"
                  label="Kalenderwoche"
                  size="small"
                  value={selectedWeekInputValue}
                  onChange={event => handleWeekInputChange(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180 }}
                />
                <IconButton onClick={() => adjustWeek(1)} aria-label="Nächste Woche">
                  <ArrowForwardIcon />
                </IconButton>
                <Button
                  variant="contained"
                  onClick={saveAttendance}
                  disabled={!canEdit || attendanceSaving || members.length === 0}
                >
                  Diese Woche speichern
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>Mitglied</TableCell>
                    <TableCell align="center" sx={{ minWidth: 160 }}>
                      <Stack spacing={0.5} alignItems="center">
                        <Typography variant="subtitle2">
                          KW {isoWeekNumber(selectedWeekDate)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {weekRangeLabel(selectedWeekDate)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    {historyWeeks.map(history => (
                      <TableCell key={history.week} align="center" sx={{ minWidth: 140 }}>
                        <Stack spacing={0.5} alignItems="center">
                          <Button
                            size="small"
                            variant={history.week === selectedWeek ? 'contained' : 'text'}
                            onClick={() => selectWeek(history.week)}
                          >
                            KW {isoWeekNumber(history.date)}
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
                    members.map(member => {
                      const profile = member.profile;
                      const label = profile?.full_name || profile?.email || 'Unbekannt';
                      const department = profile?.company;
                      const present = attendanceDraft[member.profile_id] ?? true;
                      return (
                        <TableRow key={member.id} hover>
                          <TableCell>
                            <Stack spacing={0.25}>
                              <Typography variant="subtitle2">{label}</Typography>
                              {department && (
                                <Typography variant="caption" color="text.secondary">
                                  {department}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={present ? 'Anwesend' : 'Abwesend'}>
                              <span>
                                <Checkbox
                                  checked={present}
                                  onChange={() => toggleAttendanceDraft(member.profile_id)}
                                  disabled={!canEdit || attendanceSaving}
                                  icon={<CloseIcon color="error" />}
                                  checkedIcon={<CheckIcon color="success" />}
                                  sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
                                />
                              </span>
                            </Tooltip>
                          </TableCell>
                          {historyWeeks.map(history => {
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
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="h6">⭐ Top-Themen</Typography>
              <Typography variant="body2" color="text.secondary">
                Halte die wichtigsten Themen fest (maximal fünf Einträge).
              </Typography>
            </Box>
            {canEdit && (
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
            {topics.map(topic => {
              const draft = topicDrafts[topic.id] ?? {
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
                    onChange={event =>
                      setTopicDrafts(prev => ({
                        ...prev,
                        [topic.id]: {
                          ...(prev[topic.id] ?? { title: '', calendarWeek: '' }),
                          title: event.target.value,
                        },
                      }))
                    }
                    onBlur={() => persistTopic(topic.id)}
                    fullWidth
                    disabled={!canEdit}
                  />
                  <TextField
                    type="week"
                    label="Kalenderwoche"
                    value={draft.calendarWeek}
                    onChange={event =>
                      setTopicDrafts(prev => ({
                        ...prev,
                        [topic.id]: {
                          ...(prev[topic.id] ?? { title: '', calendarWeek: '' }),
                          calendarWeek: event.target.value,
                        },
                      }))
                    }
                    onBlur={() => persistTopic(topic.id)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: { xs: '100%', md: 200 } }}
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <Button color="error" onClick={() => deleteTopic(topic.id)} startIcon={<DeleteIcon />}>★ Löschen</Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📈 Projekte pro Phase
          </Typography>
          {stageChartData.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Es liegen keine Projektdaten mit Phaseninformationen vor.
            </Typography>
          ) : (
            <Box sx={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={stageChartData} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" angle={-15} textAnchor="end" height={60} interval={0} />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(value: number | string) => [`${value} Projekte`, 'Anzahl']}
                  />
                  <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🚨 Projekte in Eskalation
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Es werden automatisch alle Karten angezeigt, die im Board als LK/Y oder SK/R markiert sind.
          </Typography>
          {!escalationSchemaReady && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {ESCALATION_SCHEMA_HELP}
            </Alert>
          )}
          <Divider sx={{ my: 2 }} />
          {/* ✅ UPDATE: Y und R statt LK/SK durchlaufen */}
          {(['Y', 'R'] as const).map(category => {
            const entries = filteredEscalations[category];
            const title = category === 'Y' ? 'Y Eskalationen' : 'R Eskalationen';
            return (
              <Box key={category} sx={{ mb: category === 'Y' ? 3 : 0 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {title}
                </Typography>
                {entries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {category === 'Y'
                      ? 'Keine Y Eskalationen vorhanden.'
                      : 'Keine R Eskalationen vorhanden.'}
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
                                disabled={!canEditEscalations || !escalationSchemaReady}
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
                          {(() => {
                            const historyEntries = escalationHistory[entry.card_id] ?? [];
                            if (!historyEntries.length) {
                              return null;
                            }
                            const profileLookup = new Map(profiles.map(profile => [profile.id, profile]));
                            return (
                              <Box sx={{ mt: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Historie
                                </Typography>
                                {/* --- ÄNDERUNG: Nur noch den neuesten Eintrag anzeigen --- */}
                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                  {historyEntries.slice(0, 1).map(history => {
                                    const author = profileLookup.get(history.changed_by ?? '') ?? null;
                                    const authorLabel = author
                                      ? author.full_name || author.email || 'Unbekannt'
                                      : 'Unbekannt';
                                    const changedAt = new Date(history.changed_at);
                                    return (
                                      <Typography key={history.id} variant="body2">
                                        {changedAt.toLocaleString('de-DE')} – {authorLabel}
                                      </Typography>
                                    );
                                  })}
                                  {historyEntries.length > 1 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                      ... und {historyEntries.length - 1} ältere Einträge (siehe Popup)
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                            );
                          })()}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
                {/* ✅ Trennlinie nach Y (ehemals LK) */}
                {category === 'Y' && <Divider sx={{ my: 2 }} />}
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
                disabled={!canEditEscalations}
              />
              <TextField
                label="Maßnahme"
                value={escalationDraft.measure}
                onChange={(event) => updateEscalationDraft({ measure: event.target.value })}
                fullWidth
                multiline
                minRows={3}
                disabled={!canEditEscalations}
              />
              <FormControl fullWidth size="small" disabled={!canEditEscalations}>
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
              <FormControl fullWidth size="small" disabled={!canEditEscalations}>
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
                disabled={!canEditEscalations}
                InputLabelProps={{ shrink: true }}
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Tooltip title="Fortschritt">
                  <Box>
                    <CompletionDial
                      steps={escalationDraft.completion_steps ?? 0}
                      onClick={cycleDraftCompletion}
                      disabled={!canEditEscalations}
                    />
                  </Box>
                </Tooltip>
                <Typography variant="body2">{escalationDraft.completion_steps ?? 0} / 4 Schritte</Typography>
              </Stack>
              {escalationHistoryReady && editingEscalation && (
                (() => {
                  const historyEntries = escalationHistory[editingEscalation.card_id] ?? [];
                  if (!historyEntries.length) return null;
                  const profileLookup = new Map(profiles.map(profile => [profile.id, profile]));
                  return (
                    <Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="subtitle2">Änderungshistorie</Typography>
                      <List dense>
                        {historyEntries.map(history => {
                          const author = profileLookup.get(history.changed_by ?? '') ?? null;
                          const authorLabel = author
                            ? author.full_name || author.email || 'Unbekannt'
                            : 'Unbekannt';
                          const changedAt = new Date(history.changed_at);
                          return (
                            <ListItem key={history.id} sx={{ py: 0 }}>
                              <Typography variant="body2">
                                {changedAt.toLocaleString('de-DE')} – {authorLabel}
                              </Typography>
                            </ListItem>
                          );
                        })}
                      </List>
                    </Box>
                  );
                })()
              )}
            </Stack>
          ) : (
            <Typography variant="body2">Keine Eskalation ausgewählt.</Typography>
          )}
        </DialogContent>
        
        {/* Button zum Leeren der Felder */}
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            color="warning" 
            onClick={handleClearEscalationFields} 
            disabled={!canEditEscalations}
          >
            🧹 Felder leeren
          </Button>
          
          <Box>
            <Button onClick={closeEscalationEditor} sx={{ mr: 1 }}>Abbrechen</Button>
            <Button onClick={saveEscalation} variant="contained" disabled={!canEditEscalations}>
              Speichern
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}