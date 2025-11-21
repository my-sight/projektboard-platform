'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { 
  Box, 
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  TextField,
  IconButton,
  Chip,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Badge,
  List,
  ListItem,
  ListItemText,
  Divider,
  InputAdornment,
} from '@mui/material';
import { DropResult } from '@hello-pangea/dnd';
import { Assessment, Close, Delete, Add, Done, Settings, Assignment, People, ArrowUpward, ArrowDownward, Edit } from '@mui/icons-material';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { KanbanCard } from './original/KanbanCard';
import { KanbanColumnsView, KanbanLaneView, KanbanSwimlaneView } from './original/KanbanViews';
import { ArchiveDialog, EditCardDialog, NewCardDialog } from './original/KanbanDialogs';
import { nullableDate, toBoolean } from '@/utils/booleans';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import { buildSupabaseAuthHeaders } from '@/lib/sessionHeaders';

// --- Typen & Helper ---

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
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
  openArchive: () => Promise<void>;
  openKpis: () => void;
}

interface OriginalKanbanBoardProps {
  boardId: string;
  onArchiveCountChange?: (count: number) => void;
  onKpiCountChange?: (count: number) => void;
}

const DEFAULT_COLS = [
  {id: "c1", name: "Werkzeug beim Werkzeugmacher", done: false},
  {id: "c2", name: "Werkzeugtransport", done: false},
  {id: "c3", name: "Werkzeug in Dillenburg", done: false},
  {id: "c4", name: "Werkzeug in Polen", done: false},
  {id: "c5", name: "Musterung", done: false},
  {id: "c6", name: "Teileversand", done: false},
  {id: "c7", name: "Teile vor Ort", done: false},
  {id: "c8", name: "Fertig", done: true}
];

// --- Komponente ---

