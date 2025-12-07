'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Typography, TextField, IconButton, Chip, Tabs, Tab, Grid, Card,
  CardContent, Badge, List, ListItem, Tooltip, Stack
} from '@mui/material';
import { DropResult } from '@hello-pangea/dnd';
import {
  Assessment, Close, Delete, Add, Settings, ViewHeadline, ViewModule,
  AddCircle, FilterList, Warning, PriorityHigh, ErrorOutline, Star, DeleteOutline,
  ArrowUpward, ArrowDownward, ArrowCircleRight
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { KanbanCard } from './original/KanbanCard';
import { KanbanColumnsView, KanbanLaneView, KanbanSwimlaneView } from './original/KanbanViews';
import { EditCardDialog, NewCardDialog, ArchiveDialog } from './original/KanbanDialogs';
import { nullableDate, toBoolean } from '@/utils/booleans';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';
import { ProjectBoardCard, LayoutDensity, ViewMode } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const formatSupabaseActionError = (action: string, message?: string | null): string => {
  if (!message) return `${action} fehlgeschlagen: Unbekannter Fehler.`;
  const normalized = message.toLowerCase();
  if (normalized.includes('row-level security')) {
    return `${action} fehlgeschlagen: Fehlende Berechtigungen (RLS). Bitte prüfe, ob du Mitglied des Boards bist.`;
  }
  return `${action} fehlgeschlagen: ${message}`;
};

export interface OriginalKanbanBoardHandle {
  openSettings: () => void;
  openKpis: () => void;
  openArchive: () => void;
}

interface OriginalKanbanBoardProps {
  boardId: string;
  onArchiveCountChange?: (count: number) => void;
  onKpiCountChange?: (count: number) => void;
  highlightCardId?: string | null;
  onExit?: () => void;
}

interface TopTopic {
  id: string;
  title: string;
  calendar_week?: string;
  due_date?: string;
  position: number;
}

const DEFAULT_COLS = [
  { id: "c1", name: "P1", done: false },
  { id: "c2", name: "P2", done: false },
  { id: "c3", name: "P3", done: false },
  { id: "c4", name: "P4", done: false },
  { id: "c5", name: "P5", done: false },
  { id: "c6", name: "P6", done: false },
  { id: "c7", name: "P7", done: false },
  { id: "c8", name: "P8", done: true }
];

const DEFAULT_TEMPLATES: Record<string, string[]> = {};
DEFAULT_COLS.forEach(col => {
  DEFAULT_TEMPLATES[col.name] = ["Anforderungen prüfen", "Dokumentation erstellen", "Qualitätskontrolle"];
});

const OriginalKanbanBoard = forwardRef<OriginalKanbanBoardHandle, OriginalKanbanBoardProps>(
  function OriginalKanbanBoard({ boardId, onArchiveCountChange, onKpiCountChange, highlightCardId, onExit }: OriginalKanbanBoardProps, ref) {
    const supabase = useMemo(() => getSupabaseBrowserClient(), []);
    const { enqueueSnackbar } = useSnackbar();
    const { t } = useLanguage();

    if (!supabase) {
      return <Box sx={{ p: 3 }}><SupabaseConfigNotice /></Box>;
    }

    const [viewMode, setViewMode] = useState<ViewMode>('columns');
    const [density, setDensity] = useState<LayoutDensity>('compact');
    const [searchTerm, setSearchTerm] = useState('');

    const [rows, setRows] = useState<ProjectBoardCard[]>([]);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
    const [users, setUsers] = useState<any[]>([]);
    const [boardMembers, setBoardMembers] = useState<any[]>([]);
    const [canModifyBoard, setCanModifyBoard] = useState(false);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);

    const [topTopicsOpen, setTopTopicsOpen] = useState(false);
    const [topTopics, setTopTopics] = useState<TopTopic[]>([]);

    const [filters, setFilters] = useState({
      mine: false,
      overdue: false,
      priority: false,
      critical: false,
      phaseTransition: false
    });

    const [permissions, setPermissions] = useState({
      canEditContent: false,
      canManageSettings: false,
      canManageAttendance: false
    });

    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archivedCards, setArchivedCards] = useState<ProjectBoardCard[]>([]);
    const [boardMeta, setBoardMeta] = useState<{ name: string; description?: string | null; updated_at?: string | null } | null>(null);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState<ProjectBoardCard | null>(null);
    const [editTabValue, setEditTabValue] = useState(0);
    const [newCardOpen, setNewCardOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [kpiPopupOpen, setKpiPopupOpen] = useState(false);

    const [boardName, setBoardName] = useState('');
    const [boardDescription, setBoardDescription] = useState('');

    const [checklistTemplates, setChecklistTemplates] = useState<Record<string, string[]>>(DEFAULT_TEMPLATES);

    const [customLabels, setCustomLabels] = useState({ tr: 'TR', sop: 'SOP' });

    const inferStage = useCallback((r: ProjectBoardCard) => {
      const s = (r["Board Stage"] || "").trim();
      const stages = cols.map(c => c.name);
      if (s && stages.includes(s)) return s;
      return stages[0];
    }, [cols]);

    const idFor = useCallback((r: ProjectBoardCard) => {
      if (r["UID"]) return String(r["UID"]);
      if (r.id) return String(r.id);
      if (r.card_id) return String(r.card_id);
      return [r["Nummer"], r["Teil"]].map(x => String(x || "").trim()).join(" | ");
    }, []);

    const convertDbToCard = useCallback((item: any): ProjectBoardCard => {
      const card = { ...(item.card_data || {}) } as ProjectBoardCard;
      card.UID = card.UID || item.card_id || item.id;
      card.id = item.id;
      card.card_id = item.card_id;
      if (item.stage) card["Board Stage"] = item.stage;
      if (item.position !== undefined && item.position !== null) {
        card.position = item.position;
        card.order = item.position;
      }
      return card;
    }, []);

    const reindexByStage = useCallback((cards: ProjectBoardCard[]): ProjectBoardCard[] => {
      const byStage: Record<string, number> = {};
      return cards.map((c) => {
        const stageKey = inferStage(c);
        let groupKey = stageKey;
        if (viewMode === 'swim') {
          groupKey += '|' + ((c["Verantwortlich"] || '').trim() || '—');
        } else if (viewMode === 'lane') {
          groupKey += '|' + (c["Swimlane"] || 'Allgemein');
        }
        byStage[groupKey] = (byStage[groupKey] ?? 0) + 1;
        return { ...c, order: byStage[groupKey], position: byStage[groupKey] };
      });
    }, [viewMode, inferStage]);

    const updateArchivedState = useCallback((cards: ProjectBoardCard[]) => {
      setArchivedCards(cards);
      onArchiveCountChange?.(cards.length);
    }, [onArchiveCountChange]);

    useImperativeHandle(ref, () => ({
      openSettings: () => setSettingsOpen(true),
      openKpis: () => setKpiPopupOpen(true),
      openArchive: async () => {
        await loadArchivedCards();
        setArchiveOpen(true);
      }
    }));

    const calculateKPIs = useCallback(() => {
      const activeCards = rows.filter(card => card["Archived"] !== "1");
      const kpis: any = {
        totalCards: activeCards.length,
        trOverdue: [],
        trToday: [],
        trThisWeek: [],

        ampelRed: 0,
        ampelYellow: 0,
        ampelNeutral: 0,
        yEscalations: [],
        rEscalations: [],
        columnDistribution: {},
        totalTrDeviation: 0
      };

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayStr = now.toISOString().split('T')[0];

      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);

      activeCards.forEach(card => {
        const ampel = String(card.Ampel || '').toLowerCase();
        // kpis.totalCards is already set to activeCards.length
        if (ampel === 'rot') kpis.ampelRed++;
        else if (ampel === 'gelb') kpis.ampelYellow++;
        else if (ampel !== 'grün') kpis.ampelNeutral++;

        const eskalation = String(card.Eskalation || '').toUpperCase();

        if (eskalation === 'LK' || eskalation === 'Y') kpis.yEscalations.push(card);
        if (eskalation === 'SK' || eskalation === 'R') kpis.rEscalations.push(card);

        const trDateStr = card['TR_Neu'] || card['TR_Datum'];
        const trCompleted = toBoolean(card.TR_Completed);

        if (trDateStr && !trCompleted) {
          const trDate = nullableDate(trDateStr);
          if (trDate) {
            trDate.setHours(0, 0, 0, 0);

            if (trDate < now) {
              kpis.trOverdue.push(card);
            } else if (trDate.toISOString().split('T')[0] === todayStr) {
              kpis.trToday.push(card);
            } else if (trDate <= endOfWeek) {
              kpis.trThisWeek.push(card);
            }
          }
        }

        const original = nullableDate(card["TR_Datum"]);
        const current = nullableDate(card["TR_Neu"]);
        if (original && current) {
          const diffTime = current.getTime() - original.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          kpis.totalTrDeviation += diffDays;
        }

        const stage = inferStage(card);
        kpis.columnDistribution[stage] = (kpis.columnDistribution[stage] || 0) + 1;
      });

      // Calculate Next 3 TRs
      kpis.nextTrs = activeCards
        .map(card => {
          const original = nullableDate(card["TR_Datum"]);
          const current = nullableDate(card["TR_Neu"]);
          const effectiveDate = current || original;
          return { card, original, current, effectiveDate };
        })
        .filter(item => item.effectiveDate && item.effectiveDate >= now)
        .sort((a, b) => (a.effectiveDate!.getTime() - b.effectiveDate!.getTime()))
        .slice(0, 3)
        .map(item => ({
          ...item.card,
          _originalDate: item.original,
          _currentDate: item.current, // Helper props for UI
          _effectiveDate: item.effectiveDate
        }));

      return kpis;
    }, [rows, inferStage]);

    const kpis = calculateKPIs();
    const kpiBadgeCount = useMemo(() => {
      return kpis.trOverdue.length + kpis.yEscalations.length + kpis.rEscalations.length;
    }, [kpis]);

    useEffect(() => {
      onKpiCountChange?.(kpiBadgeCount);
    }, [kpiBadgeCount, onKpiCountChange]);

    const loadTopTopics = useCallback(async () => {
      const { data } = await supabase
        .from('board_top_topics')
        .select('*')
        .eq('board_id', boardId)
        .order('position');
      if (data) setTopTopics(data);
    }, [boardId, supabase]);

    const filteredRows = useMemo(() => {
      let result = rows;

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(r =>
          Object.values(r).some(v => String(v || '').toLowerCase().includes(lower))
        );
      }

      if (filters.mine && currentUserName) {
        const myNameParts = currentUserName.toLowerCase().split(' ').filter(p => p.length > 2);
        const myEmail = (supabase.auth.getUser() as any)?.data?.user?.email;

        result = result.filter(r => {
          // Fix für Fehler 2551: VerantwortlichEmail ist nicht im Typ definiert, daher casten wir
          if ((r as any).VerantwortlichEmail === myEmail) return true;
          const resp = String(r.Verantwortlich || '').toLowerCase();
          // Stricter check: All parts of the user's name must be present in the responsible field, OR vice versa
          // This handles "Smith, Michael" vs "Michael Smith"
          return myNameParts.every(part => resp.includes(part)) ||
            (resp.length > 3 && myNameParts.join(' ').includes(resp));
        });
      }

      if (filters.overdue) {
        const today = new Date().toISOString().split('T')[0];
        result = result.filter(r => {
          const d = r['Due Date'];
          return d && d < today;
        });
      }

      if (filters.priority) {
        result = result.filter(r => toBoolean(r.Priorität));
      }



      if (filters.critical) {
        result = result.filter(r => {
          const esc = String(r.Eskalation || '').toUpperCase();
          return String(r.Ampel || '').toLowerCase().includes('rot') ||
            ['LK', 'SK', 'Y', 'R'].includes(esc);
        });
      }

      if (filters.phaseTransition) {
        result = result.filter(r => toBoolean(r.PhaseTransition));
      }

      return result;
    }, [rows, searchTerm, filters, currentUserName, supabase]);

    useEffect(() => {
      if (!supabase || !boardId) return;

      const channel = supabase
        .channel(`board:${boardId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kanban_cards',
            filter: `board_id=eq.${boardId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newCard = convertDbToCard(payload.new);
              setRows((prev) => {
                if (prev.some((r) => idFor(r) === idFor(newCard))) return prev;
                return reindexByStage([...prev, newCard]);
              });
            }

            if (payload.eventType === 'UPDATE') {
              const updatedCard = convertDbToCard(payload.new);
              setRows((prev) => {
                const isArchived = updatedCard["Archived"] === "1";
                if (isArchived) {
                  return prev.filter(r => idFor(r) !== idFor(updatedCard));
                }
                const index = prev.findIndex(r => idFor(r) === idFor(updatedCard));
                if (index === -1) {
                  return reindexByStage([...prev, updatedCard]);
                }
                const newRows = [...prev];
                newRows[index] = updatedCard;
                return newRows;
              });
            }

            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setRows((prev) => prev.filter((r) => r.id !== deletedId));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [boardId, supabase, convertDbToCard, reindexByStage, idFor]);

    const patchCard = useCallback(async (card: ProjectBoardCard, changes: Partial<ProjectBoardCard>) => {
      if (!permissions.canEditContent) {
        enqueueSnackbar(t('kanban.noPermission'), { variant: 'error' });
        return;
      }

      const updatedRows = rows.map(r => {
        if (idFor(r) === idFor(card)) { return { ...r, ...changes } as ProjectBoardCard; }
        return r;
      });
      setRows(updatedRows);

      if (selectedCard && idFor(selectedCard) === idFor(card)) {
        setSelectedCard(prev => prev ? ({ ...prev, ...changes } as ProjectBoardCard) : null);
      }

      try {
        const cardId = idFor(card);
        const fullUpdatedCard = { ...card, ...changes };

        const payload = {
          card_id: cardId,
          updates: {
            card_data: fullUpdatedCard,
            ...(changes['Board Stage'] ? { stage: changes['Board Stage'] } : {}),
            ...(changes.position !== undefined ? { position: changes.position } : {})
          }
        };

        const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
        const response = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
          credentials: 'include',
        });

        if (!response.ok) {
          enqueueSnackbar(t('kanban.saveFailed'), { variant: 'error' });
        }
      } catch (error) {
        console.error('Patch error:', error);
        enqueueSnackbar(t('kanban.networkError'), { variant: 'error' });
      }
    }, [permissions.canEditContent, rows, idFor, boardId, supabase, enqueueSnackbar, selectedCard, t]);

    const saveSettings = useCallback(async (options?: { skipMeta?: boolean; settingsOverrides?: any }) => {
      if (!permissions.canManageSettings) return false;

      try {
        const settings = {
          cols,
          lanes,
          checklistTemplates,
          viewMode,
          density,
          trLabel: customLabels.tr,
          sopLabel: customLabels.sop,
          lastUpdated: new Date().toISOString(),
          ...(options?.settingsOverrides || {})
        };

        const requestBody: any = { settings };

        if (!options?.skipMeta) {
          const trimmedName = boardName.trim();
          if (!trimmedName && boardMeta?.name) {
            setBoardName(boardMeta.name);
            return false;
          }
          const metaPayload: any = {};
          let metaChanged = false;
          if (trimmedName !== (boardMeta?.name || '')) {
            metaPayload.name = trimmedName;
            metaChanged = true;
          }
          const descriptionValue = boardDescription.trim() ? boardDescription.trim() : null;
          if (descriptionValue !== (boardMeta?.description ?? null)) {
            metaPayload.description = descriptionValue;
            metaChanged = true;
          }
          if (metaChanged) {
            requestBody.meta = metaPayload;
          }
        }

        const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
        const response = await fetch(`/api/boards/${boardId}/settings`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          enqueueSnackbar(formatSupabaseActionError('Einstellungen speichern', payload?.error), { variant: 'error' });
          return false;
        }

        const payload = await response.json().catch(() => ({}));
        if (payload.meta) {
          setBoardMeta(prev => ({ ...prev, ...payload.meta }));
          window.dispatchEvent(new CustomEvent('board-meta-updated', { detail: { id: boardId, name: payload.meta.name, description: payload.meta.description } }));
        }

        if (!options?.skipMeta) {
          enqueueSnackbar(t('kanban.settingsSaved'), { variant: 'success' });
        }
        return true;
      } catch (error) {
        enqueueSnackbar(formatSupabaseActionError('Einstellungen speichern', getErrorMessage(error)), { variant: 'error' });
        return false;
      }
    }, [permissions.canManageSettings, boardId, supabase, cols, lanes, checklistTemplates, viewMode, density, boardName, boardDescription, boardMeta, enqueueSnackbar, t]);

    const saveCards = useCallback(async () => {
      if (!permissions.canEditContent) return false;

      try {
        const cardsToSave = rows.map((card) => {
          const stage = inferStage(card);
          return {
            board_id: boardId,
            card_id: idFor(card),
            card_data: card,
            stage: stage,
            position: card.position ?? card.order ?? 0,
            project_number: card.Nummer || null,
            project_name: card.Teil,
            updated_at: new Date().toISOString(),
          };
        });

        const headers = { 'Content-Type': 'application/json', ...(await buildSupabaseAuthHeaders(supabase)) };
        const response = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ cards: cardsToSave }),
          credentials: 'include',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          console.error('Karten speichern fehlgeschlagen:', payload?.error);
          return false;
        }
        return true;
      } catch (error) {
        console.error('Karten speichern Fehler:', getErrorMessage(error));
        return false;
      }
    }, [permissions.canEditContent, boardId, rows, supabase, inferStage, idFor]);

    const loadSettings = useCallback(async () => {
      try {
        const headers = await buildSupabaseAuthHeaders(supabase);
        const response = await fetch(`/api/boards/${boardId}/settings`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (response.status === 404) return false;
        if (!response.ok) return false;

        const payload = await response.json();
        if (payload?.settings) {
          const s = payload.settings;
          if (s.cols) setCols(s.cols);
          if (s.lanes) setLanes(s.lanes);
          if (s.checklistTemplates) setChecklistTemplates(s.checklistTemplates);
          if (s.viewMode) setViewMode(s.viewMode);
          if (s.density) setDensity(s.density);
          if (s.trLabel || s.sopLabel) {
            setCustomLabels({
              tr: s.trLabel || 'TR',
              sop: s.sopLabel || 'SOP'
            });
          }
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    }, [boardId, supabase]);

    const loadCards = useCallback(async () => {
      try {
        let { data, error } = await supabase
          .from('kanban_cards')
          .select('card_data, stage, position, id, card_id')
          .eq('board_id', boardId);

        if (error && error.message.includes('column')) {
          // Fallback Query:
          // Fix für Fehler 2322: Wir müssen card_data, stage, position usw. aus den vorhandenen Daten rekonstruieren
          const result = await supabase
            .from('kanban_cards')
            .select('card_data, id, card_id')
            .eq('board_id', boardId)
            .order('updated_at', { ascending: false });

          // Mapping damit TypeScript zufrieden ist
          if (result.data) {
            data = result.data.map((d: any) => ({
              ...d,
              stage: d.card_data['Board Stage'] || '',
              position: d.card_data.position || 0
            }));
          } else {
            data = null;
          }
          error = result.error;
        }

        if (error) throw error;

        if (data && data.length > 0) {
          let loadedCards = data.map(convertDbToCard);

          const activeCards = loadedCards.filter(card => card["Archived"] !== "1");

          activeCards.sort((a, b) => {
            const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
            const stageA = inferStage(a);
            const stageB = inferStage(b);

            if (stageA !== stageB) {
              return pos(stageA) - pos(stageB);
            }
            const orderA = a.order ?? a.position ?? 1;
            const orderB = b.order ?? b.position ?? 1;
            return orderA - orderB;
          });

          setRows(activeCards);
          return true;
        }

        setRows([]);
        return false;
      } catch (error) {
        console.error('❌ Fehler beim Laden der Karten:', error);
        setRows([]);
        return false;
      }
    }, [boardId, supabase, inferStage, convertDbToCard]);

    // --- Initialisierung & Permissions ---

    const resolvePermissions = useCallback(async (loadedUsers: any[]) => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          setCanModifyBoard(false);
          setPermissions({ canEditContent: false, canManageSettings: false, canManageAttendance: false });
          return;
        }

        const authUserId = data.user.id;
        const email = data.user.email ?? '';
        const profile = loadedUsers.find((user: any) => user.id === authUserId);

        if (profile) {
          setCurrentUserName(profile.full_name || profile.name || email);
        }

        const globalRole = String(profile?.role ?? '').toLowerCase();
        const isSuper = isSuperuserEmail(email) || globalRole === 'superuser';
        const isGlobalAdmin = isSuper || globalRole === 'admin';

        if (isGlobalAdmin) {
          setCanModifyBoard(true);
          setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
          return;
        }

        const { data: boardRow } = await supabase
          .from('kanban_boards')
          .select('owner_id, board_admin_id')
          .eq('id', boardId)
          .maybeSingle();

        const isOwner = boardRow?.owner_id === authUserId;
        const isBoardAdmin = boardRow?.board_admin_id === authUserId;

        const { data: memberRow } = await supabase
          .from('board_members')
          .select('role')
          .eq('board_id', boardId)
          .eq('profile_id', authUserId)
          .maybeSingle();

        const isMember = !!memberRow;
        const memberRole = memberRow?.role;

        setCanModifyBoard(isOwner || isBoardAdmin || isMember);
        setPermissions({
          canEditContent: isOwner || isBoardAdmin || isMember,
          canManageSettings: isOwner || isBoardAdmin || memberRole === 'admin',
          canManageAttendance: isOwner || isBoardAdmin
        });

      } catch (error) {
        console.error('❌ Berechtigungsprüfung fehlgeschlagen:', error);
        setCanModifyBoard(false);
        setPermissions({ canEditContent: false, canManageSettings: false, canManageAttendance: false });
      }
    }, [boardId, supabase]);

    const loadBoardMeta = useCallback(async () => {
      const { data } = await supabase
        .from('kanban_boards')
        .select('name, description, updated_at')
        .eq('id', boardId)
        .maybeSingle();

      if (data) {
        setBoardMeta(data);
        setBoardName(data.name || '');
        setBoardDescription(data.description || '');
        return data;
      }
      return null;
    }, [boardId, supabase]);

    const loadUsers = useCallback(async (): Promise<any[]> => {
      try {
        const profiles = await fetchClientProfiles();
        setUsers(profiles);
        return profiles;
      } catch (error) {
        console.error('❌ Fehler beim Laden der Benutzer:', error);
        return [];
      }
    }, []);

    const loadBoardMembers = useCallback(async (allProfiles: any[]) => {
      try {
        const { data: membersData, error: membersError } = await supabase
          .from('board_members')
          .select('profile_id')
          .eq('board_id', boardId);

        if (membersError) throw membersError;

        const memberIds = new Set(membersData?.map(m => m.profile_id) || []);

        const { data: boardData } = await supabase
          .from('kanban_boards')
          .select('owner_id, board_admin_id')
          .eq('id', boardId)
          .maybeSingle();

        if (boardData) {
          if (boardData.owner_id) memberIds.add(boardData.owner_id);
          if (boardData.board_admin_id) memberIds.add(boardData.board_admin_id);
        }

        const members = allProfiles.filter(u => memberIds.has(u.id));
        setBoardMembers(members);
      } catch (error) {
        console.error('Fehler beim Laden der Board-Mitglieder:', error);
      }
    }, [boardId, supabase]);



    useEffect(() => {
      let isMounted = true;
      const initializeBoard = async () => {
        if (!isMounted) return;
        await loadBoardMeta();
        const loadedUsers = await loadUsers();
        await loadBoardMembers(loadedUsers);

        await resolvePermissions(loadedUsers);
        await loadSettings();
        await loadCards();
      };
      if (boardId) initializeBoard();
      return () => { isMounted = false; };
    }, [boardId]);

    useEffect(() => {
      const timeoutId = setTimeout(() => { saveSettings({ skipMeta: true }); }, 1000);
      return () => clearTimeout(timeoutId);
    }, [cols, lanes, checklistTemplates, viewMode, density, saveSettings]);

    // --- Card Actions ---

    const loadArchivedCards = useCallback(async () => {
      try {
        const { data } = await supabase
          .from('kanban_cards')
          .select('card_data')
          .eq('board_id', boardId);

        const archived = (data || [])
          .map(item => item.card_data)
          .filter(card => card["Archived"] === "1");

        updateArchivedState(archived);
        return archived;
      } catch (error) {
        console.error('❌ Fehler beim Laden des Archivs:', error);
        updateArchivedState([]);
        return [];
      }
    }, [boardId, supabase, updateArchivedState]);

    const restoreCard = async (card: any) => {
      if (!permissions.canEditContent) return;
      if (!window.confirm(t('kanban.restoreCardConfirm').replace('{id}', `${card.Nummer} ${card.Teil}`))) return;

      card["Archived"] = "";
      card["ArchivedDate"] = null;
      const updatedRows = reindexByStage([...rows, card]);
      setRows(updatedRows);
      await saveCards();
      enqueueSnackbar(t('kanban.cardRestored'), { variant: 'success' });
    };

    const deleteCardPermanently = async (card: any) => {
      if (!permissions.canManageSettings) {
        enqueueSnackbar(t('kanban.deleteCardAdminOnly'), { variant: 'warning' });
        return;
      }
      if (!window.confirm(t('kanban.deleteCardConfirm').replace('{id}', `${card.Nummer} ${card.Teil}`))) return;

      try {
        const headers = await buildSupabaseAuthHeaders(supabase);
        const response = await fetch(`/api/boards/${boardId}/cards?cardId=${encodeURIComponent(idFor(card))}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          enqueueSnackbar(formatSupabaseActionError('Karte löschen', payload?.error), { variant: 'error' });
          return;
        }

        setRows(prev => prev.filter(r => idFor(r) !== idFor(card)));
        setArchivedCards(prev => prev.filter(r => idFor(r) !== idFor(card)));

        enqueueSnackbar(t('kanban.cardDeleted'), { variant: 'success' });
      } catch (error) {
        enqueueSnackbar(formatSupabaseActionError('Karte löschen', getErrorMessage(error)), { variant: 'error' });
      }
    };

    const archiveColumn = (columnName: string) => {
      if (!permissions.canEditContent) return;
      if (!window.confirm(t('kanban.archiveColumnConfirm').replace('{column}', columnName))) return;

      const updatedRows = rows.map(r => {
        if (inferStage(r) === columnName) {
          r["Archived"] = "1";
          r["ArchivedDate"] = new Date().toLocaleDateString('de-DE');
        }
        return r;
      }).filter(r => r["Archived"] !== "1");

      setRows(updatedRows);
      enqueueSnackbar(t('kanban.cardsArchived'), { variant: 'info' });
    };

    const addStatusEntry = (card: any) => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('de-DE');
      const newEntry = { date: dateStr, message: { text: '', escalation: false }, qualitaet: { text: '', escalation: false }, kosten: { text: '', escalation: false }, termine: { text: '', escalation: false } };
      if (!Array.isArray(card.StatusHistory)) card.StatusHistory = [];
      card.StatusHistory.unshift(newEntry);
      setRows([...rows]);
    };

    const updateStatusSummary = (card: any) => {
      const hist = Array.isArray(card.StatusHistory) ? card.StatusHistory : [];
      let kurz = '';
      if (hist.length) {
        const latest = hist[0];
        ['message', 'qualitaet', 'kosten', 'termine'].some(key => {
          const e = latest[key as keyof typeof latest] as any;
          if (e && e.text && e.text.trim()) { kurz = e.text.trim(); return true; }
          return false;
        });
      }
      card['Status Kurz'] = kurz;
    };

    const handleTRNeuChange = async (card: any, newDate: string) => {
      if (!permissions.canEditContent) return;

      if (!newDate) {
        card["TR_Neu"] = "";
        setRows([...rows]);
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = users.find(u => u.id === authData.user?.id)?.full_name || 'System';

      if (!Array.isArray(card["TR_History"])) card["TR_History"] = [];

      if (card["TR_Neu"] && card["TR_Neu"] !== newDate) {
        card["TR_History"].push({ date: card["TR_Neu"], changedBy: currentUser, timestamp: new Date().toISOString(), superseded: true });
      }

      card["TR_Neu"] = newDate;
      card["TR_History"].push({ date: newDate, changedBy: currentUser, timestamp: new Date().toISOString(), superseded: false });
      setRows([...rows]);
    };

    const onDragEnd = (result: DropResult) => {
      if (!permissions.canEditContent) return;
      const { destination, source, draggableId } = result;

      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;

      const card = rows.find(r => idFor(r) === draggableId);
      if (!card) return;

      const sourceStage = inferStage(card);
      const isChangingStage = !destination.droppableId.startsWith(sourceStage);

      if (isChangingStage || viewMode === 'columns') {
        const requiredTasks = checklistTemplates[sourceStage] || [];
        const doneTasks = card.ChecklistDone?.[sourceStage] || {};
        const missingTasks = requiredTasks.filter(t => !doneTasks[t]);

        if (missingTasks.length > 0) {
          const confirmed = window.confirm(
            t('kanban.checklistUnfinished')
              .replace('{stage}', sourceStage)
              .replace('{count}', String(missingTasks.length))
              .replace('{items}', missingTasks.map(t => `- ${t}`).join('\n'))
          );
          if (!confirmed) return;
        }
      }

      let newStage = destination.droppableId;
      let newResp = null;
      let newLane = null;

      if (destination.droppableId.includes('||')) {
        const parts = destination.droppableId.split('||');
        newStage = parts[0];
        if (viewMode === 'swim') newResp = parts[1] === ' ' ? '' : parts[1];
        else if (viewMode === 'lane') newLane = parts[1];
      }

      const newRows = [...rows];
      const cardIndex = newRows.findIndex(r => idFor(r) === draggableId);
      if (cardIndex === -1) return;

      const [movedCard] = newRows.splice(cardIndex, 1);

      movedCard["Board Stage"] = newStage;
      if (newResp !== null) movedCard["Verantwortlich"] = newResp;
      if (newLane !== null) movedCard["Swimlane"] = newLane;

      const targetGroupFilter = (r: any) => {
        let matches = inferStage(r) === newStage;
        if (viewMode === 'swim' && newResp !== null) {
          matches = matches && ((r["Verantwortlich"] || '').trim() || '—') === newResp;
        } else if (viewMode === 'lane' && newLane !== null) {
          matches = matches && (r["Swimlane"] || 'Allgemein') === newLane;
        }
        return matches;
      };

      let globalInsertIndex = newRows.length;
      let targetStageCardCount = 0;

      for (let i = 0; i < newRows.length; i++) {
        if (targetGroupFilter(newRows[i])) {
          if (targetStageCardCount === destination.index) {
            globalInsertIndex = i;
            break;
          }
          targetStageCardCount++;
        }
      }

      newRows.splice(globalInsertIndex, 0, movedCard);

      const doneStageNames = cols.filter(c => c.done || /fertig/i.test(c.name)).map(c => c.name);
      if (doneStageNames.includes(newStage)) {
        movedCard["Ampel"] = "grün";
        movedCard["Eskalation"] = "";
      }

      const reindexed = reindexByStage(newRows);
      setRows(reindexed);

      saveCards();
    };

    const renderCard = useCallback(
      (card: any, index: number) => (
        <KanbanCard
          key={idFor(card)}
          card={card}
          index={index}
          density={density}
          rows={filteredRows}
          setRows={setRows}
          saveCards={saveCards}
          patchCard={patchCard}
          setSelectedCard={setSelectedCard}
          setEditModalOpen={setEditModalOpen}
          setEditTabValue={setEditTabValue}
          inferStage={inferStage}
          idFor={idFor}
          users={users}
          canModify={permissions.canEditContent}
          highlighted={highlightCardId === idFor(card) || highlightCardId === card.card_id || highlightCardId === card.id}
          checklistTemplates={checklistTemplates}
          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
        />
      ),
      [filteredRows, permissions.canEditContent, density, idFor, inferStage, saveCards, patchCard, setEditModalOpen, setEditTabValue, setRows, setSelectedCard, users, highlightCardId, checklistTemplates, customLabels]
    );

    function TRKPIPopup({ open, onClose, trLabel = 'TR' }: { open: boolean; onClose: () => void; trLabel?: string }) {
      const kpis = calculateKPIs();
      const { t } = useLanguage();
      const distribution = Object.entries(kpis.columnDistribution).map(([name, count]) => ({ name, count: count as number }));
      distribution.sort((a, b) => {
        const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
        return pos(a.name) - pos(b.name);
      });

      const percentage = (count: number) => kpis.totalCards > 0 ? Math.round((count / kpis.totalCards) * 100) : 0;
      const isOverdue = kpis.trOverdue.length > 0;
      const hasEscalations = kpis.yEscalations.length > 0 || kpis.rEscalations.length > 0;

      return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            {t('kanban.kpiTitle')}
            <IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ height: '100%', backgroundColor: isOverdue ? '#ffebee' : '#f0f0f0' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">{t('kanban.overdueTrs')}</Typography>
                    <Typography variant="h4" color={isOverdue ? 'error.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                      {kpis.trOverdue.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{t('kanban.totalCards').replace('{count}', String(kpis.totalCards))}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ height: '100%', backgroundColor: hasEscalations ? '#fff3e0' : '#f0f0f0' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">{t('kanban.escalations')}</Typography>
                    <Typography variant="h4" color={hasEscalations ? 'warning.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                      {kpis.yEscalations.length + kpis.rEscalations.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Y: {kpis.yEscalations.length} / R: {kpis.rEscalations.length}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ height: '100%', backgroundColor: kpis.ampelGreen > 0 ? '#e8f5e8' : '#f0f0f0' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">{t('kanban.total')}</Typography>
                    <Typography variant="h4" color="text.primary" sx={{ fontWeight: 700 }}>
                      {kpis.totalCards}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{t('kanban.allCards')}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: kpis.totalTrDeviation > 0 ? 'error.light' : 'success.light', borderRadius: 1, bgcolor: kpis.totalTrDeviation > 0 ? 'error.50' : 'success.50' }}>
                  <Typography variant="subtitle2" sx={{ color: kpis.totalTrDeviation > 0 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                    {t('kanban.totalTrDeviation').replace('{label}', trLabel).replace('{sign}', kpis.totalTrDeviation > 0 ? '+' : '').replace('{days}', String(kpis.totalTrDeviation))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('kanban.trDeviationDesc')}
                  </Typography>
                </Box>

                {/* Next 3 TRs */}
                {/* Custom Label in Heading */}
                <Typography variant="h6" gutterBottom sx={{ mt: 3, color: 'text.secondary' }}>
                  {t('kanban.upcoming')} {trLabel}
                </Typography>
                <Grid container spacing={2}>
                  {(kpis.nextTrs || []).map((card: any) => (
                    <Grid item xs={12} md={4} key={idFor(card)}>
                      <Card variant="outlined" sx={{ height: '100%', p: 1 }}>
                        <CardContent sx={{ p: '16px !important' }}>
                          <Typography variant="subtitle2" noWrap title={card.Teil} sx={{ fontWeight: 'bold' }}>
                            {card.Teil || 'Kein Titel'}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary" gutterBottom>
                            #{card.Nummer || '-'}
                          </Typography>

                          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption">Original:</Typography>
                              <Typography variant="caption">{card._originalDate ? card._originalDate.toLocaleDateString('de-DE') : '-'}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption">Aktuell (Neu):</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', color: card._currentDate ? 'primary.main' : 'text.primary' }}>
                                {card._effectiveDate ? card._effectiveDate.toLocaleDateString('de-DE') : '-'}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  {(!kpis.nextTrs || kpis.nextTrs.length === 0) && (
                    <Grid item xs={12}><Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Keine anstehenden TRs gefunden.</Typography></Grid>
                  )}
                </Grid>

                <Typography variant="h6" gutterBottom sx={{ mt: 3, color: 'text.secondary' }}>{t('kanban.cardDistribution')}</Typography>
                <Card variant="outlined">
                  <CardContent>
                    <List dense>
                      {distribution.map((item, index) => (
                        <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
                          <Grid container alignItems="center" spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ width: '100%', height: '10px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px' }}>
                                <Box sx={{
                                  width: `${percentage(item.count)}%`,
                                  height: '100%',
                                  backgroundColor: DEFAULT_COLS.find(c => c.name === item.name)?.done ? '#4caf50' : '#2196f3',
                                  borderRadius: '4px',
                                  transition: 'width 0.5s ease',
                                }} />
                              </Box>
                            </Grid>
                            <Grid item xs={2} sx={{ textAlign: 'right' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.count} ({percentage(item.count)}%)</Typography>
                            </Grid>
                          </Grid>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={onClose} variant="outlined">{t('kanban.close')}</Button></DialogActions>
        </Dialog>
      );
    };

    const TopTopicsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
      const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);
      useEffect(() => setLocalTopics(topTopics), [topTopics]);

      const handleSaveTopic = async (index: number, field: keyof TopTopic, value: any) => {
        const topic = localTopics[index];
        const updated = { ...topic, [field]: value };
        const newTopics = [...localTopics];
        newTopics[index] = updated;
        setLocalTopics(newTopics);
        if (!topic.id.startsWith('temp-')) {
          await supabase.from('board_top_topics').update({ [field]: value }).eq('id', topic.id);
        }
      };

      const handleDateAccept = async (index: number, newValue: dayjs.Dayjs | null) => {
        if (!newValue) return;
        const d = newValue.format('YYYY-MM-DD');
        const kw = `${newValue.year()}-W${newValue.isoWeek()}`;
        const topic = localTopics[index];
        const updated = { ...topic, due_date: d, calendar_week: kw };
        const newTopics = [...localTopics];
        newTopics[index] = updated;
        setLocalTopics(newTopics);
        if (!topic.id.startsWith('temp-')) {
          await supabase.from('board_top_topics').update({ due_date: d, calendar_week: kw }).eq('id', topic.id);
        }
      };

      const handleAdd = async () => {
        if (localTopics.length >= 5) return;
        const { data } = await supabase.from('board_top_topics').insert({
          board_id: boardId,
          title: '',
          position: localTopics.length
        }).select().single();
        if (data) setLocalTopics([...localTopics, data]);
      };

      const handleDelete = async (id: string) => {
        await supabase.from('board_top_topics').delete().eq('id', id);
        setLocalTopics(localTopics.filter(t => t.id !== id));
      };

      return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star color="warning" /> {t('kanban.topTopicsTitle')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {localTopics.length === 0 && <Typography variant="body2" color="text.secondary">{t('kanban.noTopTopics')}</Typography>}
              {localTopics.map((topic, index) => (
                <Box key={topic.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField fullWidth size="small" placeholder={t('kanban.topicPlaceholder')} value={topic.title} onChange={(e) => handleSaveTopic(index, 'title', e.target.value)} />

                  <Box sx={{ width: 200 }}>
                    <StandardDatePicker
                      label={t('kanban.dueDate')}
                      value={topic.due_date ? dayjs(topic.due_date) : null}
                      onChange={(newValue) => handleDateAccept(index, newValue)}
                    />             </Box>
                  <Chip label={topic.calendar_week ? `KW ${topic.calendar_week.split('-W')[1]}` : 'KW -'} />
                  <IconButton color="error" onClick={() => handleDelete(topic.id)}><DeleteOutline /></IconButton>
                </Box>
              ))}
              {localTopics.length < 5 && <Button startIcon={<AddCircle />} onClick={handleAdd}>{t('kanban.addTopic')}</Button>}
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={onClose}>{t('kanban.close')}</Button></DialogActions>
        </Dialog >
      );
    };

    const SettingsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
      const [currentCols, setCurrentCols] = useState(cols);
      const [currentTemplates, setCurrentTemplates] = useState(checklistTemplates);
      const [localCustomLabels, setLocalCustomLabels] = useState(customLabels);
      const [tab, setTab] = useState(0);
      const [newColName, setNewColName] = useState('');

      useEffect(() => {
        if (open) {
          setCurrentCols(cols);
          setCurrentTemplates(checklistTemplates);
          setLocalCustomLabels(customLabels);
        }
      }, [open, cols, checklistTemplates, customLabels]);

      const handleSave = async () => {
        setCols(currentCols);
        setChecklistTemplates(currentTemplates);
        setCustomLabels(localCustomLabels);
        const success = await saveSettings({
          settingsOverrides: {
            cols: currentCols,
            checklistTemplates: currentTemplates,
            trLabel: localCustomLabels.tr,
            sopLabel: localCustomLabels.sop
          }
        });
        if (success) {
          onClose();
          loadCards();
        }
      };

      const addChecklistItem = (colName: string) => {
        const newT = { ...currentTemplates };
        if (!newT[colName]) newT[colName] = [];
        newT[colName].push(`${t('kanban.newEntry')} ${newT[colName].length + 1}`);
        setCurrentTemplates(newT);
      };
      const updateChecklistItem = (colName: string, idx: number, text: string) => {
        const newT = { ...currentTemplates };
        if (newT[colName]) { newT[colName][idx] = text; setCurrentTemplates(newT); }
      };
      const deleteChecklistItem = (colName: string, idx: number) => {
        const newT = { ...currentTemplates };
        if (newT[colName]) { newT[colName].splice(idx, 1); setCurrentTemplates(newT); }
      };

      const handleMove = (id: string, dir: 'up' | 'down') => {
        const idx = currentCols.findIndex(c => c.id === id); if (idx === -1) return;
        const newC = [...currentCols]; const [rem] = newC.splice(idx, 1);
        newC.splice(dir === 'up' ? Math.max(0, idx - 1) : Math.min(newC.length, idx + 1), 0, rem);
        setCurrentCols(newC);
      };
      const handleAddCol = () => { if (newColName.trim()) { setCurrentCols([...currentCols, { id: `c${Date.now()}`, name: newColName, done: false }]); setNewColName(''); } };
      const handleDelCol = (id: string) => { if (confirm(t('kanban.deletePrompt'))) setCurrentCols(currentCols.filter(c => c.id !== id)); };
      const handleToggleDone = (id: string) => { setCurrentCols(currentCols.map(c => c.id === id ? { ...c, done: !c.done } : c)); }

      return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Settings color="primary" /> {t('kanban.boardSettings')}<IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton></DialogTitle>
          <DialogContent dividers>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label={t('kanban.metaData')} />
              <Tab label={t('kanban.columns')} />
              <Tab label={t('kanban.checklists')} />
            </Tabs>

            {tab === 0 && (
              <Box sx={{ pt: 1 }}>
                <TextField label={t('kanban.boardName')} value={boardName} onChange={(e) => setBoardName(e.target.value)} fullWidth sx={{ mt: 2 }} disabled={!permissions.canManageSettings} />
                <TextField label={t('kanban.description')} value={boardDescription} onChange={(e) => setBoardDescription(e.target.value)} fullWidth multiline rows={2} sx={{ mt: 2 }} disabled={!permissions.canManageSettings} />
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <TextField label="TR Label" value={localCustomLabels.tr} onChange={(e) => setLocalCustomLabels(prev => ({ ...prev, tr: e.target.value }))} fullWidth size="small" disabled={!permissions.canManageSettings} />
                  <TextField label="SOP Label" value={localCustomLabels.sop} onChange={(e) => setLocalCustomLabels(prev => ({ ...prev, sop: e.target.value }))} fullWidth size="small" disabled={!permissions.canManageSettings} />
                </Box>
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ pt: 1 }}>
                <List dense>
                  {currentCols.map((col, idx) => (
                    <ListItem key={col.id} secondaryAction={
                      <Box>
                        <IconButton size="small" onClick={() => handleMove(col.id, 'up')} disabled={!permissions.canManageSettings || idx === 0}><ArrowUpward fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => handleMove(col.id, 'down')} disabled={!permissions.canManageSettings || idx === currentCols.length - 1}><ArrowDownward fontSize="small" /></IconButton>
                        <Button size="small" onClick={() => handleToggleDone(col.id)} disabled={!permissions.canManageSettings} sx={{ ml: 1, border: '1px solid', borderColor: col.done ? 'success.main' : 'grey.400', color: col.done ? 'success.main' : 'text.primary' }}>{col.done ? t('kanban.done') : t('kanban.normal')}</Button>
                        <IconButton onClick={() => handleDelCol(col.id)} disabled={!permissions.canManageSettings}><Delete /></IconButton>
                      </Box>
                    }>
                      <TextField value={col.name} onChange={(e) => { const nc = [...currentCols]; nc[idx].name = e.target.value; setCurrentCols(nc); }} size="small" fullWidth sx={{ mr: 2 }} disabled={!permissions.canManageSettings} />
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <TextField size="small" label={t('kanban.newColumn')} value={newColName} onChange={(e) => setNewColName(e.target.value)} fullWidth disabled={!permissions.canManageSettings} />
                  <Button variant="contained" startIcon={<Add />} onClick={handleAddCol} disabled={!permissions.canManageSettings}>{t('kanban.add')}</Button>
                </Box>
              </Box>
            )}

            {tab === 2 && (
              <Box sx={{ pt: 1, height: '400px', overflowY: 'auto' }}>
                {currentCols.map((col) => (
                  <Card key={col.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>{col.name}</Typography>
                    <List dense>
                      {(currentTemplates[col.name] || []).map((item, idx) => (
                        <ListItem key={idx} disableGutters secondaryAction={
                          <IconButton edge="end" onClick={() => deleteChecklistItem(col.name, idx)} disabled={!permissions.canManageSettings}>
                            <Delete fontSize="small" color="error" />
                          </IconButton>
                        }>
                          <TextField fullWidth size="small" value={item} onChange={(e) => updateChecklistItem(col.name, idx, e.target.value)} sx={{ mr: 2 }} disabled={!permissions.canManageSettings} />
                        </ListItem>
                      ))}
                    </List>
                    <Button startIcon={<Add />} size="small" onClick={() => addChecklistItem(col.name)} disabled={!permissions.canManageSettings}>{t('kanban.addItem')}</Button>
                  </Card>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions><Button onClick={onClose}>{t('kanban.cancel')}</Button><Button onClick={handleSave} variant="contained" disabled={!permissions.canManageSettings}>{t('kanban.saveAndClose')}</Button></DialogActions>
        </Dialog>
      );
    };

    return (
      <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)', color: 'var(--ink)', '&': { '--colw': '300px', '--rowheadw': '260px' } as any }}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 5, background: 'linear-gradient(180deg,rgba(0,0,0,.05),transparent),var(--panel)', borderBottom: '1px solid var(--line)', p: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr repeat(2, auto) repeat(3, auto) repeat(3, auto)', gap: 1.5, alignItems: 'center', mt: 0 }}>
            <TextField
              size="small"
              placeholder={t('kanban.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <FilterList fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
              sx={{ width: 200 }}
            />



            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
              <Chip icon={<FilterList />} label={t('kanban.myCards')} clickable color={filters.mine ? "primary" : "default"} onClick={() => setFilters(prev => ({ ...prev, mine: !prev.mine }))} />
              <Chip icon={<Warning />} label={t('kanban.overdue')} clickable color={filters.overdue ? "error" : "default"} onClick={() => setFilters(prev => ({ ...prev, overdue: !prev.overdue }))} />
              <Chip icon={<PriorityHigh />} label={t('kanban.important')} clickable color={filters.priority ? "warning" : "default"} onClick={() => setFilters(prev => ({ ...prev, priority: !prev.priority }))} />
              <Chip icon={<ErrorOutline />} label={t('kanban.critical')} clickable color={filters.critical ? "error" : "default"} onClick={() => setFilters(prev => ({ ...prev, critical: !prev.critical }))} />
              <Chip icon={<ArrowCircleRight />} label={t('kanban.phaseTransition')} clickable color={filters.phaseTransition ? "primary" : "default"} onClick={() => setFilters(prev => ({ ...prev, phaseTransition: !prev.phaseTransition }))} />
            </Box>

            <Button variant={density === 'compact' ? 'contained' : 'outlined'} onClick={() => setDensity('compact')} sx={{ minWidth: 'auto', p: 1 }} title={t('kanban.layoutCompact')}><ViewHeadline fontSize="small" /></Button>
            <Button variant={density === 'large' ? 'contained' : 'outlined'} onClick={() => setDensity('large')} sx={{ minWidth: 'auto', p: 1 }} title={t('kanban.layoutLarge')}><ViewModule fontSize="small" /></Button>

            <Button variant="contained" size="small" startIcon={<AddCircle />} onClick={() => setNewCardOpen(true)} disabled={!permissions.canEditContent}>{t('kanban.newCard')}</Button>

            {permissions.canManageSettings && (
              <IconButton onClick={() => setSettingsOpen(true)} title={t('kanban.boardSettings')}>
                <Settings fontSize="small" />
              </IconButton>
            )}
            <Tooltip title={t('kanban.topTopics')}>
              <IconButton onClick={() => { loadTopTopics(); setTopTopicsOpen(true); }}>
                <Star fontSize="small" color="warning" />
              </IconButton>
            </Tooltip>
            <Badge badgeContent={kpiBadgeCount} color="error" overlap="circular">
              <IconButton onClick={() => setKpiPopupOpen(true)} title={t('kanban.kpiTitle')}><Assessment fontSize="small" /></IconButton>
            </Badge>
            {kpis.ampelNeutral > 0 && (
              <Chip
                label={kpis.ampelNeutral}
                size="small"
                sx={{
                  bgcolor: '#90ee90',
                  color: '#000',
                  fontWeight: 'bold',
                  height: 24,
                  minWidth: 24
                }}
                title={t('kanban.neutralCards')}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {viewMode === 'columns' && (
            <KanbanColumnsView
              rows={filteredRows}
              cols={cols}
              density={density}
              searchTerm={searchTerm}
              onDragEnd={onDragEnd}
              inferStage={inferStage}
              archiveColumn={() => { }}
              renderCard={renderCard}
              allowDrag={permissions.canEditContent}
            />
          )}
        </Box>

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <EditCardDialog
          selectedCard={selectedCard}
          editModalOpen={editModalOpen}
          setEditModalOpen={setEditModalOpen}
          editTabValue={editTabValue}
          setEditTabValue={setEditTabValue}
          rows={rows}
          setRows={setRows}
          users={users}
          boardMembers={boardMembers}
          lanes={lanes}
          checklistTemplates={checklistTemplates}
          inferStage={inferStage}
          addStatusEntry={addStatusEntry}
          updateStatusSummary={updateStatusSummary}
          handleTRNeuChange={handleTRNeuChange}
          saveCards={saveCards}
          patchCard={patchCard}
          idFor={idFor}
          setSelectedCard={setSelectedCard}
          canEdit={permissions.canEditContent}
          onDelete={deleteCardPermanently}
          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
        />
        <NewCardDialog
          newCardOpen={newCardOpen}
          setNewCardOpen={setNewCardOpen}
          cols={cols}
          lanes={lanes}
          rows={rows}
          setRows={setRows}
          users={users}
          boardMembers={boardMembers}
          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
        />
        <TRKPIPopup
          open={kpiPopupOpen}
          onClose={() => setKpiPopupOpen(false)}
          trLabel={customLabels.tr}
        />
        <TopTopicsDialog open={topTopicsOpen} onClose={() => setTopTopicsOpen(false)} />
        <ArchiveDialog archiveOpen={archiveOpen} setArchiveOpen={setArchiveOpen} archivedCards={archivedCards} restoreCard={restoreCard} deleteCardPermanently={deleteCardPermanently} />
      </Box >
    );
  });


export default OriginalKanbanBoard;