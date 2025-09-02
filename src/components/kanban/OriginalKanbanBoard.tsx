'use client';

import { useState, useEffect } from 'react';
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
  Alert,
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
  ListItemText,
  Divider,
} from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface OriginalKanbanBoardProps {
  boardId: string;
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

export default function OriginalKanbanBoard({ boardId }: OriginalKanbanBoardProps) {
  // State für deine ursprünglichen Features
  const [viewMode, setViewMode] = useState<'columns' | 'swim' | 'lane'>('columns');
  const [density, setDensity] = useState<'compact' | 'xcompact' | 'large'>('compact');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'' | 'due' | 'number'>('');
  
  const [rows, setRows] = useState<any[]>([]);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [responsibles, setResponsibles] = useState<string[]>(['Max M.', 'Anna K.', 'Tom S.']);
  const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
  const [checklists, setChecklists] = useState(DEFAULT_CHECKLISTS);
  
  // Dialog States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Checklisten Templates State - SPALTENSPEZIFISCH
const [checklistTemplates, setChecklistTemplates] = useState(() => {
  const templates = {};
  cols.forEach(col => {
    templates[col.name] = [
      "Anforderungen prüfen",
      "Dokumentation erstellen", 
      "Qualitätskontrolle"
    ];
  });
  return templates;
});

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

  // Lade Testdaten
  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = () => {
    const testCards = [
      {
        "Nummer": "A-24-001",
        "Teil": "Gehäuse Vorderseite",
        "Board Stage": "Werkzeug beim Werkzeugmacher",
        "Status Kurz": "Werkzeug in Bearbeitung",
        "Verantwortlich": "Max M.",
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
          "Werkzeug beim Werkzeugmacher": [true, true, false]
        }
      },
      {
        "Nummer": "A-24-002", 
        "Teil": "Gehäuse Rückseite",
        "Board Stage": "Werkzeugtransport",
        "Status Kurz": "Transport läuft",
        "Verantwortlich": "Anna K.",
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
      {
        "Nummer": "B-24-001",
        "Teil": "Deckel",
        "Board Stage": "Musterung",
        "Status Kurz": "Muster werden geprüft",
        "Verantwortlich": "Tom S.",
        "Due Date": "2024-02-01",
        "Ampel": "gelb",
        "Swimlane": "Projekt B",
        "UID": "uid3",
        "ChecklistDone": {
          "Musterung": [true, false, false]
        }
      }
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
    if (ampel?.toLowerCase().startsWith('gelb')) return '#ffa500';
    return '#14c38e';
  };

  const getEscalationClass = (escalation: string) => {
    if (escalation === 'LK') return 'esk-lk';
    if (escalation === 'SK') return 'esk-sk';
    return '';
  };

  // Drag & Drop Handler
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const card = rows.find(r => idFor(r) === draggableId);
    if (!card) return;

    // Parse destination for swimlanes
    let newStage = destination.droppableId;
    let newResp = null;
    let newLane = null;

    if (destination.droppableId.includes('||')) {
      const parts = destination.droppableId.split('||');
      newStage = parts[0];
      if (viewMode === 'swim') {
        newResp = parts[1] === '—' ? '' : parts[1];
      } else if (viewMode === 'lane') {
        newLane = parts[1];
      }
    }

    const oldStage = inferStage(card);
    
    // Checklist completion check
    if (oldStage !== newStage) {
      const tasksOld = checklists[oldStage] || [];
      if (tasksOld.length) {
        const statusesOld = (card.ChecklistDone && card.ChecklistDone[oldStage]) || [];
        const incomplete = tasksOld.some((_, i) => !statusesOld[i]);
        
        if (incomplete) {
          const confirmed = window.confirm(
            `Für die Phase "${oldStage}" sind nicht alle Punkte der Checkliste abgeschlossen. Trotzdem verschieben?`
          );
          if (!confirmed) return;
        }
      }
    }

    // Update card
    card["Board Stage"] = newStage;
    if (newResp !== null) card["Verantwortlich"] = newResp;
    if (newLane !== null) card["Swimlane"] = newLane;
    
    // Set green if done stage
    const doneStages = cols.filter(c => c.done || /fertig/i.test(c.name)).map(c => c.name);
    if (doneStages.includes(newStage)) {
      card["Ampel"] = "grün";
    }

      // Initialize checklist for new stage - NEUE LOGIK
    if (oldStage !== newStage && checklistTemplates[newStage]) {
      const templateItems = checklistTemplates[newStage];
      if (!card.ChecklistDone) card.ChecklistDone = {};
      
      // Erstelle Checkliste basierend auf Template
      const newChecklistDone = {};
      templateItems.forEach(item => {
        newChecklistDone[item] = false;
      });
      card.ChecklistDone[newStage] = newChecklistDone;
    }

    setRows([...rows]);
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
const renderCard = (card: any, index: number) => {
  const cardId = idFor(card);
  const stage = inferStage(card);
  
  // Bestimme Eskalationsstatus
  const eskalation = String(card["Eskalation"] || "").toUpperCase();
  const hasLKEscalation = eskalation === "LK";
  const hasSKEscalation = eskalation === "SK";
  
  // Hauptstatus
  let statusKurz = "";
  if (Array.isArray(card.StatusHistory) && card.StatusHistory.length) {
    const latest = card.StatusHistory[0];
    ['message', 'qualitaet', 'kosten', 'termine'].some(key => {
      const e = latest[key];
      if (e && e.text && e.text.trim()) {
        statusKurz = e.text.trim();
        return true;
      }
      return false;
    });
  } else {
    statusKurz = String(card["Status Kurz"] || "").trim();
  }

  const isOverdue = card["Due Date"] && new Date(card["Due Date"]) < new Date();
  
  // EINHEITLICHE LOGIK: Bestimme aktuelle Kartengröße
  // Individual Override hat Vorrang vor globaler Einstellung
  let currentSize = density; // Global: 'xcompact', 'compact', 'large'
  
  // Individual Override: 'large' wenn nicht collapsed, sonst global
  if (card["Collapsed"] === "large") {
    currentSize = "large";
  } else if (card["Collapsed"] === "compact") {
    currentSize = "compact";
  }
  // Wenn Collapsed leer/undefined ist, wird globale Einstellung verwendet
  
  // Kartenfarbe basierend auf Eskalation
  let backgroundColor = 'white';
  if (hasLKEscalation) backgroundColor = '#fff3e0';
  if (hasSKEscalation) backgroundColor = '#ffebee';
  
  let borderColor = 'var(--line)';
  if (hasLKEscalation) borderColor = '#ef6c00';
  if (hasSKEscalation) borderColor = '#c62828';

  const ampelColor = (hasLKEscalation || hasSKEscalation) ? '#ff5a5a' : '#14c38e';

  // Hilfsfunktion zum Aktualisieren einer Karte
  const updateCard = (updates: any) => {
    const updatedCard = { ...card, ...updates };
    const cardIndex = rows.findIndex((c: any) => idFor(c) === cardId);
    if (cardIndex >= 0) {
      const newRows = [...rows];
      newRows[cardIndex] = updatedCard;
      setRows(newRows);
    }
  };

  return (
    <Draggable key={cardId} draggableId={cardId} index={index}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`card ${hasLKEscalation ? 'esk-lk' : ''} ${hasSKEscalation ? 'esk-sk' : ''}`}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('.controls')) {
              setSelectedCard(card);
              setEditModalOpen(true);
              setEditTabValue(1);
            }
          }}
          sx={{
            backgroundColor,
            border: `1px solid ${borderColor}`,
            borderRadius: currentSize === 'xcompact' ? '4px' : '12px',
            padding: currentSize === 'xcompact' ? '4px' : '10px',
            cursor: 'pointer',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            opacity: snapshot.isDragging ? 0.96 : 1,
            transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'none',
            boxShadow: snapshot.isDragging 
              ? '0 14px 28px rgba(0,0,0,0.30)' 
              : '0 3px 8px rgba(0,0,0,0.06)',
            minHeight: currentSize === 'xcompact' ? '18px' : (currentSize === 'large' ? '150px' : '80px'),
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            '&:hover': {
              transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'translateY(-2px)',
              boxShadow: '0 6px 14px rgba(0,0,0,0.18)'
            }
          }}
          title={statusKurz || ''}
        >
          {currentSize === 'xcompact' ? (
            // EXTRAKOMPAKT: Nur Farbe + Nummer
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              gap: 0.5,
              padding: '2px'
            }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '2px',
                backgroundColor: ampelColor,
                border: '1px solid var(--line)',
                flexShrink: 0
              }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '9px',
                  lineHeight: 1,
                  color: 'var(--ink)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                {card["Nummer"]}
              </Typography>
            </Box>
          ) : (
            // KOMPAKT & GROSS
            <>
              {/* Header mit Dot und Nummer */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 0.5
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: ampelColor,
                    border: '1px solid var(--line)',
                    flexShrink: 0
                  }} />
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: 700, 
                      fontSize: '14px',
                      color: 'var(--ink)'
                    }}
                  >
                    {card["Nummer"]}
                  </Typography>
                </Box>

                {/* Controls */}
                <Box className="controls" sx={{ display: 'flex', gap: 0.5 }}>
                  {/* Toggle Button - NEUE LOGIK */}
                  <IconButton 
                    size="small" 
                    sx={{ 
                      width: 22, 
                      height: 22, 
                      fontSize: '10px',
                      border: '1px solid var(--line)',
                      backgroundColor: currentSize === 'large' ? '#e3f2fd' : 'transparent',
                      color: currentSize === 'large' ? '#1976d2' : 'var(--muted)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' }
                    }}
                    title="Groß/Normal umschalten"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle zwischen large und der globalen Einstellung
                      const newSize = currentSize === 'large' ? '' : 'large';
                      updateCard({ Collapsed: newSize });
                    }}
                  >
                    ↕
                  </IconButton>

                  {/* LK Button */}
                  <IconButton 
                    size="small" 
                    sx={{ 
                      width: 22, 
                      height: 22, 
                      fontSize: '9px',
                      border: '1px solid var(--line)',
                      backgroundColor: hasLKEscalation ? '#ef6c00' : 'transparent',
                      color: hasLKEscalation ? 'white' : 'var(--muted)',
                      '&:hover': { backgroundColor: hasLKEscalation ? '#e65100' : 'rgba(0,0,0,0.06)' }
                    }}
                    title="Leitungskreis"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newEskalation = hasLKEscalation ? "" : "LK";
                      updateCard({ 
                        Eskalation: newEskalation,
                        Ampel: newEskalation ? "rot" : "grün"
                      });
                    }}
                  >
                    LK
                  </IconButton>

                  {/* SK Button */}
                  <IconButton 
                    size="small" 
                    sx={{ 
                      width: 22, 
                      height: 22, 
                      fontSize: '9px',
                      border: '1px solid var(--line)',
                      backgroundColor: hasSKEscalation ? '#c62828' : 'transparent',
                      color: hasSKEscalation ? 'white' : 'var(--muted)',
                      '&:hover': { backgroundColor: hasSKEscalation ? '#b71c1c' : 'rgba(0,0,0,0.06)' }
                    }}
                    title="Strategiekreis"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newEskalation = hasSKEscalation ? "" : "SK";
                      updateCard({ 
                        Eskalation: newEskalation,
                        Ampel: newEskalation ? "rot" : "grün"
                      });
                    }}
                  >
                    SK
                  </IconButton>

                  {/* Edit Button */}
                  <IconButton 
                    size="small" 
                    sx={{ 
                      width: 22, 
                      height: 22, 
                      fontSize: '10px',
                      border: '1px solid var(--line)',
                      backgroundColor: 'transparent',
                      color: 'var(--muted)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' }
                    }}
                    title="Bearbeiten"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCard(card);
                      setEditModalOpen(true);
                      setEditTabValue(1);
                    }}
                  >
                    ✎
                  </IconButton>
                </Box>
              </Box>

              {/* Projektname */}
              {card["Teil"] && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: '12px',
                    lineHeight: 1.3,
                    color: 'var(--muted)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    mb: 1
                  }}
                >
                  {card["Teil"]}
                </Typography>
              )}

              {/* Status - GLEICHE LOGIK für beide */}
              {statusKurz && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontSize: '12px',
                    color: 'var(--muted)',
                    overflow: 'hidden',
                    textOverflow: currentSize === 'large' ? 'clip' : 'ellipsis',
                    whiteSpace: currentSize === 'large' ? 'pre-wrap' : 'nowrap',
                    display: currentSize === 'large' ? '-webkit-box' : 'block',
                    WebkitLineClamp: currentSize === 'large' ? 6 : undefined,
                    WebkitBoxOrient: currentSize === 'large' ? 'vertical' : undefined,
                    mb: 0.5,
                    wordBreak: currentSize === 'large' ? 'break-word' : 'normal'
                  }}
                >
                  {statusKurz}
                </Typography>
              )}

              {/* GROSS: Bild anzeigen */}
              {currentSize === 'large' && card["Bild"] && (
                <Box sx={{ 
                  mb: 1,
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={card["Bild"]} 
                    alt="Projektbild"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '60px',
                      borderRadius: '6px',
                      objectFit: 'cover'
                    }} 
                  />
                </Box>
              )}

              {/* Footer */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mt: 'auto',
                fontSize: '10px'
              }}>
                <Typography variant="caption" sx={{ fontSize: '10px', color: 'var(--muted)' }}>
                  {card["Verantwortlich"] || ""}
                </Typography>
                
                {card["Due Date"] && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontSize: '9px',
                      color: isOverdue ? '#d32f2f' : 'var(--muted)',
                      fontWeight: isOverdue ? 600 : 400,
                      backgroundColor: isOverdue ? '#ffebee' : 'transparent',
                      padding: isOverdue ? '2px 4px' : '0',
                      borderRadius: isOverdue ? '4px' : '0'
                    }}
                  >
                    {String(card["Due Date"]).slice(0, 10)}
                  </Typography>
                )}
              </Box>

              {/* GROSS: Team-Mitglieder */}
              {currentSize === 'large' && card["Team"] && Array.isArray(card["Team"]) && card["Team"].length > 0 && (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid var(--line)' }}>
                  <Typography variant="caption" sx={{ 
                    fontSize: '10px', 
                    color: 'var(--muted)',
                    fontWeight: 600,
                    display: 'block',
                    mb: 0.5
                  }}>
                    Team ({card["Team"].length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {card["Team"].slice(0, 3).map((member: any, idx: number) => (
                      <Chip 
                        key={idx}
                        label={`${member.name}${member.role ? ` (${member.role})` : ''}`}
                        size="small"
                        sx={{ 
                          fontSize: '9px',
                          height: 16,
                          backgroundColor: 'var(--chip)',
                          color: 'var(--muted)'
                        }}
                      />
                    ))}
                    {card["Team"].length > 3 && (
                      <Typography variant="caption" sx={{ 
                        fontSize: '9px', 
                        color: 'var(--muted)',
                        alignSelf: 'center'
                      }}>
                        +{card["Team"].length - 3} weitere
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}

              {/* GROSS: Swimlane */}
              {currentSize === 'large' && card["Swimlane"] && (
                <Chip 
                  label={card["Swimlane"]}
                  size="small"
                  sx={{ 
                    fontSize: '11px',
                    height: 20,
                    mt: 0.5,
                    backgroundColor: 'var(--chip)',
                    color: 'var(--muted)'
                  }}
                />
              )}
            </>
          )}
        </Box>
      )}
    </Draggable>
  );
};



  // Render Spalten-Ansicht
  const renderColumns = () => {
    const filtered = rows.filter(r => 
      !r["Archived"] && 
      (!searchTerm || Object.values(r).some(v => 
        String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Box sx={{ 
          display: 'flex', 
          gap: 1.5, 
          p: 2, 
          overflow: 'auto', 
          alignItems: 'flex-start',
          minHeight: '100%'
        }}>
          {cols.map(col => {
            const colCards = filtered.filter(r => inferStage(r) === col.name);
            const redCount = colCards.filter(r => (r["Ampel"] || '').toLowerCase().startsWith('rot')).length;
            
            return (
              <Box
                key={col.id}
                sx={{
                  minWidth: 'var(--colw)',
                  width: 'var(--colw)',
                  backgroundColor: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '55vh'
                }}
              >
                {/* Spalten-Header */}
                <Box sx={{ 
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--panel)',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 3
                }}>
                  <Box>
                    <Typography variant="h6" sx={{ 
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--muted)',
                      fontWeight: 600
                    }}>
                      {col.name} {col.done && '✓'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                        ({colCards.length})
                      </Typography>
                      {redCount > 0 && (
                        <Typography variant="caption" sx={{ color: '#ff5a5a' }}>
                          ● {redCount}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  
                  {col.done && (
                    <IconButton 
                      size="small" 
                      title="Alle Karten archivieren"
                      onClick={() => archiveColumn(col.name)}
                      sx={{ 
                        width: 22, 
                        height: 22,
                        border: '1px solid var(--line)',
                        backgroundColor: 'transparent'
                      }}
                    >
                      📦
                    </IconButton>
                  )}
                </Box>

                {/* Karten */}
                <Droppable droppableId={col.name}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{ 
                        flex: 1,
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: density === 'xcompact' ? 0 : 1,
                        minHeight: '200px',
                        backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.06)' : 'transparent',
                        outline: snapshot.isDraggingOver ? '2px dashed var(--line)' : 'none',
                        outlineOffset: snapshot.isDraggingOver ? '-4px' : '0',
                        transition: 'background-color 0.12s ease, outline-color 0.12s ease'
                      }}
                    >
                      {density === 'xcompact' ? (
                        // Grid-Layout für extrakompakt
                        <Box sx={{ 
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 1fr)',
                          gap: 0,
                          gridAutoRows: '18px'
                        }}>
                          {colCards.map((card, index) => renderCard(card, index))}
                        </Box>
                      ) : (
                        // Normale Liste
                        colCards.map((card, index) => renderCard(card, index))
                      )}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Box>
            );
          })}
        </Box>
      </DragDropContext>
    );
  };

  // Render Swimlanes (Verantwortlich)
  const renderSwimlanes = () => {
    const filtered = rows.filter(r => 
      !r["Archived"] && 
      (!searchTerm || Object.values(r).some(v => 
        String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );

    const stages = cols.map(c => c.name);
    const resps = Array.from(new Set(filtered.map(r => 
      String(r["Verantwortlich"] || "").trim() || "—"
    ))).sort();

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: `var(--rowheadw) ${stages.map(() => 'var(--colw)').join(' ')}`,
          gap: '8px',
          p: 2,
          alignItems: 'start'
        }}>
          {/* Corner */}
          <Box sx={{ 
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '10px 12px',
            minHeight: '48px'
          }} />

          {/* Column Headers */}
          {stages.map(stage => (
            <Box key={stage} sx={{ 
              position: 'sticky',
              top: 0,
              zIndex: 2,
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '10px 12px',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              fontSize: '14px',
              fontWeight: 600
            }}>
              {stage}
            </Box>
          ))}

          {/* Rows */}
          {resps.map(resp => (
            <>
              {/* Row Header */}
              <Box key={`header-${resp}`} sx={{ 
                position: 'sticky',
                left: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                minHeight: '48px'
              }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {resp}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                  {filtered.filter(r => (String(r["Verantwortlich"] || "").trim() || "—") === resp).length} Karten
                </Typography>
              </Box>

              {/* Cells */}
              {stages.map(stage => {
                const cellCards = filtered.filter(r => 
                  inferStage(r) === stage && 
                  (String(r["Verantwortlich"] || "").trim() || "—") === resp
                );

                return (
                  <Droppable key={`${stage}-${resp}`} droppableId={`${stage}||${resp}`}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.06)' : 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: '12px',
                          minHeight: '140px',
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '8px',
                          gap: 1
                        }}
                      >
                        {cellCards.map((card, index) => renderCard(card, index))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                );
              })}
            </>
          ))}
        </Box>
      </DragDropContext>
    );
  };

  // Render Swimlanes (Kategorie/Lane)
  const renderSwimlanesByLane = () => {
    const filtered = rows.filter(r => 
      !r["Archived"] && 
      (!searchTerm || Object.values(r).some(v => 
        String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );

    const stages = cols.map(c => c.name);
    const laneNames = lanes.length ? lanes : ["Allgemein"];

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: `var(--rowheadw) ${stages.map(() => 'var(--colw)').join(' ')}`,
          gap: '8px',
          p: 2,
          alignItems: 'start'
        }}>
          {/* Corner */}
          <Box sx={{ 
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '10px 12px',
            minHeight: '48px'
          }} />

          {/* Column Headers */}
          {stages.map(stage => (
            <Box key={stage} sx={{ 
              position: 'sticky',
              top: 0,
              zIndex: 2,
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '10px 12px',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              fontSize: '14px',
              fontWeight: 600
            }}>
              {stage}
            </Box>
          ))}

          {/* Rows */}
          {laneNames.map(laneName => (
            <>
              {/* Row Header */}
              <Box key={`header-${laneName}`} sx={{ 
                position: 'sticky',
                left: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                minHeight: '48px'
              }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {laneName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                  {filtered.filter(r => (r["Swimlane"] || laneNames[0]) === laneName).length} Karten
                </Typography>
              </Box>

              {/* Cells */}
              {stages.map(stage => {
                const cellCards = filtered.filter(r => 
                  inferStage(r) === stage && 
                  (r["Swimlane"] || laneNames[0]) === laneName
                );

                return (
                  <Droppable key={`${stage}-${laneName}`} droppableId={`${stage}||${laneName}`}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.06)' : 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: '12px',
                          minHeight: '140px',
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '8px',
                          gap: 1
                        }}
                      >
                        {cellCards.map((card, index) => renderCard(card, index))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                );
              })}
            </>
          ))}
        </Box>
      </DragDropContext>
    );
  };
