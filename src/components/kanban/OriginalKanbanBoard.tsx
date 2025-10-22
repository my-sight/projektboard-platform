'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  List,
  ListItem,
  Badge, 
  Grid, 
  Card,
} from '@mui/material';
import { DropResult } from '@hello-pangea/dnd';
import { Assessment, Close } from '@mui/icons-material';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';
import { KanbanCard } from './original/KanbanCard';
import { KanbanColumnsView, KanbanLaneView, KanbanSwimlaneView } from './original/KanbanViews';
import { ArchiveDialog, EditCardDialog, NewCardDialog } from './original/KanbanDialogs';
import { nullableDate, toBoolean } from '@/utils/booleans';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
// import { useAuth } from '../../contexts/AuthContext';
// import { AuthProvider } from '../../contexts/AuthContext';
// import { LoginForm } from '../auth/LoginForm';

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

// Deine ursprünglichen Spalten
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

// Checklisten pro Phase
const DEFAULT_CHECKLISTS = {
  "Werkzeug beim Werkzeugmacher": [
    "Werkzeug-Zeichnung prüfen",
    "Material bestellt",
    "Bearbeitung gestartet"
  ],
  "Musterung": [
    "Muster produziert",
    "Qualitätsprüfung durchgeführt",
    "Freigabe erhalten"
  ],
  "Fertig": [
    "Dokumentation vollständig",
    "Übergabe erfolgt"
  ]
};

