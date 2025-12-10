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
import { pb } from '@/lib/pocketbase';
import { ClientProfile, fetchClientProfiles } from '@/lib/clientProfiles';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import { useLanguage } from '@/contexts/LanguageContext';

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
  due_date: string | null;
  position: number;
}

interface TopicDraft {
  title: string;
  dueDate: string;
}

interface KanbanCardRow {
  id: string;
  card_id: string;
  card_data: Record<string, unknown>;
  project_number?: string | null;
  project_name?: string | null;
  board_id?: string;
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
        pb.collection('departments').getFullList({ sort: 'name' }),
        pb.collection('board_members').getFullList({ filter: `board_id="${boardId}"`, sort: 'created' }),
        pb.collection('board_top_topics').getFullList({ filter: `board_id="${boardId}"`, sort: 'position' }),
        pb.collection('board_escalations').getFullList({ filter: `board_id="${boardId}"` }),
        pb.collection('kanban_cards').getFullList({ filter: `board_id="${boardId}"` }),
        pb.collection('kanban_boards').getOne(boardId),
        pb.collection('board_escalation_history').getFullList({ filter: `board_id="${boardId}"`, sort: '-changed_at' }),
      ]);

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
      const data = await pb.collection('board_attendance').getFullList({
        filter: `board_id="${boardId}"`,
        sort: '-week_start'
      });

      const map: Record<string, Record<string, AttendanceRecord | undefined>> = {};
      data.forEach(entry => {
        // PB date strings
        const weekKey = entry.week_start.split('T')[0]; // Simplify date handling
        if (!map[weekKey]) {
          map[weekKey] = {};
        }
        map[weekKey][entry.profile_id] = {
          id: entry.id,
          board_id: entry.board_id,
          profile_id: entry.profile_id,
          week_start: entry.week_start,
          status: entry.status
        } as AttendanceRecord;
      });

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
        const existing = attendanceByWeek[weekKey]?.[member.profile_id];

        if (existing) {
          // Update if changed
          if (existing.status !== status) {
            await pb.collection('board_attendance').update(existing.id, { status });
          }
        } else {
          // Create if not present (only if absent? No, record presence too)
          // Actually logic usually is: if present is default, maybe we don't store?
          // But here we urge to store 'present' or 'absent'.
          // Code shows we store it.
          await pb.collection('board_attendance').create({
            board_id: boardId,
            profile_id: member.profile_id,
            week_start: selectedWeek,
            status
          });
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

      await pb.collection('board_members').create({
        board_id: boardId,
        profile_id: memberSelect
      });

      setMemberSelect('');
      await loadBaseData({ skipLoading: true });
    } catch (error) {
      handleError(error, t('boardManagement.addMemberError'));
    }
  };

  const removeMember = async (id: string) => {
    if (!canEdit) return;
    try {
      await pb.collection('board_members').delete(id);
      await loadBaseData({ skipLoading: true });
    } catch (error) {
      handleError(error, t('boardManagement.removeMemberError'));
    }
  };



  const deleteTopic = async (id: string) => {
    if (!canEdit) return;
    try {
      await pb.collection('board_top_topics').delete(id);
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

  useEffect(() => {
    setCurrentProfileId(pb.authStore.model?.id ?? null);
    // No subscription needed for auth state in this panel usually, but if needed:
    // return pb.authStore.onChange(...)
  }, []);

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
        resultRecord = await pb.collection('board_escalations').update(escalationId, payload) as EscalationRecord;
      } else {
        // Check if exists by card_id (simulating upsert)
        try {
          const existing = await pb.collection('board_escalations').getFirstListItem(`board_id="${boardId}" && card_id="${currentEscalation.card_id}"`);
          escalationId = existing.id;
          resultRecord = await pb.collection('board_escalations').update(escalationId, payload) as EscalationRecord;
        } catch {
          // Create new
          resultRecord = await pb.collection('board_escalations').create(payload) as EscalationRecord;
          escalationId = resultRecord.id;
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

      if (escalationHistoryReady && currentProfileId && escalationId) {
        try {
          await pb.collection('board_escalation_history').create({
            board_id: boardId,
            card_id: currentEscalation.card_id,
            escalation_id: escalationId,
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

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
            <Box>
              <Typography variant="h6">👥 {t('boardManagement.boardMembers')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('boardManagement.boardMembersDesc')}
              </Typography>
            </Box>
            {canEdit && (
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>{t('boardManagement.addMember')}</InputLabel>
                  <Select
                    label={t('boardManagement.addMember')}
                    value={memberSelect}
                    onChange={(event) => setMemberSelect(event.target.value)}
                  >
                    <MenuItem value="">
                      <em>{t('boardManagement.select')}</em>
                    </MenuItem>
                    {availableProfiles.map(profile => (
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
                  onClick={addMember}
                  disabled={!memberSelect}
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
            {members.map(member => {
              const label = member.profile?.full_name || member.profile?.email || 'Unbekannt';
              const detail = member.profile?.company ? ` (${member.profile.company})` : '';
              const deletable = canEdit && !isSuperuserEmail(member.profile?.email ?? null);
              return (
                <Chip
                  key={member.id}
                  label={`${label}${detail}`}
                  variant="outlined"
                  onDelete={deletable ? () => removeMember(member.id) : undefined}
                  sx={{ mr: 1, mb: 1 }}
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
                <Typography variant="h6">🗓️ {t('boardManagement.attendance')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('boardManagement.calendarWeek')} {isoWeekNumber(selectedWeekDate)} · {weekRangeLabel(selectedWeekDate)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <IconButton onClick={() => adjustWeek(-1)} aria-label="Vorherige Woche">
                  <ArrowBackIcon />
                </IconButton>
                <TextField
                  type="week"
                  label={t('boardManagement.calendarWeek')}
                  size="small"
                  value={selectedWeekInputValue}
                  onChange={event => handleWeekInputChange(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180 }}
                />
                <IconButton onClick={() => adjustWeek(1)} aria-label="Nächste Woche">
                  <ArrowForwardIcon />
                </IconButton>
                {canEdit && (
                  <Button
                    variant="contained"
                    onClick={saveAttendance}
                    disabled={attendanceSaving || members.length === 0}
                    sx={{ ml: 1 }}
                  >
                    {t('boardManagement.saveButton') || 'Speichern'}
                  </Button>
                )}
              </Stack>
            </Stack>

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>{t('boardManagement.member')}</TableCell>
                    <TableCell align="center" sx={{ minWidth: 160 }}>
                      <Stack spacing={0.5} alignItems="center">
                        <Typography variant="subtitle2">
                          {t('boardManagement.calendarWeek')} {isoWeekNumber(selectedWeekDate)}
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
                            {t('boardManagement.calendarWeek')} {isoWeekNumber(history.date)}
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
                            <Tooltip title={present ? t('boardManagement.present') : t('boardManagement.absent')}>
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
            {canEdit && topics.length < 5 && (
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
                      onClick={async () => {
                        const draft = topicDrafts['new'];
                        if (!draft?.title.trim()) return;

                        try {
                          const data = await pb.collection('board_top_topics').create({
                            board_id: boardId,
                            title: draft.title,
                            due_date: draft.dueDate || null,
                            position: topics.length
                          });

                          setTopics(prev => [...prev, data as unknown as Topic]); // data has matching struct
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
                      }}
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
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                          <Box>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{topic.title}</Typography>
                            {topic.due_date && (
                              <Chip
                                label={`${t('boardManagement.dueLabel')}: ${dayjs(topic.due_date).format('DD.MM.YYYY')} (KW ${dayjs(topic.due_date).isoWeek()})`}
                                size="small"
                                color={dayjs(topic.due_date).isBefore(dayjs(), 'day') ? 'error' : (dayjs(topic.due_date).isSame(dayjs(), 'day') || dayjs(topic.due_date).isSame(dayjs().add(1, 'day'), 'day') ? 'warning' : 'default')}
                                variant={dayjs(topic.due_date).isBefore(dayjs(), 'day') || dayjs(topic.due_date).isSame(dayjs(), 'day') || dayjs(topic.due_date).isSame(dayjs().add(1, 'day'), 'day') ? 'filled' : 'outlined'}
                                sx={{ mt: 1, height: 20, fontSize: '0.75rem' }}
                              />
                            )}
                          </Box>
                          {canEdit && (
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
      </Card >

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📈 {t('boardManagement.projectsPerPhase')}
          </Typography>
          {stageChartData.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('boardManagement.noProjectData')}
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
            🚨 {t('boardManagement.escalationsTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('boardManagement.escalationsDesc')}
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
            const title = category === 'Y' ? t('boardManagement.yEscalations') : t('boardManagement.rEscalations');
            return (
              <Box key={category} sx={{ mb: category === 'Y' ? 3 : 0 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {title}
                </Typography>
                {entries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {category === 'Y'
                      ? t('boardManagement.noYEscalations')
                      : t('boardManagement.noREscalations')}
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
                                  {t('boardManagement.phase')}: {entry.stage}
                                </Typography>
                              )}
                            </Box>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Tooltip title={t('boardManagement.progressTooltip')}>
                                <Box>
                                  <CompletionDial steps={entry.completion_steps ?? 0} onClick={() => { }} disabled />
                                </Box>
                              </Tooltip>
                              <Button
                                variant="outlined"
                                onClick={() => openEscalationEditor(entry)}
                                disabled={!canEditEscalations || !escalationSchemaReady}
                              >
                                {t('boardManagement.edit')}
                              </Button>
                            </Stack>
                          </Stack>
                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">
                                {t('boardManagement.reason')}
                              </Typography>
                              <Typography variant="body2">
                                {entry.reason || t('boardManagement.noReason')}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">
                                {t('boardManagement.measure')}
                              </Typography>
                              <Typography variant="body2">
                                {entry.measure || t('boardManagement.noMeasure')}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography variant="caption" color="text.secondary">
                                {t('boardManagement.department')}
                              </Typography>
                              <Typography variant="body2">
                                {department || t('boardManagement.noDepartment')}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography variant="caption" color="text.secondary">
                                {t('boardManagement.responsibility')}
                              </Typography>
                              <Typography variant="body2">
                                {responsible
                                  ? `${responsible.full_name || responsible.email}${responsible.company ? ` • ${responsible.company}` : ''}`
                                  : t('boardManagement.noResponsibility')}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Typography variant="caption" color="text.secondary">
                                {t('boardManagement.targetDate')}
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
                                  {t('boardManagement.history')}
                                </Typography>
                                {/* --- ÄNDERUNG: Nur noch den neuesten Eintrag anzeigen --- */}
                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                  {historyEntries.slice(0, 1).map(history => {
                                    const author = profileLookup.get(history.changed_by ?? '') ?? null;
                                    const authorLabel = author
                                      ? author.full_name || author.email || 'Unbekannt'
                                      : t('boardManagement.unknown');
                                    const changedAt = new Date(history.changed_at);
                                    return (
                                      <Typography key={history.id} variant="body2">
                                        {changedAt.toLocaleString('de-DE')} – {authorLabel}
                                      </Typography>
                                    );
                                  })}
                                  {historyEntries.length > 1 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                      {t('boardManagement.olderEntries').replace('{n}', String(historyEntries.length - 1))}
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
          {t('boardManagement.editEscalation')}
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
                label={t('boardManagement.reason')}
                value={escalationDraft.reason}
                onChange={(event) => updateEscalationDraft({ reason: event.target.value })}
                fullWidth
                multiline
                minRows={3}
                disabled={!canEditEscalations}
              />
              <TextField
                label={t('boardManagement.measure')}
                value={escalationDraft.measure}
                onChange={(event) => updateEscalationDraft({ measure: event.target.value })}
                fullWidth
                multiline
                minRows={3}
                disabled={!canEditEscalations}
              />
              <FormControl fullWidth size="small" disabled={!canEditEscalations}>
                <InputLabel>{t('boardManagement.department')}</InputLabel>
                <Select
                  value={escalationDraft.department_id ?? ''}
                  label={t('boardManagement.department')}
                  onChange={(event) =>
                    updateEscalationDraft({
                      department_id: event.target.value ? String(event.target.value) : null,
                      responsible_id: null,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>{t('boardManagement.none')}</em>
                  </MenuItem>
                  {departments.map(department => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" disabled={!canEditEscalations}>
                <InputLabel>{t('boardManagement.responsibility')}</InputLabel>
                <Select
                  value={escalationDraft.responsible_id ?? ''}
                  label={t('boardManagement.responsibility')}
                  onChange={(event) =>
                    updateEscalationDraft({
                      responsible_id: event.target.value ? String(event.target.value) : null,
                    })
                  }
                >
                  <MenuItem value="">
                    <em>{t('boardManagement.none')}</em>
                  </MenuItem>
                  {responsibleOptions(escalationDraft.department_id ?? null).map(option => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.full_name || option.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <StandardDatePicker
                label={t('boardManagement.targetDate')}
                value={escalationDraft.target_date ? dayjs(escalationDraft.target_date) : null}
                onChange={(newValue) => updateEscalationDraft({ target_date: newValue ? newValue.format('YYYY-MM-DD') : null })}
                disabled={!canEditEscalations}
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Tooltip title={t('boardManagement.progress')}>
                  <Box>
                    <CompletionDial
                      steps={escalationDraft.completion_steps ?? 0}
                      onClick={cycleDraftCompletion}
                      disabled={!canEditEscalations}
                    />
                  </Box>
                </Tooltip>
                <Typography variant="body2">{escalationDraft.completion_steps ?? 0} / 4 {t('boardManagement.steps')}</Typography>
              </Stack>
              {escalationHistoryReady && editingEscalation && (
                (() => {
                  const historyEntries = escalationHistory[editingEscalation.card_id] ?? [];
                  if (!historyEntries.length) return null;
                  const profileLookup = new Map(profiles.map(profile => [profile.id, profile]));
                  return (
                    <Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="subtitle2">{t('boardManagement.changeHistory')}</Typography>
                      <List dense>
                        {historyEntries.map(history => {
                          const author = profileLookup.get(history.changed_by ?? '') ?? null;
                          const authorLabel = author
                            ? author.full_name || author.email || 'Unbekannt'
                            : t('boardManagement.unknown');
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
            <Typography variant="body2">{t('boardManagement.noEscalationSelected')}</Typography>
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
            🧹 {t('boardManagement.clearFields')}
          </Button>

          <Box>
            <Button onClick={closeEscalationEditor} sx={{ mr: 1 }}>{t('common.cancel')}</Button>
            <Button onClick={saveEscalation} variant="contained" disabled={!canEditEscalations}>
              {t('common.save')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}