const OriginalKanbanBoard = forwardRef<OriginalKanbanBoardHandle, OriginalKanbanBoardProps>(
function OriginalKanbanBoard({ boardId, onArchiveCountChange, onKpiCountChange }: OriginalKanbanBoardProps, ref) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  if (!supabase) {
    return <Box sx={{ p: 3 }}><SupabaseConfigNotice /></Box>;
  }

  // --- State ---
  const [viewMode, setViewMode] = useState<'columns' | 'swim' | 'lane'>('columns');
  const [density, setDensity] = useState<'compact' | 'xcompact' | 'large'>('compact');
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
  const [users, setUsers] = useState<any[]>([]);
  const [canModifyBoard, setCanModifyBoard] = useState(false);
  
  // Archiv & Meta
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedCards, setArchivedCards] = useState<any[]>([]);
  const [boardMeta, setBoardMeta] = useState<{ name: string; description?: string | null; updated_at?: string | null } | null>(null);
  
  // Dialogs
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [editTabValue, setEditTabValue] = useState(0);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [kpiPopupOpen, setKpiPopupOpen] = useState(false);
  
  // Settings (lokaler State für den Dialog)
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  
  // Checklisten Templates
  const [checklistTemplates, setChecklistTemplates] = useState<Record<string, string[]>>(() => {
    const templates: Record<string, string[]> = {};
    DEFAULT_COLS.forEach(col => {
      templates[col.name] = [ "Anforderungen prüfen", "Dokumentation erstellen", "Qualitätskontrolle" ];
    });
    return templates;
  });

  // --- Helper Functions ---

  const inferStage = useCallback((r: any) => {
    const s = (r["Board Stage"] || "").trim();
    const stages = cols.map(c => c.name);
    if (s && stages.includes(s)) return s;
    return stages[0];
  }, [cols]);

  const idFor = useCallback((r: any) => {
    if (r["UID"]) return String(r["UID"]);
    if (r.id) return String(r.id);
    if (r.card_id) return String(r.card_id);
    return [r["Nummer"], r["Teil"]].map(x => String(x || "").trim()).join(" | ");
  }, []);

  // ✅ NEU: Konvertiert DB-Zeile in Karten-Format (für Realtime & Load)
  const convertDbToCard = useCallback((item: any) => {
    const card = { ...(item.card_data || {}) };
    
    // IDs konsolidieren
    card.UID = card.UID || item.card_id || item.id;
    // Supabase ID für Updates sichern
    card.id = item.id; 
    card.card_id = item.card_id;

    // Stage/Position aus Spalten übernehmen
    if (item.stage) card["Board Stage"] = item.stage;
    if (item.position !== undefined && item.position !== null) {
       card.position = item.position;
       card.order = item.position; 
    }
    return card;
  }, []);

  const reindexByStage = useCallback((cards: any[]): any[] => {
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
  
  const updateArchivedState = useCallback((cards: any[]) => {
    setArchivedCards(cards);
    onArchiveCountChange?.(cards.length);
  }, [onArchiveCountChange]);

  // KPI Berechnung
  const calculateKPIs = useCallback(() => {
    const activeCards = rows.filter(card => card["Archived"] !== "1");
    const kpis: any = {
      totalCards: activeCards.length,
      trOverdue: [],
      trToday: [],
      trThisWeek: [],
      ampelGreen: 0,
      ampelRed: 0,
      ampelYellow: 0,
      lkEscalations: [],
      skEscalations: [],
      columnDistribution: {},
    };

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()), 23, 59, 59);
    
    activeCards.forEach(card => {
      const ampel = String(card.Ampel || '').toLowerCase();
      if (ampel === 'grün') kpis.ampelGreen++;
      else if (ampel === 'rot') kpis.ampelRed++;
      else if (ampel === 'gelb') kpis.ampelYellow++;

      const eskalation = String(card.Eskalation || '').toUpperCase();
      if (eskalation === 'LK') kpis.lkEscalations.push(card);
      if (eskalation === 'SK') kpis.skEscalations.push(card);

      const trDateStr = card['TR_Neu'] || card['TR_Datum'];
      const trCompleted = toBoolean(card['TR_Completed']);
      if (trDateStr && !trCompleted) {
        const trDate = nullableDate(trDateStr);
        if (trDate) {
          if (trDate < now) {
            kpis.trOverdue.push(card);
          } else if (trDate.toISOString().split('T')[0] === today) {
            kpis.trToday.push(card);
          } else if (trDate >= startOfWeek && trDate <= endOfWeek) {
            kpis.trThisWeek.push(card);
          }
        }
      }

      const stage = inferStage(card);
      kpis.columnDistribution[stage] = (kpis.columnDistribution[stage] || 0) + 1;
    });

    return kpis;
  }, [rows, inferStage]);
  
  const kpis = calculateKPIs();
  const kpiBadgeCount = useMemo(() => {
    return kpis.trOverdue.length + kpis.lkEscalations.length + kpis.skEscalations.length;
  }, [kpis]);

  useEffect(() => {
    onKpiCountChange?.(kpiBadgeCount);
  }, [kpiBadgeCount, onKpiCountChange]);

  // --- REALTIME SUBSCRIPTION (STEP 1) ---
  useEffect(() => {
    if (!supabase || !boardId) return;

    console.log('🔌 Starte Realtime-Verbindung für Board:', boardId);

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
          console.log('⚡ Realtime Event:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            const newCard = convertDbToCard(payload.new);
            setRows((prev) => {
              // Verhindere Duplikate, falls das Event durch eigenes Speichern kommt
              if (prev.some((r) => idFor(r) === idFor(newCard))) return prev;
              return reindexByStage([...prev, newCard]);
            });
          }

          if (payload.eventType === 'UPDATE') {
            const updatedCard = convertDbToCard(payload.new);
            setRows((prev) => {
               // Ist es eine archivierte Karte?
               const isArchived = updatedCard["Archived"] === "1";
               if (isArchived) {
                 // Aus aktiver Liste entfernen
                 return prev.filter(r => idFor(r) !== idFor(updatedCard));
               }
               
               // Karte aktualisieren oder hinzufügen, falls sie neu reingekommen ist (z.B. aus Archiv wiederhergestellt)
               const index = prev.findIndex(r => idFor(r) === idFor(updatedCard));
               if (index === -1) {
                 return reindexByStage([...prev, updatedCard]);
               }
               
               const newRows = [...prev];
               newRows[index] = updatedCard;
               // Wir sortieren hier nicht neu, um Springen während Drag&Drop anderer User zu vermeiden,
               // außer die Position hat sich drastisch geändert.
               return newRows; 
            });
            
            // Auch Archiv aktualisieren falls nötig
            if (updatedCard["Archived"] === "1") {
               updateArchivedState([...archivedCards.filter(c => idFor(c) !== idFor(updatedCard)), updatedCard]);
            }
          }

          if (payload.eventType === 'DELETE') {
            // Payload.old enthält nur die ID (wenn replica identity default ist)
            const deletedId = payload.old.id; 
            setRows((prev) => prev.filter((r) => r.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime: Verbunden!');
        }
      });

    return () => {
      console.log('🔌 Trenne Realtime-Verbindung...');
      supabase.removeChannel(channel);
    };
  }, [boardId, supabase, convertDbToCard, reindexByStage, idFor, updateArchivedState, archivedCards]);

  // --- API / Persistence ---

  const saveSettings = useCallback(async (options?: { skipMeta?: boolean }) => {
    if (!canModifyBoard) return false;

    try {
      const settings = {
        cols,
        lanes,
        checklistTemplates,
        viewMode,
        density,
        lastUpdated: new Date().toISOString(),
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
        alert(formatSupabaseActionError('Einstellungen speichern', payload?.error));
        return false;
      }
      
      const payload = await response.json().catch(() => ({}));
      if (payload.meta) {
        setBoardMeta(prev => ({ ...prev, ...payload.meta }));
        window.dispatchEvent(new CustomEvent('board-meta-updated', { detail: { id: boardId, name: payload.meta.name, description: payload.meta.description } }));
      }
      
      return true;
    } catch (error) {
      alert(formatSupabaseActionError('Einstellungen speichern', getErrorMessage(error)));
      return false;
    }
  }, [canModifyBoard, boardId, supabase, cols, lanes, checklistTemplates, viewMode, density, boardName, boardDescription, boardMeta]);

  const saveCards = useCallback(async () => {
    if (!canModifyBoard) return false;

    try {
      const cardsToSave = rows.map((card) => {
        const stage = inferStage(card);
        return {
          board_id: boardId,
          card_id: idFor(card),
          card_data: card,
          stage: stage,
          position: card.position ?? card.order ?? 0,
          project_number: card.Nummer || card['Nummer'] || null,
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
  }, [canModifyBoard, boardId, rows, supabase, inferStage, idFor]);

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
        const result = await supabase
          .from('kanban_cards')
          .select('card_data, id, card_id')
          .eq('board_id', boardId)
          .order('updated_at', { ascending: false }); 

        data = result.data;
        error = result.error;
      }
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        let loadedCards = data.map(convertDbToCard);

        const activeCards = loadedCards.filter(card => card["Archived"] !== "1");
        const archivedCards = loadedCards.filter(card => card["Archived"] === "1");

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
        updateArchivedState(archivedCards);
        return true;
      }
      
      setRows([]);
      updateArchivedState([]);
      return false;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Karten:', error);
      setRows([]);
      return false;
    }
  }, [boardId, supabase, updateArchivedState, inferStage, convertDbToCard]);

  // --- Initialisierung & Permissions ---

  const resolvePermissions = useCallback(async (loadedUsers: any[]) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) { 
        setCanModifyBoard(false); 
        return; 
      }

      const authUserId = data.user.id;
      const email = data.user.email ?? '';
      const profile = loadedUsers.find(user => user.id === authUserId);
      const globalRole = String(profile?.role ?? '').toLowerCase();
      const isSuper = isSuperuserEmail(email) || globalRole === 'superuser';
      
      // Wenn Global Admin: Darf alles
      if (isSuper || globalRole === 'admin') {
        setCanModifyBoard(true);
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
      
      // Für Phase A/B nutzen wir noch das einfache "canModifyBoard"
      // In Phase C wird das verfeinert
      setCanModifyBoard(isOwner || isBoardAdmin || isMember);

    } catch (error) {
      console.error('❌ Berechtigungsprüfung fehlgeschlagen:', error);
      setCanModifyBoard(false);
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
      const normalized = profiles
        .filter(profile => !isSuperuserEmail(profile.email))
        .filter(profile => profile.is_active)
        .map(profile => ({
          id: profile.id,
          email: profile.email ?? '',
          name: profile.full_name || (profile.email ? profile.email.split('@')[0] : 'Unbekannt'),
          full_name: profile.full_name || '',
          department: profile.company ?? null,
          company: profile.company || '',
          role: (profile.role || 'user') as string,
          isActive: profile.is_active,
        }));
      setUsers(normalized);
      return normalized;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Benutzer:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initializeBoard = async () => {
      if (!isMounted) return;
      await loadBoardMeta();
      const loadedUsers = await loadUsers();
      await resolvePermissions(loadedUsers);
      await loadSettings(); 
      await loadCards();
    };
    if (boardId) initializeBoard();
    return () => { isMounted = false; };
  }, [boardId]); 

  // Auto-Save Settings
  useEffect(() => {
    const timeoutId = setTimeout(() => { saveSettings({ skipMeta: true }); }, 1000);
    return () => clearTimeout(timeoutId);
  }, [cols, lanes, checklistTemplates, viewMode, density, saveSettings]);
  
  // Auto-Save Cards
  useEffect(() => {
    if (rows.length === 0) return;
    const timeoutId = setTimeout(() => { saveCards(); }, 2000); 
    return () => clearTimeout(timeoutId);
  }, [rows, saveCards]); 

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
    if (!window.confirm(`Karte "${card.Nummer} ${card.Teil}" wiederherstellen?`)) return;
    
    card["Archived"] = "";
    card["ArchivedDate"] = null;
    const updatedRows = reindexByStage([...rows, card]);
    setRows(updatedRows);
    updateArchivedState(archivedCards.filter(c => idFor(c) !== idFor(card)));
    await saveCards();
  };

  const deleteCardPermanently = async (card: any) => {
    if (!window.confirm(`Karte "${card.Nummer} ${card.Teil}" ENDGÜLTIG löschen?`)) return;
    if (!window.confirm('Diese Aktion kann nicht rückgängig gemacht werden. Wirklich löschen?')) return;
    
    try {
      const headers = await buildSupabaseAuthHeaders(supabase);
      const response = await fetch(`/api/boards/${boardId}/cards?cardId=${encodeURIComponent(idFor(card))}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(formatSupabaseActionError('Karte löschen', payload?.error));
        return;
      }

      updateArchivedState(archivedCards.filter(c => idFor(c) !== idFor(card)));
    } catch (error) {
      alert(formatSupabaseActionError('Karte löschen', getErrorMessage(error)));
    }
  };

  const archiveColumn = (columnName: string) => {
    if (!canModifyBoard) return;
    if (!window.confirm(`Alle Karten in "${columnName}" archivieren?`)) return;
    
    const updatedRows = rows.map(r => {
      if (inferStage(r) === columnName) {
        r["Archived"] = "1";
        r["ArchivedDate"] = new Date().toLocaleDateString('de-DE'); 
      }
      return r;
    }).filter(r => r["Archived"] !== "1"); 
    
    setRows(updatedRows);
    const newlyArchived = rows.filter(r => inferStage(r) === columnName && r["Archived"] === "1");
    updateArchivedState([...archivedCards, ...newlyArchived]);
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
    if (!canModifyBoard) return;
    
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

  // --- Drag & Drop Logic ---
  const onDragEnd = (result: DropResult) => {
    if (!canModifyBoard) return;
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const card = rows.find(r => idFor(r) === draggableId);
    if (!card) return;

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
    
    // Update Card Data
    movedCard["Board Stage"] = newStage;
    if (newResp !== null) movedCard["Verantwortlich"] = newResp;
    if (newLane !== null) movedCard["Swimlane"] = newLane;
    
    // Find Target Index
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
    
    // Status Ampel Logic
    const doneStageNames = cols.filter(c => c.done || /fertig/i.test(c.name)).map(c => c.name);
    if (doneStageNames.includes(newStage)) {
      movedCard["Ampel"] = "grün";
      movedCard["Eskalation"] = "";
    }
    
    const reindexed = reindexByStage(newRows);
    setRows(reindexed);
  };
  
  const renderCard = useCallback(
    (card: any, index: number) => (
      <KanbanCard
        key={idFor(card)}
        card={card}
        index={index}
        density={density}
        rows={rows}
        setRows={setRows}
        saveCards={saveCards}
        setSelectedCard={setSelectedCard}
        setEditModalOpen={setEditModalOpen}
        setEditTabValue={setEditTabValue}
        inferStage={inferStage}
        idFor={idFor}
        users={users}
        canModify={canModifyBoard}
      />
    ),
    [canModifyBoard, density, idFor, inferStage, rows, saveCards, setEditModalOpen, setEditTabValue, setRows, setSelectedCard, users]
  );
  
  const TRKPIPopup = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const distribution = Object.entries(kpis.columnDistribution).map(([name, count]) => ({ name, count: count as number }));
    distribution.sort((a, b) => {
        const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
        return pos(a.name) - pos(b.name);
    });
    
    const percentage = (count: number) => kpis.totalCards > 0 ? Math.round((count / kpis.totalCards) * 100) : 0;
    const isToday = kpis.trToday.length > 0;
    const isThisWeek = kpis.trThisWeek.length > 0;
    const isOverdue = kpis.trOverdue.length > 0;
    const hasEscalations = kpis.lkEscalations.length > 0 || kpis.skEscalations.length > 0;


    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" /> 
            Projekt-KPIs & Metriken
            <IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ height: '100%', backgroundColor: isOverdue ? '#ffebee' : '#f0f0f0' }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">Überfällige TRs</Typography>
                        <Typography variant="h4" color={isOverdue ? 'error.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                            {kpis.trOverdue.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Gesamt {kpis.totalCards} Karten</Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ height: '100%', backgroundColor: hasEscalations ? '#fff3e0' : '#f0f0f0' }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">Eskalationen</Typography>
                        <Typography variant="h4" color={hasEscalations ? 'warning.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                            {kpis.lkEscalations.length + kpis.skEscalations.length}
                        </Typography>
                         <Typography variant="caption" color="text.secondary">LK: {kpis.lkEscalations.length} / SK: {kpis.skEscalations.length}</Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Card variant="outlined" sx={{ height: '100%', backgroundColor: kpis.ampelGreen > 0 ? '#e8f5e8' : '#f0f0f0' }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">Ampel Grün</Typography>
                        <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                            {percentage(kpis.ampelGreen)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{kpis.ampelGreen} von {kpis.totalCards} Karten</Typography>
                    </CardContent>
                </Card>
            </Grid>
            
            <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 1, color: 'text.secondary' }}>Kartenverteilung (Stages)</Typography>
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
        <DialogActions><Button onClick={onClose} variant="outlined">Schließen</Button></DialogActions>
      </Dialog>
    );
  };

  const SettingsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const [currentCols, setCurrentCols] = useState(cols);
    const [currentLanes, setCurrentLanes] = useState(lanes);
    const [tab, setTab] = useState(0);
    const [newColName, setNewColName] = useState('');
    const [newLaneName, setNewLaneName] = useState('');

    useEffect(() => {
        if (open) {
            setCurrentCols(cols);
            setCurrentLanes(lanes);
        }
    }, [open, cols, lanes]);

    const handleSave = async () => {
        setCols(currentCols);
        setLanes(currentLanes);
        const success = await saveSettings();
        if (success) {
            onClose();
            loadCards(); 
        }
    };
    
    const handleMoveColumn = (id: string, direction: 'up' | 'down') => {
        const index = currentCols.findIndex(c => c.id === id);
        if (index === -1) return;

        const newCols = [...currentCols];
        const [removed] = newCols.splice(index, 1);
        
        let newIndex = index;
        if (direction === 'up' && index > 0) {
            newIndex = index - 1;
        } else if (direction === 'down' && index < newCols.length) {
            newIndex = index + 1;
        } else {
            return;
        }

        newCols.splice(newIndex, 0, removed);
        setCurrentCols(newCols);
    };

    const handleUpdateColumnName = (id: string, newName: string) => {
        setCurrentCols(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    };
    
    const handleAddColumn = () => {
        const trimmedName = newColName.trim();
        if (trimmedName && !currentCols.some(c => c.name === trimmedName)) {
            setCurrentCols([...currentCols, { id: `c${Date.now()}`, name: trimmedName, done: false }]);
            setNewColName('');
        }
    };

    const handleDeleteColumn = (id: string) => {
        if (window.confirm('WARNUNG: Das Löschen einer Spalte verschiebt alle darin enthaltenen Karten in die erste Spalte. Wirklich löschen?')) {
            setCurrentCols(currentCols.filter(c => c.id !== id));
        }
    };

    const handleToggleDone = (id: string) => {
        setCurrentCols(currentCols.map(c => c.id === id ? { ...c, done: !c.done } : c));
    }

    const handleAddLane = () => {
        const trimmedName = newLaneName.trim();
        if (trimmedName && !currentLanes.includes(trimmedName)) {
            setCurrentLanes([...currentLanes, trimmedName]);
            setNewLaneName('');
        }
    };

    const handleDeleteLane = (name: string) => {
        setCurrentLanes(currentLanes.filter(l => l !== name));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings color="primary" /> 
                Board Einstellungen
                <IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} sx={{ mb: 2 }}>
                    <Tab label="Meta-Daten" icon={<Assignment />} />
                    <Tab label="Spalten (Stages)" icon={<Done />} />
                    <Tab label="Swimlanes" icon={<People />} />
                </Tabs>

                {/* Tab 1: Meta-Daten */}
                {tab === 0 && (
                    <Box sx={{ pt: 1 }}>
                        <TextField label="Board-Name" value={boardName} onChange={(e) => setBoardName(e.target.value)} fullWidth sx={{ mt: 2 }} disabled={!canModifyBoard} />
                        <TextField label="Beschreibung" value={boardDescription} onChange={(e) => setBoardDescription(e.target.value)} fullWidth multiline rows={2} sx={{ mt: 2 }} disabled={!canModifyBoard} />
                    </Box>
                )}

                {/* Tab 2: Spalten-Verwaltung */}
                {tab === 1 && (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="subtitle1" gutterBottom color="text.secondary">Spalten (Stages) definieren</Typography>
                        <Card variant="outlined">
                            <List dense>
                                {currentCols.map((col, index) => (
                                    <ListItem key={col.id} disableGutters secondaryAction={
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <IconButton 
                                                size="small"
                                                onClick={() => handleMoveColumn(col.id, 'up')}
                                                disabled={!canModifyBoard || index === 0}
                                            >
                                                <ArrowUpward fontSize="small" />
                                            </IconButton>
                                            <IconButton 
                                                size="small"
                                                onClick={() => handleMoveColumn(col.id, 'down')}
                                                disabled={!canModifyBoard || index === currentCols.length - 1}
                                            >
                                                <ArrowDownward fontSize="small" />
                                            </IconButton>
                                            
                                            <Button size="small" onClick={() => handleToggleDone(col.id)} disabled={!canModifyBoard} sx={{ ml: 1, mr: 1, color: col.done ? 'success.main' : 'text.secondary', border: `1px solid ${col.done ? '#4caf50' : 'gray'}`, minWidth: '80px' }}>
                                                {col.done ? 'Fertig' : 'Normal'}
                                            </Button>
                                            <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteColumn(col.id)} disabled={!canModifyBoard || currentCols.length === 1}>
                                                <Delete />
                                            </IconButton>
                                        </Box>
                                    }>
                                        <TextField 
                                            value={col.name}
                                            onChange={(e) => handleUpdateColumnName(col.id, e.target.value)}
                                            variant="standard"
                                            size="small"
                                            fullWidth
                                            sx={{ mr: 2 }}
                                            disabled={!canModifyBoard}
                                            InputProps={{
                                                disableUnderline: true,
                                                startAdornment: <InputAdornment position="start"><Edit fontSize="small" sx={{ color: 'text.disabled', mr: 1 }}/></InputAdornment>
                                            }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Card>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <TextField size="small" label="Neue Spalte" value={newColName} onChange={(e) => setNewColName(e.target.value)} fullWidth disabled={!canModifyBoard} />
                            <Button variant="contained" startIcon={<Add />} onClick={handleAddColumn} disabled={!canModifyBoard}>Hinzufügen</Button>
                        </Box>
                    </Box>
                )}

                {/* Tab 3: Swimlanes/Lanes-Verwaltung */}
                {tab === 2 && (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="subtitle1" gutterBottom color="text.secondary">Swimlanes/Kategorien definieren</Typography>
                        <Card variant="outlined">
                            <List dense>
                                {currentLanes.map((lane, index) => (
                                    <ListItem key={index} disableGutters secondaryAction={
                                        <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteLane(lane)} disabled={!canModifyBoard}>
                                            <Delete />
                                        </IconButton>
                                    }>
                                        <ListItemText primary={lane} />
                                    </ListItem>
                                ))}
                            </List>
                        </Card>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <TextField size="small" label="Neue Swimlane" value={newLaneName} onChange={(e) => setNewLaneName(e.target.value)} fullWidth disabled={!canModifyBoard} />
                            <Button variant="contained" startIcon={<Add />} onClick={handleAddLane} disabled={!canModifyBoard}>Hinzufügen</Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Abbrechen</Button>
                <Button onClick={handleSave} variant="contained" disabled={!canModifyBoard}>Einstellungen speichern</Button>
            </DialogActions>
        </Dialog>
    );
  };
  
  useImperativeHandle(ref, () => ({
    openSettings: () => setSettingsOpen(true),
    openArchive: async () => { 
        await loadArchivedCards(); 
        setArchiveOpen(true); 
    },
    openKpis: () => setKpiPopupOpen(true),
  }), [loadArchivedCards]);

// --- Final Render ---

return (
    <Box sx={{ 
      height: 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg)',
      color: 'var(--ink)',
      // CSS Variables für Spaltenbreite und Layout
      '&': {
        '--colw': '300px',
        '--rowheadw': '260px'
      } as any
    }}>
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'linear-gradient(180deg,rgba(0,0,0,.05),transparent),var(--panel)',
        borderBottom: '1px solid var(--line)',
        p: 2
      }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1fr repeat(3, auto) repeat(3, auto) repeat(3, auto)', 
          gap: 1.5,
          alignItems: 'center',
          mt: 0
        }}>
          {/* Suchfeld */}
          <TextField size="small" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ minWidth: 220 }} />

          {/* Ansichtsmodi */}
          <Button variant={viewMode === 'columns' ? 'contained' : 'outlined'} onClick={() => setViewMode('columns')} sx={{ minWidth: 'auto', p: 1 }} title="Ansicht: Spalten">📊</Button>
          <Button variant={viewMode === 'swim' ? 'contained' : 'outlined'} onClick={() => setViewMode('swim')} sx={{ minWidth: 'auto', p: 1 }} title="Ansicht: Swimlanes (Verantwortlich)">👥</Button>
          <Button variant={viewMode === 'lane' ? 'contained' : 'outlined'} onClick={() => setViewMode('lane')} sx={{ minWidth: 'auto', p: 1 }} title="Ansicht: Swimlanes (Kategorie)">🏷️</Button>

          {/* Layout-Modi */}
          <Button variant={density === 'compact' ? 'contained' : 'outlined'} onClick={() => setDensity('compact')} sx={{ minWidth: 'auto', p: 1 }} title="Layout: kompakt">◼</Button>
          <Button variant={density === 'xcompact' ? 'contained' : 'outlined'} onClick={() => setDensity('xcompact')} sx={{ minWidth: 'auto', p: 1 }} title="Layout: extrakompakt">◻</Button>
          <Button variant={density === 'large' ? 'contained' : 'outlined'} onClick={() => setDensity('large')} sx={{ minWidth: 'auto', p: 1 }} title="Layout: groß">⬜</Button>         
          
          <Button variant="contained" size="small" onClick={() => setNewCardOpen(true)} disabled={!canModifyBoard}>Neue Karte</Button>
          
          <IconButton onClick={() => setSettingsOpen(true)} title="Board-Einstellungen">⚙️</IconButton>
          <Badge badgeContent={kpiBadgeCount} color="error" overlap="circular">
            <IconButton onClick={() => setKpiPopupOpen(true)} title="KPIs & Metriken"><Assessment fontSize="small" /></IconButton>
          </Badge>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'columns' && (
          <KanbanColumnsView rows={rows} cols={cols} density={density} searchTerm={searchTerm} onDragEnd={onDragEnd} inferStage={inferStage} archiveColumn={archiveColumn} renderCard={renderCard} allowDrag={canModifyBoard} />
        )}
        {viewMode === 'swim' && (
          <KanbanSwimlaneView rows={rows} cols={cols} searchTerm={searchTerm} onDragEnd={onDragEnd} inferStage={inferStage} renderCard={renderCard} allowDrag={canModifyBoard} />
        )}
        {viewMode === 'lane' && (
          <KanbanLaneView rows={rows} cols={cols} lanes={lanes} searchTerm={searchTerm} onDragEnd={onDragEnd} inferStage={inferStage} renderCard={renderCard} allowDrag={canModifyBoard} />
        )}
      </Box>

      {/* DIALOGE */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <EditCardDialog selectedCard={selectedCard} editModalOpen={editModalOpen} setEditModalOpen={setEditModalOpen} editTabValue={editTabValue} setEditTabValue={setEditTabValue} rows={rows} setRows={setRows} users={users} lanes={lanes} checklistTemplates={checklistTemplates} inferStage={inferStage} addStatusEntry={addStatusEntry} updateStatusSummary={updateStatusSummary} handleTRNeuChange={handleTRNeuChange} saveCards={saveCards} idFor={idFor} setSelectedCard={setSelectedCard} />
      <NewCardDialog newCardOpen={newCardOpen} setNewCardOpen={setNewCardOpen} cols={cols} lanes={lanes} rows={rows} setRows={setRows} users={users} />
      <ArchiveDialog archiveOpen={archiveOpen} setArchiveOpen={setArchiveOpen} archivedCards={archivedCards} restoreCard={restoreCard} deleteCardPermanently={deleteCardPermanently} />
      <TRKPIPopup open={kpiPopupOpen} onClose={() => setKpiPopupOpen(false)} />
    </Box>
  );
});

export default OriginalKanbanBoard;