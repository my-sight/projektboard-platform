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
  ArrowUpward, ArrowDownward, ArrowCircleRight, Inventory2
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { KanbanCard } from './original/KanbanCard';
import { KanbanColumnsView, KanbanLaneView, KanbanSwimlaneView } from './original/KanbanViews';
import { EditCardDialog, NewCardDialog, ArchiveDialog } from './original/KanbanDialogs';
import { KanbanSettingsDialog } from './original/KanbanSettingsDialog';
import { nullableDate, toBoolean } from '@/utils/booleans';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';

import { ProjectBoardCard, LayoutDensity, ViewMode } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const formatPocketBaseActionError = (action: string, error: any): string => {
  const message = error?.message || error?.toString();
  if (!message) return `${action} fehlgeschlagen: Unbekannter Fehler.`;
  const normalized = message.toLowerCase();

  if (error.status === 403 || normalized.includes('permission') || normalized.includes('allowed')) {
    return `${action} fehlgeschlagen: Fehlende Berechtigungen. Bitte prüfe, ob du Mitglied des Boards bist.`;
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
    // const supabase = useMemo(() => getSupabaseBrowserClient(), []); // Removed
    const { enqueueSnackbar } = useSnackbar();
    const { t } = useLanguage();
    const { user, profile } = useAuth(); // Use Auth Context

    // Removed SupabaseConfigNotice check

    const [viewMode, setViewMode] = useState<ViewMode>('columns');
    const [density, setDensity] = useState<LayoutDensity>('compact');
    const [searchTerm, setSearchTerm] = useState('');

    const [rows, setRows] = useState<ProjectBoardCard[]>([]);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
    const [users, setUsers] = useState<any[]>([]);
    const [boardMembers, setBoardMembers] = useState<any[]>([]);
    const [canModifyBoard, setCanModifyBoard] = useState(false);

    // Derived from AuthContext
    const currentUserName = profile?.full_name || user?.email || null;

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
    const [completedCount, setCompletedCount] = useState(0);

    const persistCompletedCount = async (count: number) => {
      setCompletedCount(count);
      try {
        const { data } = await supabase.from('kanban_boards').select('settings').eq('id', boardId).single();
        const currentSettings = data?.settings || {};
        await supabase.from('kanban_boards').update({
          settings: { ...currentSettings, completedCount: count }
        }).eq('id', boardId);
      } catch (e) {
        console.error('Failed to persist completed count', e);
      }
    };

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
      card.created_at = item.created;
      card.updated_at = item.updated;
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
        ampelGreen: 0,
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
        else if (ampel === 'grün') kpis.ampelGreen++;
        else kpis.ampelNeutral++;

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
    const distribution = useMemo(() => {
      const dist = Object.entries(kpis.columnDistribution).map(([name, count]) => ({ name, count: count as number }));
      dist.sort((a, b) => {
        const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
        return pos(a.name) - pos(b.name);
      });
      return dist;
    }, [kpis.columnDistribution]);
    const kpiBadgeCount = useMemo(() => {
      return kpis.trOverdue.length + kpis.yEscalations.length + kpis.rEscalations.length;
    }, [kpis]);

    useEffect(() => {
      onKpiCountChange?.(kpiBadgeCount);
    }, [kpiBadgeCount, onKpiCountChange]);

    const loadTopTopics = useCallback(async () => {
      try {
        const { data: records, error } = await supabase
          .from('board_top_topics')
          .select('*')
          .eq('board_id', boardId)
          .order('position', { ascending: true });

        if (error) throw error;
        setTopTopics(records as any[]);
      } catch (e) {
        console.error('Error loading top topics', e);
      }
    }, [boardId]);

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
        const myEmail = user?.email;

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
    }, [rows, searchTerm, filters, currentUserName]);

    useEffect(() => {
      if (!boardId) return;

      // Supabase Realtime
      const channel = supabase
        .channel(`kanban_cards_${boardId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'kanban_cards', filter: `board_id=eq.${boardId}` },
          (payload) => {
            // Handle changes
            const { eventType, new: newRecord, old: oldRecord } = payload;

            if (eventType === 'INSERT') {
              const newCard = convertDbToCard(newRecord);
              setRows((prev) => {
                if (prev.some((r) => idFor(r) === idFor(newCard))) return prev;
                return reindexByStage([...prev, newCard]);
              });
            } else if (eventType === 'UPDATE') {
              const updatedCard = convertDbToCard(newRecord);
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
            } else if (eventType === 'DELETE') {
              const deletedId = oldRecord.id;
              setRows((prev) => prev.filter((r) => r.id !== deletedId));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [boardId, convertDbToCard, reindexByStage, idFor]);

    const patchCard = useCallback(async (card: ProjectBoardCard, changes: Partial<ProjectBoardCard>) => {
      if (!permissions.canEditContent) {
        enqueueSnackbar(t('kanban.noPermission'), { variant: 'error' });
        return;
      }

      // Optimistic Update
      const updatedRows = rows.map(r => {
        if (idFor(r) === idFor(card)) { return { ...r, ...changes } as ProjectBoardCard; }
        return r;
      });
      setRows(updatedRows);

      if (selectedCard && idFor(selectedCard) === idFor(card)) {
        setSelectedCard(prev => prev ? ({ ...prev, ...changes } as ProjectBoardCard) : null);
      }

      try {
        const cardId = card.id;
        if (!cardId) throw new Error("Card ID missing");

        const fullUpdatedCard = { ...card, ...changes };

        const updateData: any = {
          card_data: fullUpdatedCard
        };
        // Map top-level columns
        if (changes['Board Stage']) updateData.stage = changes['Board Stage'];
        if (changes.position !== undefined) updateData.position = changes.position;

        const { error } = await supabase
          .from('kanban_cards')
          .update(updateData)
          .eq('id', cardId);

        if (error) throw error;

      } catch (error) {
        console.error('Patch error:', error);
        enqueueSnackbar(t('kanban.networkError'), { variant: 'error' });
      }
    }, [permissions.canEditContent, rows, idFor, boardId, enqueueSnackbar, selectedCard, t]);



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

        const overrides = options?.settingsOverrides;

        // Detect column renaming and update cards locally AND in DB
        if (overrides?.cols && Array.isArray(overrides.cols)) {
          const newColsList = overrides.cols;
          const renames: { oldName: string, newName: string }[] = [];

          newColsList.forEach((newCol: any) => {
            const oldCol = cols.find(c => c.id === newCol.id);
            if (oldCol && oldCol.name !== newCol.name) {
              renames.push({ oldName: oldCol.name, newName: newCol.name });
            }
          });

          if (renames.length > 0) {
            // 1. Optimistic Local Update of Rows
            setRows(prevRows => prevRows.map(card => {
              const stage = inferStage(card);
              const rename = renames.find(r => r.oldName === stage);
              if (rename) {
                return { ...card, 'Board Stage': rename.newName, stage: rename.newName };
              }
              return card;
            }));

            // 2. DB Update (Async)
            // We don't await this blocking the UI update, but we await it for data consistency
            await Promise.all(renames.map(async ({ oldName, newName }) => {
              console.log(`Migrating cards from '${oldName}' to '${newName}'`);
              const { error: moveError } = await supabase
                .from('kanban_cards')
                .update({ stage: newName })
                .eq('board_id', boardId)
                .eq('stage', oldName);

              if (moveError) {
                console.error('Error migrating cards:', moveError);
              }
            }));
          }

          // 3. Update Columns State Locally
          setCols(newColsList);
        }

        if (overrides?.checklistTemplates) setChecklistTemplates(overrides.checklistTemplates);
        if (overrides?.trLabel && overrides?.sopLabel) setCustomLabels({ tr: overrides.trLabel, sop: overrides.sopLabel });

        const updateData: any = { settings };

        if (!options?.skipMeta) {
          const trimmedName = boardName.trim();
          if (!trimmedName && boardMeta?.name) {
            setBoardName(boardMeta.name);
            return false;
          }

          if (trimmedName !== (boardMeta?.name || '')) {
            updateData.name = trimmedName;
          }
          const descriptionValue = boardDescription.trim() ? boardDescription.trim() : null;
          if (descriptionValue !== (boardMeta?.description ?? null)) {
            updateData.description = descriptionValue;
          }
        }

        const { data: record, error } = await supabase
          .from('kanban_boards')
          .update(updateData)
          .eq('id', boardId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!record) {
          // enqueueSnackbar(formatPocketBaseActionError('Einstellungen speichern', { message: 'Not found' }), { variant: 'error' });
          console.warn('Board Settings save: Board not found or no permission (Row missing)');
          return false;
        }

        if (record.name || record.description) {
          setBoardMeta(prev => ({ ...prev, ...record }));
          window.dispatchEvent(new CustomEvent('board-meta-updated', { detail: { id: boardId, name: record.name, description: record.description } }));
        }

        if (!options?.skipMeta) {
          enqueueSnackbar(t('kanban.settingsSaved'), { variant: 'success' });
        }
        return true;
      } catch (error) {
        enqueueSnackbar(formatPocketBaseActionError('Einstellungen speichern', error), { variant: 'error' });
        return false;
      }
    }, [permissions.canManageSettings, boardId, cols, lanes, checklistTemplates, viewMode, density, boardName, boardDescription, boardMeta, enqueueSnackbar, t]);

    const saveCards = useCallback(async () => {
      if (!permissions.canEditContent) return false;

      try {
        // Using Promise.all for parallel updates
        const promises = rows.map(card => {
          // Check if card has an ID (if not, it shouldn't be here or handled differently, but rows usually have IDs)
          if (!card.id) return Promise.resolve();

          const stage = inferStage(card);
          const data = {
            card_data: card,
            stage: stage,
            position: card.position ?? card.order ?? 0,
            project_number: card.Nummer || null,
            project_name: card.Teil,
          };

          return supabase
            .from('kanban_cards')
            .update(data)
            .eq('id', card.id);
        });

        await Promise.all(promises);
        return true;
      } catch (error) {
        console.error('Karten speichern Fehler:', getErrorMessage(error));
        return false;
      }
    }, [permissions.canEditContent, rows, inferStage]);

    const handleCreateCard = useCallback(async (newCardData: any) => {
      console.log('handleCreateCard called', newCardData, permissions);
      if (!permissions.canEditContent) {
        console.warn('handleCreateCard: No permission');
        return false;
      }

      try {
        const payload = {
          board_id: boardId,
          card_id: crypto.randomUUID(),
          card_data: newCardData,
          stage: newCardData['Board Stage'],
          position: 0,
          project_number: newCardData.Nummer || null,
          project_name: newCardData.Teil || null
        };

        const { data, error } = await supabase
          .from('kanban_cards')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        // Update local state immediately
        const newCard = convertDbToCard(data);
        setRows(prev => [...prev, newCard]);

        enqueueSnackbar(t('kanban.cardCreated'), { variant: 'success' });
        return true;
      } catch (error) {
        console.error('Card create error:', error);
        enqueueSnackbar(formatPocketBaseActionError('Karte erstellen', error), { variant: 'error' });
        return false;
      }
    }, [permissions.canEditContent, boardId, enqueueSnackbar, t, convertDbToCard]);

    const loadSettings = useCallback(async () => {
      try {
        const { data: record } = await supabase
          .from('kanban_boards')
          .select('settings')
          .eq('id', boardId)
          .single();

        if (record?.settings) {
          const s = record.settings;
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
          if (s.completedCount) setCompletedCount(s.completedCount);
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    }, [boardId]);

    const loadCards = useCallback(async () => {
      try {
        const { data: records, error } = await supabase
          .from('kanban_cards')
          .select('*')
          .eq('board_id', boardId);

        if (error) throw error;

        if (records && records.length > 0) {
          let loadedCards = records.map(convertDbToCard);

          const activeCards = loadedCards.filter(card => card["Archived"] !== "1");

          activeCards.sort((a, b) => {
            // Primary Sort: Stage/Column position
            const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
            const stageA = inferStage(a);
            const stageB = inferStage(b);

            if (stageA !== stageB) {
              return pos(stageA) - pos(stageB);
            }
            // Secondary Sort: Position/Order within column
            const orderA = a.order ?? a.position ?? 1;
            const orderB = b.order ?? b.position ?? 1;

            if (orderA !== orderB) return orderA - orderB;

            // Tertiary Sort: Recently updated first (Fallback)
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeB - timeA;
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
    }, [boardId, inferStage, convertDbToCard]);

    // --- Initialisierung & Permissions ---

    const resolvePermissions = useCallback(async (loadedUsers: any[]) => {
      try {
        if (!user) {
          setCanModifyBoard(false);
          setPermissions({ canEditContent: false, canManageSettings: false, canManageAttendance: false });
          return;
        }

        const authUserId = user.id;
        const email = user.email ?? '';

        let userProfile = profile;
        // If profile not yet loaded (race condition), try find in loadedUsers
        if (!userProfile) {
          userProfile = loadedUsers.find((u: any) => u.id === authUserId);
        }

        const globalRole = String(userProfile?.role ?? '').toLowerCase();
        const isSuper = isSuperuserEmail(email) || globalRole === 'superuser' || email === 'admin@kanban.local';
        const isGlobalAdmin = isSuper || globalRole === 'admin';

        if (isGlobalAdmin) {
          setCanModifyBoard(true);
          setPermissions({ canEditContent: true, canManageSettings: true, canManageAttendance: true });
          return;
        }

        // Fetch board data for owner check
        let boardRow = null;
        try {
          const { data } = await supabase.from('kanban_boards').select('*').eq('id', boardId).single();
          boardRow = data;
        } catch (e) { /* ignore 404 */ }

        const isOwner = boardRow?.owner_id === authUserId;
        const isBoardAdmin = boardRow?.board_admin_id === authUserId;

        // Fetch member data
        let memberRow = null;
        try {
          const { data } = await supabase
            .from('board_members')
            .select('*')
            .eq('board_id', boardId)
            .eq('profile_id', authUserId)
            .single();
          memberRow = data;
        } catch (e) { /* ignore 404 */ }

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
    }, [boardId, user, profile]);

    const loadBoardMeta = useCallback(async () => {
      try {
        const { data } = await supabase.from('kanban_boards').select('*').eq('id', boardId).single();
        if (data) {
          setBoardMeta(data as any);
          setBoardName(data.name || '');
          setBoardDescription(data.description || '');
          return data;
        }
      } catch (e) { /* ignore */ }
      return null;
    }, [boardId]);

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
        const { data: membersData } = await supabase
          .from('board_members')
          .select('*')
          .eq('board_id', boardId);

        const memberIds = new Set(membersData?.map((m: any) => m.profile_id) || []);

        try {
          const { data: boardData } = await supabase.from('kanban_boards').select('owner_id, board_admin_id').eq('id', boardId).single();
          if (boardData) {
            if (boardData.owner_id) memberIds.add(boardData.owner_id);
            if (boardData.board_admin_id) memberIds.add(boardData.board_admin_id);
          }
        } catch (e) { /* ignore */ }

        const members = allProfiles.filter(u => memberIds.has(u.id));
        setBoardMembers(members);
      } catch (error) {
        console.error('Fehler beim Laden der Board-Mitglieder:', error);
      }
    }, [boardId]);



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
        const { data: records } = await supabase
          .from('kanban_cards')
          .select('*')
          .eq('board_id', boardId);

        if (!records) {
          updateArchivedState([]);
          return [];
        }

        const archived = records
          .map(convertDbToCard)
          .filter(card => card["Archived"] === "1");

        updateArchivedState(archived);
        return archived;
      } catch (error) {
        console.error('❌ Fehler beim Laden des Archivs:', error);
        updateArchivedState([]);
        return [];
      }
    }, [boardId, convertDbToCard, updateArchivedState]);

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
        const cardId = card.id;
        if (!cardId) throw new Error("Card ID missing");

        const { error } = await supabase.from('kanban_cards').delete().eq('id', cardId);
        if (error) throw error;

        setRows(prev => prev.filter(r => idFor(r) !== idFor(card)));
        setArchivedCards(prev => prev.filter(r => idFor(r) !== idFor(card)));

        enqueueSnackbar(t('kanban.cardDeleted'), { variant: 'success' });
      } catch (error) {
        enqueueSnackbar(formatPocketBaseActionError('Karte löschen', error), { variant: 'error' });
      }
    };

    const archiveColumn = async (columnName: string) => {
      if (!permissions.canEditContent) return;
      if (!window.confirm(t('kanban.archiveColumnConfirm').replace('{column}', columnName))) return;

      const cardsToArchive = rows.filter(r => inferStage(r) === columnName && r["Archived"] !== "1");
      if (cardsToArchive.length === 0) return;

      try {
        await Promise.all(cardsToArchive.map(c =>
          supabase.from('kanban_cards').update({
            card_data: { ...c, Archived: "1", ArchivedDate: new Date().toLocaleDateString('de-DE') }
          }).eq('id', c.id)
        ));

        await persistCompletedCount(completedCount + cardsToArchive.length);

        setRows(prev => prev.filter(r => inferStage(r) !== columnName));
        enqueueSnackbar(`${cardsToArchive.length} ${t('kanban.cardsArchived')}`, { variant: 'success' });
      } catch (e) {
        console.error(e);
        enqueueSnackbar(t('kanban.networkError'), { variant: 'error' });
      }
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

      // const authModel = pb.authStore.model; 
      // Use profile from closure or look up. 
      // But `profile` might be stale in callback if not in dep array?
      // `users` is in dep array (implicit in OriginalKanbanBoard scope if not memoized weirdly).
      // Let's use `currentUserName` or `profile` from scope.

      const currentUser = currentUserName || 'System'; // Using the derived name from line 108

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
            <Tooltip title={t('kanban.archive') || 'Archiv'}>
              <IconButton onClick={() => { loadArchivedCards(); setArchiveOpen(true); }}>
                <Inventory2 fontSize="small" />
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
              archiveColumn={archiveColumn}
              renderCard={renderCard}
              allowDrag={permissions.canEditContent}
              completedCount={completedCount}
            />
          )}
        </Box>

        <KanbanSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          cols={cols}
          setCols={setCols}
          checklistTemplates={checklistTemplates}
          setChecklistTemplates={setChecklistTemplates}
          customLabels={customLabels}
          setCustomLabels={setCustomLabels}
          boardName={boardName}
          setBoardName={setBoardName}
          boardDescription={boardDescription}
          setBoardDescription={setBoardDescription}
          canManageSettings={permissions.canManageSettings}
          onSave={saveSettings}
          loadCards={loadCards}
          onOpenArchive={() => {
            setSettingsOpen(false);
            setArchiveOpen(true);
            loadArchivedCards();
          }}
        />
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
          onCreate={handleCreateCard}
        />
        <TRKPIPopup
          open={kpiPopupOpen}
          onClose={() => setKpiPopupOpen(false)}
          trLabel={customLabels.tr}
          kpis={kpis}
          distribution={distribution}
          t={t}
        />
        <TopTopicsDialog
          open={topTopicsOpen}
          onClose={() => setTopTopicsOpen(false)}
          topTopics={topTopics}
          boardId={boardId}
          t={t}
        />
        <ArchiveDialog archiveOpen={archiveOpen} setArchiveOpen={setArchiveOpen} archivedCards={archivedCards} restoreCard={restoreCard} deleteCardPermanently={deleteCardPermanently} />
      </Box >
    );
  });



function TRKPIPopup({
  open,
  onClose,
  trLabel,
  kpis,
  distribution,
  t
}: {
  open: boolean;
  onClose: () => void;
  trLabel: string;
  kpis: any;
  distribution: any[];
  t: any;
}) {
  const idFor = (r: any) => {
    if (r["UID"]) return String(r["UID"]);
    if (r.id) return String(r.id);
    if (r.card_id) return String(r.card_id);
    return [r["Nummer"], r["Teil"]].map(x => String(x || "").trim()).join(" | ");
  };

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
                <Typography variant="h4" color={hasEscalations ? 'error.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                  {kpis.rEscalations.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">R: {kpis.rEscalations.length}</Typography>
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

function TopTopicsDialog({
  open,
  onClose,
  topTopics,
  boardId,
  t
}: {
  open: boolean;
  onClose: () => void;
  topTopics: TopTopic[];
  boardId: string;
  t: any;
}) {
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
    try {
      const { data, error } = await supabase.from('board_top_topics').insert({
        board_id: boardId,
        title: '',
        position: localTopics.length
      }).select().single();

      if (error || !data) throw error;

      // Adapt Record to TopTopic
      const newTopic: TopTopic = {
        id: data.id,
        title: data.title,
        position: data.position,
        due_date: data.due_date,
        calendar_week: data.calendar_week
      };
      setLocalTopics([...localTopics, newTopic]);
    } catch (e) {
      console.error(e);
    }
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

export default OriginalKanbanBoard;