const OriginalKanbanBoard = forwardRef<OriginalKanbanBoardHandle, OriginalKanbanBoardProps>(
function OriginalKanbanBoard({ boardId, onArchiveCountChange, onKpiCountChange }: OriginalKanbanBoardProps, ref) {
  // State für Benutzer
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  if (!supabase) {
    return (
      <Box sx={{ p: 3 }}>
        <SupabaseConfigNotice />
      </Box>
    );
  }

  const [viewMode, setViewMode] = useState<'columns' | 'swim' | 'lane'>('columns');
  const [density, setDensity] = useState<'compact' | 'xcompact' | 'large'>('compact');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'' | 'due' | 'number'>('');
  const [rows, setRows] = useState<any[]>([]);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
  const [users, setUsers] = useState<any[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedCards, setArchivedCards] = useState<any[]>([]);
  const [boardMeta, setBoardMeta] = useState<{
    name: string;
    description?: string | null;
    updated_at?: string | null;
  } | null>(null);
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');

  const updateArchivedState = useCallback((cards: any[]) => {
    setArchivedCards(cards);
    onArchiveCountChange?.(cards.length);
  }, [onArchiveCountChange]);


  // --- helper: re-index order inside each Board Stage (column) ---
  function reindexByStage(cards: any[]) {
  const byStage: Record<string, number> = {};
  return cards.map((c: any) => {
    const stage = c["Board Stage"];
    byStage[stage] = (byStage[stage] ?? 0) + 1;
    return { ...c, order: byStage[stage] };
  });
}

// Dialog States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [kpiPopupOpen, setKpiPopupOpen] = useState(false);

  const kpiBadgeCount = useMemo(() => {
    return rows.filter(card => {
      const trDate = card['TR_Neu'] || card['TR_Datum'];
      if (!trDate) return false;
      const tr = new Date(trDate);
      return tr < new Date() && card['Archived'] !== '1';
    }).length;
  }, [rows]);

  useEffect(() => {
    onKpiCountChange?.(kpiBadgeCount);
  }, [kpiBadgeCount, onKpiCountChange]);

 // Checklisten Templates State - SPALTENSPEZIFISCH
  const [checklistTemplates, setChecklistTemplates] = useState(() => {
  const templates: Record<string, string[]> = {};
  cols.forEach(col => {
    templates[col.name] = [
      "Anforderungen prüfen",
      "Dokumentation erstellen", 
      "Qualitätskontrolle"
    ];
  });
  return templates;
  });

// ✅ KORRIGIERTE BENUTZER-LADUNG - BASIEREND AUF DEINER PROFILES STRUKTUR
const loadUsers = async () => {
  try {
    const profiles = await fetchClientProfiles();

    if (profiles.length) {
      const normalized = profiles.map(profile => {
        const email = profile.email ?? '';
        const fallbackName = email ? email.split('@')[0] : 'Unbekannt';
        const isActive = profile.is_active ?? true;

        return {
          id: profile.id,
          email,
          name: profile.full_name || fallbackName || 'Unbekannt',
          full_name: profile.full_name || '',
          department: profile.company ?? null,
          company: profile.company || '',
          role: profile.role || 'user',
          isActive,
        };
      });

      const visibleUsers = normalized.filter(user => {
        if (isSuperuserEmail(user.email)) {
          return false;
        }

        return user.isActive;
      });
      setUsers(visibleUsers);
      return true;
    }

    createFallbackUsers();
    return false;
  } catch (error) {
    console.error('❌ Fehler beim Laden der Benutzer:', error);
    createFallbackUsers();
    return false;
  }
};
// ✅ ERWEITERTE FALLBACK-BENUTZER (basierend auf deiner Struktur)
const createFallbackUsers = () => {
  console.log('🔄 Erstelle Fallback-Benutzer...');
  const fallbackUsers = [
    {
      id: 'fallback-1',
      email: 'test@test.de',
      name: 'Test User',
      full_name: 'Test User',
      department: 'Test Company',
      company: 'Test Company',
      role: 'user',
      isActive: true
    },
    {
      id: 'fallback-2',
      email: 'michael@mysight.net',
      name: 'Michael',
      full_name: 'Michael',
      department: 'MySight',
      company: 'MySight',
      role: 'admin',
      isActive: true
    },
    {
      id: 'fallback-3',
      email: 'max.mustermann@firma.de',
      name: 'Max Mustermann',
      full_name: 'Max Mustermann',
      department: 'Firma GmbH',
      company: 'Firma GmbH',
      role: 'user',
      isActive: true
    },
    {
      id: 'fallback-4',
      email: 'anna.klein@firma.de',
      name: 'Anna Klein',
      full_name: 'Anna Klein',
      department: 'Firma GmbH',
      company: 'Firma GmbH',
      role: 'user',
      isActive: true
    }
  ];
  const visibleFallbackUsers = fallbackUsers.filter(user => !isSuperuserEmail(user.email));
  setUsers(visibleFallbackUsers);
  console.log('✅ Fallback-Benutzer erstellt:', visibleFallbackUsers.length);
};

const loadBoardMeta = async () => {
  try {
    console.log('📋 Lade Board-Metadaten...');
    const { data, error } = await supabase
      .from('kanban_boards')
      .select('name, description, updated_at')
      .eq('id', boardId)
      .maybeSingle();

    if (error) {
      console.error('❌ Fehler beim Laden der Board-Metadaten:', error);
      return null;
    }

    if (data) {
      setBoardMeta(data);
      setBoardName(data.name || '');
      setBoardDescription(data.description || '');
      return data;
    }

    return null;
  } catch (error) {
    console.error('❌ Unerwarteter Fehler bei Board-Metadaten:', error);
    return null;
  }
};


// ✅ WICHTIG: KORRIGIERTE INITIALISIERUNG - BENUTZER ZUERST LADEN!
useEffect(() => {
  const initializeBoard = async () => {
    console.log('🚀 Initialisiere Kanban Board für boardId:', boardId);

    console.log('📋 Lade Boardinformationen...');
    await loadBoardMeta();

    // 1. ZUERST Benutzer laden (WICHTIG!)
    console.log('👥 Lade Benutzer...');
    await loadUsers();
    
    // 2. Dann Einstellungen laden
    console.log('⚙️ Lade Einstellungen...');
    const settingsLoaded = await loadSettings();
    console.log('⚙️ Einstellungen geladen:', settingsLoaded);
    
    // 3. Dann Karten laden
    console.log('📋 Lade Karten...');
    const cardsLoaded = await loadCards();
    console.log('📋 Karten geladen:', cardsLoaded);
    
    if (!cardsLoaded) {
      console.log('📝 Board ist leer - bereit für neue Karten');
    }
    
    console.log('✅ Board komplett initialisiert!');
  };
  
  if (boardId) {
    initializeBoard();
  }
}, [boardId]);

// Auto-Update Checklisten Templates wenn Spalten sich ändern
useEffect(() => {
  const newTemplates = { ...checklistTemplates };
  let hasChanges = false;
  
  // Neue Spalten hinzufügen
  cols.forEach(col => {
    if (!newTemplates[col.name]) {
      newTemplates[col.name] = [
        "Anforderungen prüfen",
        "Dokumentation erstellen", 
        "Qualitätskontrolle"
      ];
      hasChanges = true;
    }
  });
  
  // Entfernte Spalten löschen
  Object.keys(newTemplates).forEach(templateName => {
    if (!cols.find(col => col.name === templateName)) {
      delete newTemplates[templateName];
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    setChecklistTemplates(newTemplates);
  }
}, [cols]);

  // Edit Modal Tab State
const [editTabValue, setEditTabValue] = useState(0);

// 👇 HIER HINZUFÜGEN (nach Zeile 133):
// Einstellungen in Supabase speichern - MIT DEBUGGING
const saveSettings = async (options?: { skipMeta?: boolean }) => {
  try {
    console.log('🔄 Starte Speichern der Einstellungen...');

    const settings = {
      cols,
      lanes,
      checklistTemplates,
      viewMode,
      density,
      lastUpdated: new Date().toISOString()
    };

    console.log('📦 Einstellungen zu speichern:', settings);

    const { error } = await supabase
      .from('kanban_board_settings')
      .upsert({
        board_id: boardId,
        user_id: null,
        settings,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Supabase Fehler:', error);
      alert(`Fehler: ${getErrorMessage(error)}`);
      return false;
    }

    if (options?.skipMeta) {
      return true;
    }

    const trimmedName = boardName.trim();
    const trimmedDescription = boardDescription.trim();

    if (!trimmedName) {
      alert('Board-Name darf nicht leer sein.');
      if (boardMeta?.name) {
        setBoardName(boardMeta.name);
      }
      return false;
    }

    const metaUpdates: Record<string, any> = {};

    if (!boardMeta || trimmedName !== (boardMeta.name || '')) {
      metaUpdates.name = trimmedName;
    }

    if (!boardMeta || trimmedDescription !== (boardMeta.description || '')) {
      metaUpdates.description = trimmedDescription ? trimmedDescription : null;
    }

    if (Object.keys(metaUpdates).length) {
      const { data: updatedBoard, error: boardError } = await supabase
        .from('kanban_boards')
        .update(metaUpdates)
        .eq('id', boardId)
        .select('name, description, updated_at')
        .maybeSingle();

      if (boardError) {
        console.error('❌ Fehler beim Aktualisieren des Boards:', boardError);
        alert(`Board-Update fehlgeschlagen: ${boardError.message}`);
        return false;
      }

      if (updatedBoard) {
        setBoardMeta(updatedBoard);
        setBoardName(updatedBoard.name || '');
        setBoardDescription(updatedBoard.description || '');

        window.dispatchEvent(
          new CustomEvent('board-meta-updated', {
            detail: {
              id: boardId,
              name: updatedBoard.name,
              description: updatedBoard.description,
            },
          }),
        );
      } else {
        const fallbackMeta = {
          name: trimmedName,
          description: trimmedDescription ? trimmedDescription : null,
          updated_at: boardMeta?.updated_at || null,
        };
        setBoardMeta(fallbackMeta);
        setBoardName(trimmedName);
        setBoardDescription(trimmedDescription);

        window.dispatchEvent(
          new CustomEvent('board-meta-updated', {
            detail: {
              id: boardId,
              name: trimmedName,
              description: trimmedDescription || null,
            },
          }),
        );
      }
    } else {
      setBoardName(trimmedName);
      setBoardDescription(trimmedDescription);
    }

    console.log('✅ Einstellungen und Board-Metadaten gespeichert');
    return true;
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
    alert(`Unerwarteter Fehler: ${getErrorMessage(error)}`);
    return false;
  }
};


// Einstellungen aus Supabase laden - MIT DEBUGGING
const loadSettings = async () => {
  try {
    console.log('🔄 Lade Einstellungen...');
    
    const { data, error } = await supabase
      .from('kanban_board_settings')
      .select('settings')
      .eq('board_id', boardId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ Keine gespeicherten Einstellungen gefunden');
        return false;
      }
      console.error('❌ Fehler beim Laden:', error);
      return false;
    }

    if (data?.settings) {
      const settings = data.settings;
      console.log('✅ Einstellungen geladen:', settings);
      
      if (settings.cols) setCols(settings.cols);
      if (settings.lanes) setLanes(settings.lanes);
      if (settings.checklistTemplates) setChecklistTemplates(settings.checklistTemplates);
      if (settings.viewMode) setViewMode(settings.viewMode);
      if (settings.density) setDensity(settings.density);
      
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Unerwarteter Fehler beim Laden:', error);
    return false;
  }
};



// EINFACHE LÖSUNG: DELETE + INSERT (funktioniert immer)
const saveCards = async () => {
  try {
    console.log('💾 Speichere Karten (DELETE + INSERT)...');
    console.log('🔥 DEBUG: rows.length =', rows.length);
    console.log('🔥 DEBUG: boardId =', boardId);
    
    // SCHRITT 1: Alle alten Karten für dieses Board löschen
    console.log('🗑️ Lösche alte Karten...');
    const { error: deleteError } = await supabase
      .from('kanban_cards')
      .delete()
      .eq('board_id', boardId);
    
    if (deleteError) {
      console.error('❌ Fehler beim Löschen:', deleteError);
      alert(`Löschen fehlgeschlagen: ${deleteError.message}`);
      return false;
    }
    
    console.log('✅ Alte Karten gelöscht');
    
    // Falls keine Karten vorhanden, fertig
    if (rows.length === 0) {
      console.log('ℹ️ Keine neuen Karten zu speichern');
      return true;
    }
    
    // SCHRITT 2: Neue Karten vorbereiten
    const cardsWithPositions: any[] = [];
    const stagePositions: Record<string, number> = {};
    
    rows.forEach((card, globalIndex) => {
      const stage = card["Board Stage"] || DEFAULT_COLS[0].name;
      
      if (!stagePositions[stage]) {
        stagePositions[stage] = 0;
      }
      
      const position = stagePositions[stage];
      stagePositions[stage]++;
      
      card.position = position;
      
      const cardToSave = {
        board_id: boardId,
        card_id: idFor(card),
        card_data: card,
        stage: stage,
        position: position,
        project_number: card.Nummer || card["Nummer"] || null,
        project_name: card.Teil,
        updated_at: new Date().toISOString()
      };
      
      console.log(`🔥 DEBUG: Karte ${globalIndex}:`, {
        nummer: card.Nummer,
        stage: stage,
        position: position
      });
      
      cardsWithPositions.push(cardToSave);
    });

    console.log('💾 Füge neue Karten ein:', cardsWithPositions.length);

    // SCHRITT 3: Neue Karten einfügen
    const { error: insertError } = await supabase
      .from('kanban_cards')
      .insert(cardsWithPositions);

    if (insertError) {
      console.error('❌ Fehler beim Einfügen:', insertError);
      alert(`Einfügen fehlgeschlagen: ${insertError.message}`);
      return false;
    }

    console.log('✅ Karten erfolgreich gespeichert');
    return true;
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error);
    alert(`Unerwarteter Fehler: ${getErrorMessage(error)}`);
    return false;
  }
};

// 2. ARCHIV LADEN FUNKTION:
const loadArchivedCards = useCallback(async () => {
  try {
    console.log('🗃️ Lade archivierte Karten...');

    const { data, error } = await supabase
      .from('kanban_cards')
      .select('card_data')
      .eq('board_id', boardId);

    if (error) throw error;

    if (data && data.length > 0) {
      const archived = data
        .map(item => item.card_data)
        .filter(card => card["Archived"] === "1");

      console.log('🗃️ Archivierte Karten gefunden:', archived.length);
      updateArchivedState(archived);
      return archived;
    }

    updateArchivedState([]);
    return [];
  } catch (error) {
    console.error('❌ Fehler beim Laden des Archivs:', error);
    updateArchivedState([]);
    return [];
  }
}, [boardId, updateArchivedState]);

useImperativeHandle(ref, () => ({
  openSettings: () => setSettingsOpen(true),
  openArchive: async () => {
    await loadArchivedCards();
    setArchiveOpen(true);
  },
  openKpis: () => setKpiPopupOpen(true),
}), [loadArchivedCards]);

// 3. KARTE AUS ARCHIV WIEDERHERSTELLEN:
const restoreCard = async (card: any) => {
  if (!window.confirm(`Karte "${card.Nummer} ${card.Teil}" wiederherstellen?`)) {
    return;
  }
  
  try {
    // Entferne Archived Flag
    card["Archived"] = "";
    
    // Füge zur aktuellen rows hinzu
    const updatedRows = [...rows, card];
    setRows(updatedRows);
    
    // Entferne aus archivierten Karten
    const updatedArchived = archivedCards.filter(c => idFor(c) !== idFor(card));
    updateArchivedState(updatedArchived);
    
    // Speichere Änderungen
    await saveCards();
    
    console.log('✅ Karte wiederhergestellt:', card.Nummer);
  } catch (error) {
    console.error('❌ Fehler beim Wiederherstellen:', error);
  }
};

// 4. KARTE ENDGÜLTIG LÖSCHEN:
const deleteCardPermanently = async (card: any) => {
  if (!window.confirm(`Karte "${card.Nummer} ${card.Teil}" ENDGÜLTIG löschen?`)) {
    return;
  }
  
  if (!window.confirm('Diese Aktion kann nicht rückgängig gemacht werden. Wirklich löschen?')) {
    return;
  }
  
  try {
    // Entferne aus Supabase
    const { error } = await supabase
      .from('kanban_cards')
      .delete()
      .eq('board_id', boardId)
      .eq('card_id', idFor(card));
    
    if (error) throw error;
    
    // Entferne aus lokaler Liste
    const updatedArchived = archivedCards.filter(c => idFor(c) !== idFor(card));
    updateArchivedState(updatedArchived);
    
    console.log('🗑️ Karte endgültig gelöscht:', card.Nummer);
  } catch (error) {
    console.error('❌ Fehler beim endgültigen Löschen:', error);
  }
};




// ANGEPASSTE loadCards (funktioniert mit stage/position oder ohne)
const loadCards = async () => {
  try {
    console.log('🔄 Lade Karten aus Supabase...');
    console.log('🔥 DEBUG: boardId =', boardId);
    
    // Versuche mit stage/position zu laden
    let data: any[] | null = null;
    let error: any = null;

    const primaryResult = await supabase
      .from('kanban_cards')
      .select('card_data, stage, position')
      .eq('board_id', boardId)
      .order('stage', { ascending: true })
      .order('position', { ascending: true });

    data = primaryResult.data;
    error = primaryResult.error;
    
    // Falls stage/position nicht existieren, lade nur card_data
    if (error instanceof Error && error.message.includes('column')) {
      console.log('⚠️ stage/position Spalten nicht gefunden, lade nur card_data');
      const result = await supabase
        .from('kanban_cards')
        .select('card_data')
        .eq('board_id', boardId)
        .order('updated_at', { ascending: false });

      data = result.data as any[] | null;
      error = result.error;
    }
    
    console.log('🔥 DEBUG: Supabase Antwort:', { dataLength: data?.length, error });
    
    if (error) {
      console.error('🔥 DEBUG: Supabase Fehler:', error);
      throw error;
    }
    
    if (data && data.length > 0) {
      const loadedCards = data.map(item => {
        const card = item.card_data;
        // Setze Position falls vorhanden
        if (item.position !== undefined) {
          card.position = item.position;
        }
        return card;
      });
      
      console.log('✅ Karten geladen:', loadedCards.length);
      loadedCards.forEach(card => {
        console.log(`📋 ${card.Nummer}: ${card["Board Stage"]} (Pos: ${card.position || 'N/A'})`);
      });
      
      setRows(loadedCards);
      return true;
    }
    
    console.log('ℹ️ Keine Karten gefunden - leeres Board');
    setRows([]);
    return false;
  } catch (error) {
    console.error('❌ Fehler beim Laden:', error);
    setRows([]);
    return false;
  }
};






// KORRIGIERTE INITIALISIERUNG - OHNE AUTOMATISCHE TESTDATEN:
useEffect(() => {
  const initializeBoard = async () => {
    console.log('🚀 Initialisiere Kanban Board für boardId:', boardId);

    await loadBoardMeta();

    // Erst Einstellungen laden
    const settingsLoaded = await loadSettings();
    console.log('⚙️ Einstellungen geladen:', settingsLoaded);
    
    // Dann Karten laden
    const cardsLoaded = await loadCards();
    console.log('📋 Karten geladen:', cardsLoaded);
    
    // ✅ KEINE AUTOMATISCHEN TESTDATEN MEHR!
    // Wenn keine Karten vorhanden, bleibt das Board leer
    if (!cardsLoaded) {
      console.log('📝 Board ist leer - bereit für neue Karten');
    }
    
    console.log('✅ Board komplett initialisiert!');
  };
  
  if (boardId) {
    initializeBoard();
  }
}, [boardId]);



// Automatisches Speichern bei Änderungen
useEffect(() => {
  if (rows.length === 0) return; // Nicht speichern wenn noch keine Daten geladen
  
  const timeoutId = setTimeout(() => {
    console.log('💾 Auto-Speichere Karten...');
    saveCards();
  }, 2000); // Speichere nach 2 Sekunden Inaktivität

  return () => clearTimeout(timeoutId);
}, [rows]);

// Automatisches Speichern der Einstellungen
useEffect(() => {
  const timeoutId = setTimeout(() => {
    console.log('⚙️ Auto-Speichere Einstellungen...');
    saveSettings({ skipMeta: true });
  }, 1000);

  return () => clearTimeout(timeoutId);
}, [cols, lanes, checklistTemplates, viewMode, density]);

useEffect(() => {
  if (!users.length || !rows.length) return;

  const userMap = new Map(
    users
      .filter((user: any) => user && user.id)
      .map((user: any) => [String(user.id), user]),
  );

  let hasChanges = false;

  const normalizedRows = rows.map((card: any) => {
    if (!Array.isArray(card.Team) || card.Team.length === 0) {
      return card;
    }

    let cardChanged = false;

    const updatedTeam = card.Team.map((member: any) => {
      if (!member || !member.userId) {
        return member;
      }

      const lookup = userMap.get(String(member.userId));
      if (!lookup) {
        return member;
      }

      const resolvedName = (lookup.full_name || lookup.name || '').trim();
      const fallbackEmail = lookup.email || member.email || '';
      const displayName = resolvedName || (fallbackEmail ? fallbackEmail.split('@')[0] : 'Unbekannt');
      const department = lookup.department || lookup.company || member.department || member.company || '';
      const email = fallbackEmail;

      if (member.name !== displayName || member.department !== department || member.email !== email) {
        cardChanged = true;
        return {
          ...member,
          name: displayName,
          department,
          email,
        };
      }

      return member;
    });

    if (cardChanged) {
      hasChanges = true;
      return { ...card, Team: updatedTeam };
    }

    return card;
  });

  if (hasChanges) {
    setRows(normalizedRows);
  }
}, [rows, users]);


  const loadTestData = () => {
    const testCards = [
      {
        "Nummer": "A-24-001",
        "Teil": "Gehäuse Vorderseite",
        "Board Stage": "Werkzeug beim Werkzeugmacher",
        "Status Kurz": "Werkzeug in Bearbeitung",
        "Verantwortlich": "Max Mustermann",
        "Due Date": "2024-02-15",
        "Ampel": "grün",
        "Swimlane": "Projekt A",
        "UID": "uid1",
        "StatusHistory": [
          {
            date: "15.01.2024",
            message: { text: "Werkzeug in Bearbeitung", escalation: false },
            qualitaet: { text: "Qualität OK", escalation: false },
            kosten: { text: "", escalation: false },
            termine: { text: "Termin eingehalten", escalation: false }
          }
        ],
        "ChecklistDone": {
        "Werkzeug beim Werkzeugmacher": {
        "Werkzeug-Zeichnung prüfen": true,
        "Material bestellt": true, 
        "Bearbeitung gestartet": false
      }
    }   

      },
      {
        "Nummer": "A-24-002", 
        "Teil": "Gehäuse Rückseite",
        "Board Stage": "Werkzeugtransport",
        "Status Kurz": "Transport läuft",
        "Verantwortlich": "Anna Klein",
        "Due Date": "2024-01-20",
        "Ampel": "rot",
        "Eskalation": "LK",
        "Swimlane": "Projekt A",
        "UID": "uid2",
        "StatusHistory": [
          {
            date: "20.01.2024",
            message: { text: "Transport verzögert", escalation: true },
            qualitaet: { text: "", escalation: false },
            kosten: { text: "Mehrkosten durch Express", escalation: true },
            termine: { text: "2 Tage Verzug", escalation: true }
          }
        ]
      },
    ];
    setRows(testCards);
  };

  // Deine ursprünglichen Hilfsfunktionen
  const inferStage = (r: any) => {
    const s = (r["Board Stage"] || "").trim();
    const stages = cols.map(c => c.name);
    if (s && stages.includes(s)) return s;
    return stages[0];
  };

  const idFor = (r: any) => {
    if (r["UID"]) return String(r["UID"]);
    return [r["Nummer"], r["Teil"]].map(x => String(x || "").trim()).join(" | ");
  };

  const getPriorityColor = (ampel: string) => {
    if (ampel?.toLowerCase().startsWith('rot')) return '#ff5a5a';
    return '#14c38e';
  };

const calculateKPIs = () => {
  const activeCards = rows.filter(r => !r["Archived"]);
  
  // === GRUNDLEGENDE ZAHLEN ===
  const totalCards = activeCards.length;
  const ampelGreen = activeCards.filter(r => String(r["Ampel"] || "").toLowerCase().includes("grÃ¼n") || String(r["Ampel"] || "").toLowerCase().includes("green")).length;
  const ampelRed = activeCards.filter(r => String(r["Ampel"] || "").toLowerCase().includes("rot") || String(r["Ampel"] || "").toLowerCase().includes("red")).length;
  
  // === SPALTEN-VERTEILUNG ===
  const columnDistribution: Record<string, number> = {};
  cols.forEach(col => {
    columnDistribution[col.name] = activeCards.filter(r => inferStage(r) === col.name).length;
  });
  
  // === ESKALATIONEN ===
  const lkEscalations = activeCards.filter(r => String(r["Eskalation"] || "").toUpperCase() === "LK");
  const skEscalations = activeCards.filter(r => String(r["Eskalation"] || "").toUpperCase() === "SK");
  
  // === TR-TERMINE (ERWEITERT MIT ABGESCHLOSSEN-STATUS) ===
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const trOverdue = activeCards.filter(r => {
    const trDate = r["TR_Neu"] || r["TR_Datum"];
    if (!trDate) return false;
    
    // âœ… NEUE LOGIK: Nicht als Ã¼berfÃ¤llig anzeigen wenn TR abgeschlossen ist
    if (toBoolean(r["TR_Completed"])) {
      return false;
    }
    
    const date = new Date(trDate);
    date.setHours(0, 0, 0, 0);
    return date < today;
  });
  
  const trToday = activeCards.filter(r => {
    const trDate = r["TR_Neu"] || r["TR_Datum"];
    if (!trDate) return false;
    
    // Auch heute fÃ¤llige nicht anzeigen wenn abgeschlossen
    if (toBoolean(r["TR_Completed"])) {
      return false;
    }
    
    const date = new Date(trDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  });
  
  const trThisWeek = activeCards.filter(r => {
    const trDate = r["TR_Neu"] || r["TR_Datum"];
    if (!trDate) return false;
    
    // Diese Woche fÃ¤llige nicht anzeigen wenn abgeschlossen
    if (toBoolean(r["TR_Completed"])) {
      return false;
    }
    
    const date = new Date(trDate);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    return date >= today && date <= weekEnd;
  });
  
  // âœ… NEUE METRIK: Abgeschlossene TRs
  const trCompleted = activeCards.filter(r => {
    const hasDate = r["TR_Neu"] || r["TR_Datum"];
    const isCompleted = toBoolean(r["TR_Completed"]);
    return hasDate && isCompleted;
  });
  
  // === DUE DATES ===
  const dueDatesOverdue = activeCards.filter(r => {
    const dueDate = r["Due Date"];
    if (!dueDate) return false;
    const date = new Date(dueDate);
    date.setHours(0, 0, 0, 0);
    return date < today;
  });
  
  const dueDatesUpcoming = activeCards.filter(r => {
    const dueDate = r["Due Date"];
    if (!dueDate) return false;
    const date = new Date(dueDate);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    return date >= today && date <= weekEnd;
  });
  
  // === PERFORMANCE METRIKEN ===
  // Team Workload
  const teamWorkload: Record<string, number> = {};
  activeCards.forEach(card => {
    const person = String(card["Verantwortlich"] || "Unbekannt").trim();
    teamWorkload[person] = (teamWorkload[person] || 0) + 1;
  });
  
  const avgCardsPerPerson = Object.keys(teamWorkload).length > 0 
    ? Math.round(totalCards / Object.keys(teamWorkload).length * 10) / 10 
    : 0;
  
  // Checklisten-Fortschritt
  const cardsWithChecklists = activeCards.filter(card => {
    const stage = inferStage(card);
    const checklist = card.ChecklistDone && card.ChecklistDone[stage];
    return checklist && Object.keys(checklist).length > 0;
  }).length;
  
  const checklistProgress = totalCards > 0 ? Math.round((cardsWithChecklists / totalCards) * 100) : 0;
  
  // TR-Abdeckung
  const cardsWithTR = activeCards.filter(r => r["TR_Neu"] || r["TR_Datum"]).length;
  const trCoverage = totalCards > 0 ? Math.round((cardsWithTR / totalCards) * 100) : 0;
  
  // Due Dates gesetzt
  const dueDatesSet = activeCards.filter(r => r["Due Date"]).length;
  
  return {
    // Grundzahlen
    totalCards,
    ampelGreen,
    ampelRed,
    
    // Spalten
    columnDistribution,
    
    // Eskalationen
    lkEscalations,
    skEscalations,
    
    // TR-Termine
    trOverdue,
    trToday,
    trThisWeek,
    trCompleted, // âœ… NEU!
    cardsWithTR,
    trCoverage,
    
    // Due Dates
    dueDatesOverdue,
    dueDatesUpcoming,
    dueDatesSet,
    
    // Performance
    teamWorkload,
    avgCardsPerPerson,
    cardsWithChecklists,
    checklistProgress
  };
};

// KPI-POPUP KOMPONENTE
// 2. ERWEITERTE TRKPIPOPUP KOMPONENTE (ersetze deine bestehende)
interface TRKPIPopupProps {
  open: boolean;
  onClose: () => void;
  cards: any[];
}

const TRKPIPopup = ({ open, onClose, cards }: TRKPIPopupProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const kpis = calculateKPIs();
  

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '80vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: 'primary.main',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Assessment />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Projekt-KPIs & Analytics
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Tab Navigation */}
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'grey.50' }}
        >
          <Tab label="Ãœbersicht" />
          <Tab label="Termine & Risiken" />
          <Tab label="Performance" />
        </Tabs>

        {/* TAB 0: ÃœBERSICHT */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* Haupt-KPIs Grid */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <Card sx={{ textAlign: 'center', p: 2, backgroundColor: 'primary.light', color: 'white' }}>
                  <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                    {kpis.totalCards}
                  </Typography>
                  <Typography variant="caption">Gesamt Karten</Typography>
                </Card>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Card sx={{ textAlign: 'center', p: 2, backgroundColor: 'success.main', color: 'white' }}>
                  <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                    {kpis.ampelGreen}
                  </Typography>
                  <Typography variant="caption">GrÃ¼n</Typography>
                </Card>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Card sx={{ textAlign: 'center', p: 2, backgroundColor: 'error.main', color: 'white' }}>
                  <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                    {kpis.ampelRed}
                  </Typography>
                  <Typography variant="caption">Rot</Typography>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              {/* Spalten-Verteilung */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Spalten-Verteilung</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(kpis.columnDistribution).map(([column, count]) => (
                      <Box key={column} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">{column}:</Typography>
                        <Chip 
                          label={count} 
                          color={count > 0 ? "primary" : "default"} 
                          size="small"
                        />
                      </Box>
                    ))}
                  </Box>
                </Card>
              </Grid>

              {/* Eskalationen */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Eskalationen</Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                      LK-Eskalationen ({kpis.lkEscalations.length})
                    </Typography>
                    {kpis.lkEscalations.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '100px', overflow: 'auto' }}>
                        {kpis.lkEscalations.map((card, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                           {card["Nummer"]} - {card["Teil"]}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Keine LK-Eskalationen</Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                      SK-Eskalationen ({kpis.skEscalations.length})
                    </Typography>
                    {kpis.skEscalations.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '100px', overflow: 'auto' }}>
                        {kpis.skEscalations.map((card, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                            {card["Nummer"]} - {card["Teil"]}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Keine SK-Eskalationen</Typography>
                    )}
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 1: TERMINE & RISIKEN */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* TR-Termine */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>TR-Termine</Typography>
                  
                  {/* Überfällige TR */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                      Überfällig ({kpis.trOverdue.length})
                    </Typography>
                    {kpis.trOverdue.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '120px', overflow: 'auto' }}>
                        {kpis.trOverdue.map((card, idx) => {
                          const trDate = card["TR_Neu"] || card["TR_Datum"];
                          return (
                            <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                              {card["Nummer"]} - TR: {new Date(trDate).toLocaleDateString('de-DE')}
                            </Typography>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="success.main">Keine Überfälligen TR-Termine</Typography>
                    )}
                  </Box>

                  {/* Heutefällige TR */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                      Heutefällig ({kpis.trToday.length})
                    </Typography>
                    {kpis.trToday.length > 0 ? (
                      <Box sx={{ mt: 1 }}>
                        {kpis.trToday.map((card, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                            {card["Nummer"]} - {card["Teil"]}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Keine TR-Termine heute</Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                      Diese Woche ({kpis.trThisWeek.length})
                    </Typography>
                    {kpis.trThisWeek.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '120px', overflow: 'auto' }}>
                        {kpis.trThisWeek.map((card, idx) => {
                          const trDate = card["TR_Neu"] || card["TR_Datum"];
                          return (
                            <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'info.main' }}>
                              {card["Nummer"]} - TR: {new Date(trDate).toLocaleDateString('de-DE')}
                            </Typography>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Keine TR-Termine diese Woche</Typography>
                    )}
                  </Box>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      Abgeschlossen ({kpis.trCompleted.length})
                    </Typography>
                    {kpis.trCompleted.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '120px', overflow: 'auto' }}>
                        {kpis.trCompleted.map((card, idx) => {
                          const originalDate = nullableDate(card["TR_Datum"]);
                          const completedDate = nullableDate(card["TR_Completed_At"] || card["TR_Completed_Date"]);
                          const diff = originalDate && completedDate
                            ? Math.round((completedDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24))
                            : null;
                          const diffLabel = diff === null ? '' : ` (${diff >= 0 ? '+' : ''}${diff} Tage)`;
                          const completedLabel = completedDate
                            ? completedDate.toLocaleDateString('de-DE')
                            : 'Datum unbekannt';
                          return (
                            <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'success.main' }}>
                              {card["Nummer"]} - Abschluss: {completedLabel}{diffLabel}
                            </Typography>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Keine abgeschlossenen TR-Termine</Typography>
                    )}
                  </Box>
                </Card>
              </Grid>

              {/* Due Dates */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Due Dates</Typography>
                  
                  {/* Überfällige Due Dates */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                      Überfällig ({kpis.dueDatesOverdue.length})
                    </Typography>
                    {kpis.dueDatesOverdue.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '120px', overflow: 'auto' }}>
                        {kpis.dueDatesOverdue.map((card, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                            {card["Nummer"]} - Due: {new Date(card["Due Date"]).toLocaleDateString('de-DE')}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="success.main">Keine Überfälligen Due Dates</Typography>
                    )}
                  </Box>

                  {/* Kommende Due Dates */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                      Kommende Woche ({kpis.dueDatesUpcoming.length})
                    </Typography>
                    {kpis.dueDatesUpcoming.length > 0 ? (
                      <Box sx={{ mt: 1, maxHeight: '120px', overflow: 'auto' }}>
                        {kpis.dueDatesUpcoming.map((card, idx) => (
                          <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                             {card["Nummer"]} - Due: {new Date(card["Due Date"]).toLocaleDateString('de-DE')}
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Keine Due Dates diese Woche</Typography>
                    )}
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 2: PERFORMANCE */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Team Workload */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Team Workload</Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    Durchschnitt: {kpis.avgCardsPerPerson} Karten/Person
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(kpis.teamWorkload)
                      .sort(([,a], [,b]) => b - a)
                      .map(([person, count]) => (
                      <Box key={person} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">{person}:</Typography>
                        <Chip 
                          label={count} 
                          color={count > kpis.avgCardsPerPerson * 1.5 ? "error" : count > kpis.avgCardsPerPerson ? "warning" : "success"} 
                          size="small"
                        />
                      </Box>
                    ))}
                  </Box>
                </Card>
              </Grid>

              {/* Performance Metriken */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Performance Metriken</Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Checklisten-Fortschritt:</Typography>
                      <Chip 
                        label={`${kpis.checklistProgress}%`} 
                        color={kpis.checklistProgress >= 70 ? "success" : kpis.checklistProgress >= 50 ? "warning" : "error"} 
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">TR-Abdeckung:</Typography>
                      <Chip 
                        label={`${kpis.trCoverage}%`} 
                        color={kpis.trCoverage >= 80 ? "success" : kpis.trCoverage >= 60 ? "warning" : "error"} 
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Karten mit TR-Terminen:</Typography>
                      <Chip 
                        label={`${kpis.cardsWithTR}/${kpis.totalCards}`} 
                        color="info" 
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Karten mit Checklisten:</Typography>
                      <Chip 
                        label={`${kpis.cardsWithChecklists}/${kpis.totalCards}`} 
                        color="success" 
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Due Dates gesetzt:</Typography>
                      <Chip 
                        label={`${kpis.dueDatesSet}/${kpis.totalCards}`} 
                        color="secondary" 
                        size="small"
                      />
                    </Box>

                    {/* Performance Bewertung */}
                    <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Performance Bewertung:</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {kpis.trCoverage >= 80 && (
                          <Chip label="Gute TR-Abdeckung" size="small" color="success" />
                        )}
                        {kpis.checklistProgress >= 70 && (
                          <Chip label="Guter Checklisten-Fortschritt" size="small" color="success" />
                        )}
                        {kpis.avgCardsPerPerson <= 10 && (
                          <Chip label="Ausgewogene Workload" size="small" color="success" />
                        )}
                        {kpis.trCoverage < 50 && (
                          <Chip label="Niedrige TR-Abdeckung" size="small" color="warning" />
                        )}
                        {kpis.avgCardsPerPerson > 15 && (
                          <Chip label="Hohe Workload" size="small" color="warning" />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, backgroundColor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          Aktualisiert: {new Date().toLocaleString('de-DE')}
        </Typography>
        <Button onClick={onClose} variant="contained">
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
};
  
  const getEscalationClass = (escalation: string) => {
    if (escalation === 'LK') return 'esk-lk';
    if (escalation === 'SK') return 'esk-sk';
    return '';
  };

 // Drag & Drop Handler
// KORRIGIERTE onDragEnd FUNKTION:
const onDragEnd = (result: DropResult) => {
  const { destination, source, draggableId } = result;
  
  if (!destination) return;
  if (destination.droppableId === source.droppableId && destination.index === source.index) return;

  const card = rows.find(r => idFor(r) === draggableId);
  if (!card) return;

  console.log('🎯 Drag & Drop:', {
    cardId: draggableId,
    from: source.droppableId,
    to: destination.droppableId,
    fromIndex: source.index,
    toIndex: destination.index
  });

  // ✅ Parse destination für swimlanes - HIER WAR DER FEHLER!
  let newStage = destination.droppableId;
  let newResp = null;
  let newLane = null;

  if (destination.droppableId.includes('||')) {
    const parts = destination.droppableId.split('||');
    newStage = parts[0];
    // Nur wenn viewMode definiert ist
    if (typeof viewMode !== 'undefined' && viewMode === 'swim') {
      newResp = parts[1] === ' ' ? '' : parts[1];
    } else if (typeof viewMode !== 'undefined' && viewMode === 'lane') {
      newLane = parts[1];
    }
  }

  const oldStage = inferStage(card);
  
  // Erstelle eine Kopie des Arrays für die Manipulation
  const newRows = [...rows];
  
  // Finde die Karte im Array
  const cardIndex = newRows.findIndex(r => idFor(r) === draggableId);
  if (cardIndex === -1) return;
  
  // Entferne die Karte aus dem Array
  const [movedCard] = newRows.splice(cardIndex, 1);
  
  // ✅ Update die Karte mit neuen Werten - JETZT IST newStage DEFINIERT!
  movedCard["Board Stage"] = newStage;
  if (newResp !== null) movedCard["Verantwortlich"] = newResp;
  if (newLane !== null) movedCard["Swimlane"] = newLane;
  
  // Finde alle Karten in der Ziel-Stage
  const targetStageCards = newRows.filter(r => inferStage(r) === newStage);
  
  // Berechne die neue Position
  const insertIndex = Math.min(destination.index, targetStageCards.length);
  
  // Finde die globale Position zum Einfügen
  let globalInsertIndex = 0;
  let stageCardCount = 0;
  
  for (let i = 0; i < newRows.length; i++) {
    if (inferStage(newRows[i]) === newStage) {
      if (stageCardCount === insertIndex) {
        globalInsertIndex = i;
        break;
      }
      stageCardCount++;
    }
    if (i === newRows.length - 1) {
      globalInsertIndex = newRows.length;
    }
  }
  
  // Füge die Karte an der neuen Position ein
  newRows.splice(globalInsertIndex, 0, movedCard);
  
  // Setze grün wenn fertig
  const doneStages = cols.filter(c => c.done || /fertig/i.test(c.name)).map(c => c.name);
  if (doneStages.includes(newStage)) {
    movedCard["Ampel"] = "grün";
  }

  console.log('✅ Karte verschoben:', {
    cardId: draggableId,
    newStage: movedCard["Board Stage"],
    newPosition: insertIndex
  });
  
  // State aktualisieren
  setRows(newRows);
  
  // Sofort speichern nach Drag & Drop
  console.log('💾 Speichere nach Drag & Drop...');
  setTimeout(() => saveCards(), 500);
};



  // Toggle escalation
  const toggleEscalation = (card: any, type: 'LK' | 'SK') => {
    const currentEscalation = String(card["Eskalation"] || "").toUpperCase();
    
    if (currentEscalation === type) {
      card["Eskalation"] = "";
      card["Ampel"] = "grün";
    } else {
      card["Eskalation"] = type;
      card["Ampel"] = "rot";
    }
    
    setRows([...rows]);
  };

  // Toggle card collapse
  const toggleCollapse = (card: any) => {
    const wasCollapsed = String(card["Collapsed"] || "") === "1";
    card["Collapsed"] = wasCollapsed ? "" : "1";
    setRows([...rows]);
  };

  // Archive all cards in done columns
  const archiveColumn = (columnName: string) => {
    if (!window.confirm(`Alle Karten in "${columnName}" archivieren?`)) return;
    
    rows.forEach(r => {
      if (inferStage(r) === columnName) {
        r["Archived"] = "1";
      }
    });
    
    setRows([...rows]);
  };

  // Add new status entry
  const addStatusEntry = (card: any) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE');
    const newEntry = {
      date: dateStr,
      message: { text: '', escalation: false },
      qualitaet: { text: '', escalation: false },
      kosten: { text: '', escalation: false },
      termine: { text: '', escalation: false }
    };

    if (!Array.isArray(card.StatusHistory)) card.StatusHistory = [];
    card.StatusHistory.unshift(newEntry);
    setRows([...rows]);
  };

  // Update status summary
  const updateStatusSummary = (card: any) => {
    const hist = Array.isArray(card.StatusHistory) ? card.StatusHistory : [];
    let kurz = '';
    if (hist.length) {
      const latest = hist[0];
      ['message', 'qualitaet', 'kosten', 'termine'].some(key => {
        const e = latest[key];
        if (e && e.text && e.text.trim()) {
          kurz = e.text.trim();
          return true;
        }
        return false;
      });
    }
    card['Status Kurz'] = kurz;
  };

// Render einzelne Karte - EINHEITLICHE LOGIK
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
      />
    ),
    [density, idFor, inferStage, rows, saveCards, setEditModalOpen, setEditTabValue, setRows, setSelectedCard, users]
  );

// ✅ KORRIGIERTE TR-NEU ÄNDERUNGS-HANDLER (ersetze die bisherige Funktion)
const handleTRNeuChange = (card: any, newDate: string) => {
  console.log(`📅 TR-Neu Änderung für ${card.Nummer}:`, {
    alt: card["TR_Neu"],
    neu: newDate
  });
  
  if (!newDate) {
    // Leeres Datum - TR_Neu löschen, aber Historie behalten
    card["TR_Neu"] = "";
    setRows([...rows]);
    return;
  }
  
  // Aktueller Benutzer
  const currentUser = users.find(u => u.name === card["Verantwortlich"])?.name || 'System';
  
  // Historie initialisieren falls nicht vorhanden
  if (!Array.isArray(card["TR_History"])) {
    card["TR_History"] = [];
  }
  
  // Wenn bereits ein TR_Neu existiert, zur Historie hinzufügen
  if (card["TR_Neu"] && card["TR_Neu"] !== newDate) {
    console.log(`📅 Füge altes TR_Neu zur Historie hinzu: ${card["TR_Neu"]}`);
    
    card["TR_History"].push({
      date: card["TR_Neu"],
      changedBy: currentUser,
      timestamp: new Date().toISOString(),
      superseded: true
    });
  }
  
  // Neues TR_Neu setzen
  card["TR_Neu"] = newDate;
  
  // Aktuelles TR_Neu auch zur Historie hinzufügen (als letzter Eintrag)
  card["TR_History"].push({
    date: newDate,
    changedBy: currentUser,
    timestamp: new Date().toISOString(),
    superseded: false
  });
  
  console.log(`📅 TR neu gesetzt für ${card.Nummer}:`, {
    neuesDatum: newDate,
    historieAnzahl: card["TR_History"].length
  });
  
  setRows([...rows]);
};



  // Main Render
return (
    <Box sx={{ 
      height: 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg)',
      color: 'var(--ink)'
    }}>
      {/* Header mit Toolbar */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'linear-gradient(180deg,rgba(0,0,0,.05),transparent),var(--panel)',
        borderBottom: '1px solid var(--line)',
        p: 2
      }}>
        {/* Toolbar */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto auto auto auto auto auto auto',
          gap: 1.5,
          alignItems: 'center',
          mt: 0
        }}>
          {/* Suchfeld */}
          <TextField
            size="small"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 220 }}
          />

          {/* Ansichtsmodi */}
          <Button
            variant={viewMode === 'columns' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('columns')}
            sx={{ minWidth: 'auto', p: 1 }}
            title="Ansicht: Spalten"
          >
            📊
          </Button>
          <Button
            variant={viewMode === 'swim' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('swim')}
            sx={{ minWidth: 'auto', p: 1 }}
            title="Ansicht: Swimlanes (Verantwortlich)"
          >
            👥
          </Button>
          <Button
            variant={viewMode === 'lane' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('lane')}
            sx={{ minWidth: 'auto', p: 1 }}
            title="Ansicht: Swimlanes (Kategorie)"
          >
            🏷️
          </Button>

          {/* Layout-Modi */}
          <Button
            variant={density === 'compact' ? 'contained' : 'outlined'}
            onClick={() => setDensity('compact')}
            sx={{ minWidth: 'auto', p: 1 }}
            title="Layout: kompakt"
          >
            ◼
          </Button>
          <Button
            variant={density === 'xcompact' ? 'contained' : 'outlined'}
            onClick={() => setDensity('xcompact')}
            sx={{ minWidth: 'auto', p: 1 }}
            title="Layout: extrakompakt"
          >
            ◻
          </Button>
          <Button
            variant={density === 'large' ? 'contained' : 'outlined'}
            onClick={() => setDensity('large')}
            sx={{ minWidth: 'auto', p: 1 }}
            title="Layout: groß"
          >
            ⬜
          </Button>         
          <Button variant="contained" size="small" onClick={() => setNewCardOpen(true)}>
            Neue Karte
          </Button>
        </Box>
      </Box>

          
      {/* Board Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'columns' && (
          <KanbanColumnsView
            rows={rows}
            cols={cols}
            density={density}
            searchTerm={searchTerm}
            onDragEnd={onDragEnd}
            inferStage={inferStage}
            archiveColumn={archiveColumn}
            renderCard={renderCard}
          />
        )}
        {viewMode === 'swim' && (
          <KanbanSwimlaneView
            rows={rows}
            cols={cols}
            searchTerm={searchTerm}
            onDragEnd={onDragEnd}
            inferStage={inferStage}
            renderCard={renderCard}
          />
        )}
        {viewMode === 'lane' && (
          <KanbanLaneView
            rows={rows}
            cols={cols}
            lanes={lanes}
            searchTerm={searchTerm}
            onDragEnd={onDragEnd}
            inferStage={inferStage}
            renderCard={renderCard}
          />
        )}
      </Box>
{/* Einstellungen Modal */}
<Dialog 
  open={settingsOpen} 
  onClose={() => setSettingsOpen(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle sx={{ 
    borderBottom: '1px solid var(--line)',
    display: 'flex',
    alignItems: 'center',
    gap: 1
  }}>
    ⚙️ Board Einstellungen
  </DialogTitle>
  
  <DialogContent sx={{ p: 3 }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      <Box>
        <Typography variant="h6" sx={{ mb: 2, color: 'var(--ink)' }}>
          Allgemein
        </Typography>
        <TextField
          label="Board-Name"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          fullWidth
          required
          error={!!boardMeta && !boardName.trim()}
          helperText={!!boardMeta && !boardName.trim() ? 'Board-Name darf nicht leer sein.' : ' '}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Beschreibung"
          value={boardDescription}
          onChange={(e) => setBoardDescription(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          placeholder="Beschreibe das Board..."
        />
      </Box>

      {/* Spalten Konfiguration */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, color: 'var(--ink)' }}>
          📋 Spalten
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {cols.map((col, index) => (
            <Box key={index} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: 1,
              border: '1px solid var(--line)',
              borderRadius: '8px'
            }}>
              <TextField
                size="small"
                value={col.name}
                onChange={(e) => {
                  const newCols = [...cols];
                  newCols[index] = { ...col, name: e.target.value };
                  setCols(newCols);
                }}
                sx={{ flex: 1 }}
              />
              <IconButton 
                size="small"
                onClick={() => {
                  const newCols = cols.filter((_, i) => i !== index);
                  setCols(newCols);
                }}
                sx={{ color: '#d32f2f' }}
              >
                🗑️
              </IconButton>
            </Box>
          ))}
          <Button 
            variant="outlined" 
            size="small"
            onClick={() =>
              setCols([
                ...cols,
                { id: `new-${Date.now()}`, name: `Neue Spalte ${cols.length + 1}`, done: false },
              ])
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            + Spalte hinzufügen
          </Button>
        </Box>
      </Box>

      {/* Verfügbare Benutzer (nur Anzeige) */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, color: 'var(--ink)' }}>
          Verfügbare Benutzer ({users.length})
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '200px', overflow: 'auto' }}>
          {users.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', fontStyle: 'italic', p: 2 }}>
              Keine Benutzer gefunden. Benutzer werden automatisch aus der Datenbank geladen.
            </Typography>
          ) : (
            users.map((user, index) => (
              <Box key={user.id} sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                p: 2,
                border: '1px solid var(--line)',
                borderRadius: '8px',
                backgroundColor: 'var(--panel)'
              }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {user.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                    {user.email}
                  </Typography>
                </Box>
                <Chip 
                  label="Aktiv" 
                  size="small" 
                  color="success"
                  sx={{ fontSize: '10px' }}
                />
              </Box>
            ))
          )}
        </Box>
        <Typography variant="caption" sx={{ color: 'var(--muted)', mt: 1, display: 'block' }}>
          💡 Benutzer werden automatisch aus der Authentifizierung geladen und können als Verantwortliche zugewiesen werden.
        </Typography>
      </Box>

      {/* Swimlanes */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, color: 'var(--ink)' }}>
          🏊 Swimlanes
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {lanes.map((lane, index) => (
            <Box key={index} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: 1,
              border: '1px solid var(--line)',
              borderRadius: '8px'
            }}>
              <TextField
                size="small"
                value={lane}
                onChange={(e) => {
                  const newLanes = [...lanes];
                  newLanes[index] = e.target.value;
                  setLanes(newLanes);
                }}
                sx={{ flex: 1 }}
              />
              <IconButton 
                size="small"
                onClick={() => {
                  const newLanes = lanes.filter((_, i) => i !== index);
                  setLanes(newLanes);
                }}
                sx={{ color: '#d32f2f' }}
              >
                🗑️
              </IconButton>
            </Box>
          ))}
          <Button 
            variant="outlined" 
            size="small"
            onClick={() => setLanes([...lanes, `Swimlane ${lanes.length + 1}`])}
            sx={{ alignSelf: 'flex-start' }}
          >
            + Swimlane hinzufügen
          </Button>
        </Box>
      </Box>

      {/* Checklisten Templates */}
<Box>
  <Typography variant="h6" sx={{ mb: 2, color: 'var(--ink)' }}>
    ✅ Checklisten Templates (pro Spalte)
  </Typography>
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {cols.map((col) => (
      <Box key={col.name} sx={{ 
        border: '1px solid var(--line)',
        borderRadius: '8px',
        p: 2
      }}>
        <Typography variant="subtitle1" sx={{ 
          mb: 1, 
          fontWeight: 600,
          color: 'var(--ink)'
        }}>
          📋 {col.name}
        </Typography>
        
        {/* Checklisten Items für diese Spalte */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
          {(checklistTemplates[col.name] || []).map((item, itemIndex) => (
            <Box key={itemIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                value={item}
                onChange={(e) => {
                  const newTemplates = { ...checklistTemplates };
                  if (!newTemplates[col.name]) newTemplates[col.name] = [];
                  const newItems = [...newTemplates[col.name]];
                  newItems[itemIndex] = e.target.value;
                  newTemplates[col.name] = newItems;
                  setChecklistTemplates(newTemplates);
                }}
                sx={{ flex: 1 }}
              />
              <IconButton 
                size="small"
                onClick={() => {
                  const newTemplates = { ...checklistTemplates };
                  if (!newTemplates[col.name]) return;
                  const newItems = newTemplates[col.name].filter((_, i) => i !== itemIndex);
                  newTemplates[col.name] = newItems;
                  setChecklistTemplates(newTemplates);
                }}
                sx={{ color: '#d32f2f' }}
              >
                ➖
              </IconButton>
            </Box>
          ))}
          <Button 
            variant="text" 
            size="small"
            onClick={() => {
              const newTemplates = { ...checklistTemplates };
              if (!newTemplates[col.name]) newTemplates[col.name] = [];
              const newItems = [...newTemplates[col.name], `Neuer Punkt ${newTemplates[col.name].length + 1}`];
              newTemplates[col.name] = newItems;
              setChecklistTemplates(newTemplates);
            }}
            sx={{ alignSelf: 'flex-start', fontSize: '12px' }}
          >
            + Punkt hinzufügen
          </Button>
        </Box>
      </Box>
    ))}


          
          <Button 
            variant="outlined" 
            size="small"
            onClick={() => {
              const newName = `Template ${Object.keys(checklistTemplates).length + 1}`;
              setChecklistTemplates({
                ...checklistTemplates,
                [newName]: ['Punkt 1', 'Punkt 2']
              });
            }}
            sx={{ alignSelf: 'flex-start' }}
          >
            + Template hinzufügen
          </Button>
        </Box>
      </Box>

    </Box>

  </DialogContent>
  <DialogActions sx={{ borderTop: '1px solid var(--line)', p: 2 }}>
    <Button onClick={() => setSettingsOpen(false)}>
      Abbrechen
    </Button>
<Button 
  variant="contained" 
  onClick={async () => {
    const success = await saveSettings();
    if (success) {
      setSettingsOpen(false);
      alert('✅ Einstellungen wurden in Supabase gespeichert!');
    }
  }}

      sx={{ 
        backgroundColor: '#14c38e',
        '&:hover': { backgroundColor: '#0ea770' }
      }}
    >
      Speichern
    </Button>
  </DialogActions>
</Dialog>

      <EditCardDialog
        selectedCard={selectedCard}
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        editTabValue={editTabValue}
        setEditTabValue={setEditTabValue}
        rows={rows}
        setRows={setRows}
        users={users}
        lanes={lanes}
        checklistTemplates={checklistTemplates}
        inferStage={inferStage}
        addStatusEntry={addStatusEntry}
        updateStatusSummary={updateStatusSummary}
        handleTRNeuChange={handleTRNeuChange}
        saveCards={saveCards}
        idFor={idFor}
        setSelectedCard={setSelectedCard}
      />

      <NewCardDialog
        newCardOpen={newCardOpen}
        setNewCardOpen={setNewCardOpen}
        cols={cols}
        lanes={lanes}
        rows={rows}
        setRows={setRows}
        users={users}
      />

      <ArchiveDialog
        archiveOpen={archiveOpen}
        setArchiveOpen={setArchiveOpen}
        archivedCards={archivedCards}
        restoreCard={restoreCard}
        deleteCardPermanently={deleteCardPermanently}
      />

      {/* CSS Variables für dein ursprüngliches Design */}
      <style jsx global>{`
        :root {
          --bg: #0f1117;
          --panel: #141a22;
          --ink: #e6e8ee;
          --muted: #9aa3b2;
          --accent: #4aa3ff;
          --line: #243042;
          --chip: #1a2230;
          --alert: #5a1b1b;
          --alertBorder: #a33;
          --ok: #19c37d;
          --colw: 320px;
          --rowheadw: 200px;
        }
        
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #f5f7fb;
            --panel: #ffffff;
            --ink: #0b1220;
            --muted: #566175;
            --accent: #2458ff;
            --line: #e6eaf2;
            --chip: #eef3ff;
            --alert: #ffe8e8;
            --alertBorder: #ff6b6b;
            --ok: #0ea667;
          }
        }
        
        .card.esk-lk {
          background: #fff3e0 !important;
          border-color: #ef6c00 !important;
        }
        
        .card.esk-sk {
          background: #ffebee !important;
          border-color: #c62828 !important;
        }
        
        .card.due-today {
          background: var(--alert) !important;
          border-color: var(--alertBorder) !important;
        }
      `}</style>
{/* SCHRITT 4: TRKPIPopup hinzufügen */}
    <TRKPIPopup
      open={kpiPopupOpen}
      onClose={() => setKpiPopupOpen(false)}
      cards={rows}
    />
    </Box>
  );
});

export default OriginalKanbanBoard;