// Render Edit Modal
const renderEditModal = () => {
  if (!selectedCard) return null;

  const stage = inferStage(selectedCard);
  const tasks = checklists[stage] || [];
  const statuses = (selectedCard.ChecklistDone && selectedCard.ChecklistDone[stage]) || [];

  return (
    <Dialog 
      open={editModalOpen} 
      onClose={() => setEditModalOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          color: 'text.primary'
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">
          Karte bearbeiten: {selectedCard["Nummer"]} - {selectedCard["Teil"]}
        </Typography>
        <IconButton onClick={() => setEditModalOpen(false)}>
          ×
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Tabs value={editTabValue} onChange={(e, v) => setEditTabValue(v)}>
          <Tab label="Details" />
          <Tab label="Status & Checkliste" />
          <Tab label="Team" />
        </Tabs>

        {/* Tab 0: Details */}
        {editTabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr', 
              gap: 2, 
              alignItems: 'center',
              mb: 3
            }}>
              <Typography>Nummer</Typography>
              <TextField
                size="small"
                value={selectedCard["Nummer"] || ""}
                onChange={(e) => {
                  selectedCard["Nummer"] = e.target.value;
                  setRows([...rows]);
                }}
              />

              <Typography>Name</Typography>
              <TextField
                size="small"
                value={selectedCard["Teil"] || ""}
                onChange={(e) => {
                  selectedCard["Teil"] = e.target.value;
                  setRows([...rows]);
                }}
              />

              <Typography>Verantwortlich</Typography>
              <Select
                size="small"
                value={selectedCard["Verantwortlich"] || ""}
                onChange={(e) => {
                  selectedCard["Verantwortlich"] = e.target.value;
                  setRows([...rows]);
                }}
              >
                {responsibles.map(resp => (
                  <MenuItem key={resp} value={resp}>{resp}</MenuItem>
                ))}
              </Select>

              <Typography>Fällig bis</Typography>
              <TextField
                size="small"
                type="date"
                value={String(selectedCard["Due Date"] || "").slice(0, 10)}
                onChange={(e) => {
                  selectedCard["Due Date"] = e.target.value;
                  setRows([...rows]);
                }}
              />

              <Typography>Swimlane</Typography>
              <Select
                size="small"
                value={selectedCard["Swimlane"] || ""}
                onChange={(e) => {
                  selectedCard["Swimlane"] = e.target.value;
                  setRows([...rows]);
                }}
              >
                {lanes.map(lane => (
                  <MenuItem key={lane} value={lane}>{lane}</MenuItem>
                ))}
              </Select>

              <Typography>Bild</Typography>
              <TextField
                size="small"
                type="file"
                inputProps={{ accept: "image/*" }}
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      selectedCard["Bild"] = ev.target?.result;
                      setRows([...rows]);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </Box>

            {selectedCard["Bild"] && (
              <Box sx={{ mb: 2 }}>
                <img 
                  src={selectedCard["Bild"]} 
                  alt="Karten-Bild"
                  style={{ maxWidth: '300px', width: '100%', height: 'auto', borderRadius: '8px' }}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Tab 1: Status & Checkliste */}
        {editTabValue === 1 && (
          <Box sx={{ p: 3 }}>
            {/* Status Section */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Statushistorie</Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => addStatusEntry(selectedCard)}
                >
                  🕓 Neuer Eintrag
                </Button>
              </Box>

              <Box sx={{ maxHeight: '300px', overflow: 'auto', mb: 3 }}>
                {(selectedCard.StatusHistory || []).map((entry: any, idx: number) => (
                  <Box key={idx} sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {entry.date || 'Datum'}
                          </TableCell>
                          <TableCell colSpan={2}>
                            <TextField
                            size="small"
                            fullWidth
                            multiline
                            minRows={1}
                            maxRows={3}
                            placeholder="Statusmeldung"
                            value={entry.message?.text || ""}
                            onChange={(e) => {
                              if (!entry.message) entry.message = { text: '', escalation: false };
                              entry.message.text = e.target.value;
                              updateStatusSummary(selectedCard);
                              setRows([...rows]);
                            }}
                          
                            />
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {['qualitaet', 'kosten', 'termine'].map(key => {
                          const labels = { qualitaet: 'Qualität', kosten: 'Kosten', termine: 'Termine' };
                          const val = entry[key] || { text: '', escalation: false };
                          
                          return (
                            <TableRow key={key}>
                              <TableCell>{labels[key as keyof typeof labels]}</TableCell>
                              <TableCell>
                               <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={1}
                                maxRows={4}
                                value={val.text || ""}
                                onChange={(e) => {
                                  if (!entry[key]) entry[key] = { text: '', escalation: false };
                                  entry[key].text = e.target.value;
                                  updateStatusSummary(selectedCard);
                                  setRows([...rows]);
                                }}
                                sx={{
                                  '& .MuiInputBase-root': {
                                    alignItems: 'flex-start'
                                  }
                                }}
                              />

                              </TableCell>
                              <TableCell>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={val.escalation || false}
                                      onChange={(e) => {
                                        if (!entry[key]) entry[key] = { text: '', escalation: false };
                                        entry[key].escalation = e.target.checked;
                                        updateStatusSummary(selectedCard);
                                        setRows([...rows]);
                                      }}
                                    />
                                  }
                                  label="Eskalation"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Checkliste Section */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Checkliste für Phase: {stage}
              </Typography>

              {tasks.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Keine Checkliste für diese Phase.
                </Typography>
              ) : (
                <List>
                  {tasks.map((task, i) => (
                    <ListItem key={i} sx={{ px: 0 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!statuses[i]}
                            onChange={(e) => {
                              if (!selectedCard.ChecklistDone) selectedCard.ChecklistDone = {};
                              if (!selectedCard.ChecklistDone[stage]) {
                                selectedCard.ChecklistDone[stage] = tasks.map(() => false);
                              }
                              selectedCard.ChecklistDone[stage][i] = e.target.checked;
                              setRows([...rows]);
                            }}
                          />
                        }
                        label={task}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Box>
        )}

        {/* Tab 2: Team */}
        {editTabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Team-Mitglieder
            </Typography>

            {/* Team-Mitglieder Liste */}
            <Box sx={{ mb: 3 }}>
              {(selectedCard.Team || []).map((member: any, idx: number) => (
                <Box key={idx} sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr auto', 
                  gap: 2, 
                  alignItems: 'center',
                  mb: 2,
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1
                }}>
                  <TextField
                    size="small"
                    label="Name"
                    value={member.name || ""}
                    onChange={(e) => {
                      if (!selectedCard.Team) selectedCard.Team = [];
                      selectedCard.Team[idx].name = e.target.value;
                      setRows([...rows]);
                    }}
                  />
                  <TextField
                    size="small"
                    label="Rolle"
                    value={member.role || ""}
                    onChange={(e) => {
                      if (!selectedCard.Team) selectedCard.Team = [];
                      selectedCard.Team[idx].role = e.target.value;
                      setRows([...rows]);
                    }}
                  />
                  <IconButton 
                    color="error"
                    onClick={() => {
                      if (!selectedCard.Team) selectedCard.Team = [];
                      selectedCard.Team.splice(idx, 1);
                      setRows([...rows]);
                    }}
                  >
                    🗑️
                  </IconButton>
                </Box>
              ))}
            </Box>

            {/* Neues Team-Mitglied hinzufügen */}
            <Button 
              variant="outlined" 
              onClick={() => {
                if (!selectedCard.Team) selectedCard.Team = [];
                selectedCard.Team.push({ name: '', role: '' });
                setRows([...rows]);
              }}
            >
              + Team-Mitglied hinzufügen
            </Button>

            {/* Team-Statistiken */}
            {selectedCard.Team && selectedCard.Team.length > 0 && (
              <Box sx={{ mt: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Team-Übersicht:
                </Typography>
                <Typography variant="body2">
                  {selectedCard.Team.length} Mitglieder
                </Typography>
                <Typography variant="body2">
                  Rollen: {Array.from(new Set(selectedCard.Team.map((m: any) => m.role).filter(Boolean))).join(', ')}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Button 
          variant="outlined"
          onClick={() => {
            if (window.confirm(`Soll die Karte "${selectedCard["Nummer"]} – ${selectedCard["Teil"]}" wirklich archiviert werden?`)) {
              selectedCard["Archived"] = "1";
              setRows([...rows]);
              setEditModalOpen(false);
            }
          }}
        >
          Archivieren
        </Button>
        <Button 
          variant="outlined" 
          color="error"
          onClick={() => {
            if (window.confirm(`Soll die Karte "${selectedCard["Nummer"]} – ${selectedCard["Teil"]}" wirklich gelöscht werden?`)) {
              if (window.confirm('Bist Du sicher, dass diese Karte dauerhaft gelöscht werden soll?')) {
                const idx = rows.findIndex(r => idFor(r) === idFor(selectedCard));
                if (idx >= 0) {
                  rows.splice(idx, 1);
                  setRows([...rows]);
                  setEditModalOpen(false);
                }
              }
            }
          }}
        >
          Löschen
        </Button>
        <Button variant="contained" onClick={() => setEditModalOpen(false)}>
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Neue Karte Dialog
const renderNewCardModal = () => {
  const [newCard, setNewCard] = useState({
    "Nummer": "",
    "Teil": "",
    "Board Stage": cols[0]?.name || "",
    "Status Kurz": "",
    "Verantwortlich": "",
    "Due Date": "",
    "Ampel": "grün",
    "Swimlane": lanes[0] || "Allgemein",
    "UID": `uid_${Date.now()}`
  });

  const handleSave = () => {
    if (!newCard.Nummer.trim() || !newCard.Teil.trim()) {
      alert('Nummer und Teil sind Pflichtfelder!');
      return;
    }

    // Prüfe ob Nummer bereits existiert
    const exists = rows.some(r => r.Nummer === newCard.Nummer);
    if (exists) {
      alert('Diese Nummer existiert bereits!');
      return;
    }

    // Füge neue Karte hinzu
    setRows([...rows, { ...newCard }]);
    setNewCardOpen(false);
    
    // Reset form
    setNewCard({
      "Nummer": "",
      "Teil": "",
      "Board Stage": cols[0]?.name || "",
      "Status Kurz": "",
      "Verantwortlich": "",
      "Due Date": "",
      "Ampel": "grün",
      "Swimlane": lanes[0] || "Allgemein",
      "UID": `uid_${Date.now()}`
    });
  };

  return (
    <Dialog 
      open={newCardOpen} 
      onClose={() => setNewCardOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        ➕ Neue Karte erstellen
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Nummer */}
          <TextField
            label="Nummer *"
            value={newCard.Nummer}
            onChange={(e) => setNewCard({...newCard, Nummer: e.target.value})}
            fullWidth
            required
          />
          
          {/* Teil */}
          <TextField
            label="Teil *"
            value={newCard.Teil}
            onChange={(e) => setNewCard({...newCard, Teil: e.target.value})}
            fullWidth
            required
          />
          
          {/* Spalte */}
          <FormControl fullWidth>
            <InputLabel>Spalte</InputLabel>
            <Select
              value={newCard["Board Stage"]}
              onChange={(e) => setNewCard({...newCard, "Board Stage": e.target.value})}
            >
              {cols.map(col => (
                <MenuItem key={col.id} value={col.name}>
                  {col.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Verantwortlich */}
          <FormControl fullWidth>
            <InputLabel>Verantwortlich</InputLabel>
            <Select
              value={newCard.Verantwortlich}
              onChange={(e) => setNewCard({...newCard, Verantwortlich: e.target.value})}
            >
              <MenuItem value="">Nicht zugewiesen</MenuItem>
              {responsibles.map(resp => (
                <MenuItem key={resp} value={resp}>
                  {resp}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Swimlane */}
          <FormControl fullWidth>
            <InputLabel>Projekt/Kategorie</InputLabel>
            <Select
              value={newCard.Swimlane}
              onChange={(e) => setNewCard({...newCard, Swimlane: e.target.value})}
            >
              {lanes.map(lane => (
                <MenuItem key={lane} value={lane}>
                  {lane}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Due Date */}
          <TextField
            label="Fälligkeitsdatum"
            type="date"
            value={newCard["Due Date"]}
            onChange={(e) => setNewCard({...newCard, "Due Date": e.target.value})}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          
          {/* Status */}
          <TextField
            label="Status"
            value={newCard["Status Kurz"]}
            onChange={(e) => setNewCard({...newCard, "Status Kurz": e.target.value})}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={() => setNewCardOpen(false)}>
          Abbrechen
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          sx={{ 
            backgroundColor: '#14c38e',
            '&:hover': { backgroundColor: '#0ea770' }
          }}
        >
          Karte erstellen
        </Button>
      </DialogActions>
    </Dialog>
  );
};


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
       {/* Board Title mit Settings */}
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
  <Typography variant="h5">
    Multiprojektboard
  </Typography>
  <IconButton 
    size="small"
    onClick={() => setSettingsOpen(true)}
    sx={{ 
      width: 32, 
      height: 32,
      border: '1px solid var(--line)',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.1)'
      }
    }}
    title="Einstellungen"
  >
    ⚙️
  </IconButton>
</Box>

        
        {/* Toolbar */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto auto auto auto auto auto auto',
          gap: 1.5,
          alignItems: 'center',
          mt: 2
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

          {/* Weitere Buttons */}
          <Button variant="outlined" size="small">
            CSV importieren
          </Button>
          <Button variant="outlined" size="small">
            Export CSV
          </Button>
          <Button variant="contained" size="small" onClick={() => setNewCardOpen(true)}>
            Neue Karte
          </Button>
        </Box>
      </Box>

{/* Einstellungen Button */}
          <Button 
            variant="outlined" 
            size="small"
            onClick={() => setSettingsOpen(true)}
            sx={{ 
              borderColor: 'var(--line)',
              color: 'var(--muted)',
              '&:hover': { 
                borderColor: 'var(--ink)',
                backgroundColor: 'rgba(0,0,0,0.04)' 
              }
            }}
          >
            ⚙️ Einstellungen
          </Button>

      {/* Board Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'columns' && renderColumns()}
        {viewMode === 'swim' && renderSwimlanes()}
        {viewMode === 'lane' && renderSwimlanesByLane()}
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
            onClick={() => setCols([...cols, { name: `Neue Spalte ${cols.length + 1}` }])}
            sx={{ alignSelf: 'flex-start' }}
          >
            + Spalte hinzufügen
          </Button>
        </Box>
      </Box>

      {/* Verantwortliche */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, color: 'var(--ink)' }}>
          👥 Verantwortliche
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {responsibles.map((person, index) => (
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
                value={person}
                onChange={(e) => {
                  const newResponsibles = [...responsibles];
                  newResponsibles[index] = e.target.value;
                  setResponsibles(newResponsibles);
                }}
                sx={{ flex: 1 }}
              />
              <IconButton 
                size="small"
                onClick={() => {
                  const newResponsibles = responsibles.filter((_, i) => i !== index);
                  setResponsibles(newResponsibles);
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
            onClick={() => setResponsibles([...responsibles, `Person ${responsibles.length + 1}`])}
            sx={{ alignSelf: 'flex-start' }}
          >
            + Person hinzufügen
          </Button>
        </Box>
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
      onClick={() => {
        setSettingsOpen(false);
        // Hier könntest du die Einstellungen speichern
        console.log('Einstellungen gespeichert');
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

      {/* Edit Modal */}
      {renderEditModal()}

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
              {/* Dialoge */}
        {renderEditModal()}
        {renderNewCardModal()}
      </Box>
    );
};
