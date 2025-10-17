'use client';

import { useMemo, useState } from 'react';
import { toBoolean } from '@/utils/booleans';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

export interface EditCardDialogProps {
  selectedCard: any | null;
  editModalOpen: boolean;
  setEditModalOpen: (open: boolean) => void;
  editTabValue: number;
  setEditTabValue: (value: number) => void;
  rows: any[];
  setRows: (rows: any[]) => void;
  users: any[];
  lanes: string[];
  checklistTemplates: Record<string, string[]>;
  inferStage: (card: any) => string;
  addStatusEntry: (card: any) => void;
  updateStatusSummary: (card: any) => void;
  handleTRNeuChange: (card: any, newDate: string) => void;
  saveCards: () => void;
  idFor: (card: any) => string;
  setSelectedCard: (card: any) => void;
}

export function EditCardDialog({
  selectedCard,
  editModalOpen,
  setEditModalOpen,
  editTabValue,
  setEditTabValue,
  rows,
  setRows,
  users,
  lanes,
  checklistTemplates,
  inferStage,
  addStatusEntry,
  updateStatusSummary,
  handleTRNeuChange,
  saveCards,
  idFor,
  setSelectedCard,
}: EditCardDialogProps) {
  if (!selectedCard) return null;

  const stage = inferStage(selectedCard);
  const tasks = checklistTemplates[stage] || [];
  const stageChecklist = (selectedCard.ChecklistDone && selectedCard.ChecklistDone[stage]) || {};

  return (
    <Dialog
      open={editModalOpen}
      onClose={() => setEditModalOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          color: 'text.primary',
        },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">
          Karte bearbeiten: {selectedCard['Nummer']} - {selectedCard['Teil']}
        </Typography>
        <IconButton onClick={() => setEditModalOpen(false)}>×</IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs value={editTabValue} onChange={(e, v) => setEditTabValue(v)}>
          <Tab label="Details" />
          <Tab label="Status & Checkliste" />
          <Tab label="Team" />
        </Tabs>

        {editTabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr',
                gap: 2,
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Typography>Nummer</Typography>
              <TextField
                size="small"
                value={selectedCard['Nummer'] || ''}
                onChange={(e) => {
                  selectedCard['Nummer'] = e.target.value;
                  setRows([...rows]);
                }}
              />

              <Typography>Name</Typography>
              <TextField
                size="small"
                value={selectedCard['Teil'] || ''}
                onChange={(e) => {
                  selectedCard['Teil'] = e.target.value;
                  setRows([...rows]);
                }}
              />

              <Typography>Verantwortlich</Typography>
              <Select
                size="small"
                value={selectedCard['Verantwortlich'] || ''}
                onChange={(e) => {
                  selectedCard['Verantwortlich'] = e.target.value;
                  setRows([...rows]);
                }}
              >
                <MenuItem value="">
                  <em>Nicht zugewiesen</em>
                </MenuItem>
                {users.map((user: any) => (
                  <MenuItem key={user.id} value={user.name}>
                    {user.name} ({user.email})
                  </MenuItem>
                ))}
              </Select>

              <Typography>Fällig bis</Typography>
              <TextField
                size="small"
                type="date"
                value={String(selectedCard['Due Date'] || '').slice(0, 10)}
                onChange={(e) => {
                  selectedCard['Due Date'] = e.target.value;
                  setRows([...rows]);
                }}
              />

              <Typography>Swimlane</Typography>
              <Select
                size="small"
                value={selectedCard['Swimlane'] || ''}
                onChange={(e) => {
                  selectedCard['Swimlane'] = e.target.value;
                  setRows([...rows]);
                }}
              >
                {lanes.map((lane) => (
                  <MenuItem key={lane} value={lane}>
                    {lane}
                  </MenuItem>
                ))}
              </Select>

              <Typography>Bild</Typography>
              <TextField
                size="small"
                type="file"
                inputProps={{ accept: 'image/*' }}
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      selectedCard['Bild'] = ev.target?.result;
                      setRows([...rows]);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </Box>

            {selectedCard['Bild'] && (
              <Box sx={{ mb: 2 }}>
                <img
                  src={selectedCard['Bild']}
                  alt="Karten-Bild"
                  style={{ maxWidth: '300px', width: '100%', height: 'auto', borderRadius: '8px' }}
                />
              </Box>
            )}
          </Box>
        )}

        {editTabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Statushistorie</Typography>
                <Button variant="outlined" size="small" onClick={() => addStatusEntry(selectedCard)}>
                  🕓 Neuer Eintrag
                </Button>
              </Box>

              <Box sx={{ maxHeight: '300px', overflow: 'auto', mb: 3 }}>
                {(selectedCard.StatusHistory || []).map((entry: any, idx: number) => (
                  <Box key={idx} sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>{entry.date || 'Datum'}</TableCell>
                          <TableCell colSpan={2}>
                            <TextField
                              size="small"
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={3}
                              placeholder="Statusmeldung"
                              value={entry.message?.text || ''}
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
                        {['qualitaet', 'kosten', 'termine'].map((key) => {
                          const labels: Record<string, string> = {
                            qualitaet: 'Qualität',
                            kosten: 'Kosten',
                            termine: 'Termine',
                          };
                          const val = entry[key] || { text: '', escalation: false };

                          return (
                            <TableRow key={key}>
                              <TableCell>{labels[key]}</TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  fullWidth
                                  multiline
                                  minRows={1}
                                  maxRows={4}
                                  value={val.text || ''}
                                  onChange={(e) => {
                                    if (!entry[key]) entry[key] = { text: '', escalation: false };
                                    entry[key].text = e.target.value;
                                    updateStatusSummary(selectedCard);
                                    setRows([...rows]);
                                  }}
                                  sx={{
                                    '& .MuiInputBase-root': {
                                      alignItems: 'flex-start',
                                    },
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

            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Checkliste für Phase: {stage}
              </Typography>
              <List>
                {tasks.map((task) => {
                  const checked = stageChecklist[task];
                  return (
                    <ListItem key={task} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox
                        checked={Boolean(checked)}
                        onChange={(e) => {
                          if (!selectedCard.ChecklistDone) selectedCard.ChecklistDone = {};
                          if (!selectedCard.ChecklistDone[stage]) selectedCard.ChecklistDone[stage] = {};
                          selectedCard.ChecklistDone[stage][task] = e.target.checked;
                          setRows([...rows]);
                        }}
                      />
                      <Typography variant="body2">{task}</Typography>
                    </ListItem>
                  );
                })}
              </List>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                TR-Datum (Original)
              </Typography>
              {selectedCard['TR_Datum'] ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {new Date(selectedCard['TR_Datum']).toLocaleDateString('de-DE')}
                  </Typography>
                  <Chip label="Gesperrt" size="small" color="default" sx={{ fontSize: '10px' }} />
                </Box>
              ) : (
                <TextField
                  size="small"
                  type="date"
                  value={selectedCard['TR_Datum'] || ''}
                  onChange={(e) => {
                    if (e.target.value && !selectedCard['TR_Datum']) {
                      selectedCard['TR_Datum'] = e.target.value;
                      setRows([...rows]);
                    }
                  }}
                  helperText="Kann nach Eingabe nicht mehr geändert werden"
                  InputLabelProps={{ shrink: true }}
                />
              )}

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  TR neu
                </Typography>
                <TextField
                  size="small"
                  type="date"
                  value={selectedCard['TR_Neu'] || ''}
                  onChange={(e) => handleTRNeuChange(selectedCard, e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              <TextField
                label="TR-Datum"
                type="date"
                value={(selectedCard && (selectedCard['TR_Neu'] || selectedCard['TR_Datum'])) || ''}
                onChange={(e) => {
                  const newCard = { ...selectedCard };
                  newCard['TR_Neu'] = e.target.value;
                  setSelectedCard(newCard);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ mt: 2, mb: 2 }}
              />

              {(selectedCard['TR_Neu'] || selectedCard['TR_Datum']) && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={toBoolean(selectedCard['TR_Completed'])}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const completionTimestamp = checked ? new Date().toISOString() : null;
                        const newCard = { ...selectedCard, TR_Completed: checked };
                        newCard['TR_Completed_At'] = completionTimestamp;
                        newCard['TR_Completed_Date'] = completionTimestamp;
                        setSelectedCard(newCard);

                        const index = rows.findIndex((row) => idFor(row) === idFor(selectedCard));
                        if (index >= 0) {
                          const updatedRows = [...rows];
                          updatedRows[index] = {
                            ...updatedRows[index],
                            TR_Completed: checked,
                            TR_Completed_At: completionTimestamp,
                            TR_Completed_Date: completionTimestamp,
                          };
                          setRows(updatedRows);
                          setTimeout(() => saveCards(), 500);
                        }
                      }}
                      sx={{
                        color: 'success.main',
                        '&.Mui-checked': {
                          color: 'success.main',
                        },
                      }}
                    />
                  }
                  label="TR abgeschlossen"
                  sx={{ mt: 1, mb: 2 }}
                />
              )}

              {(selectedCard['TR_Datum'] || selectedCard['TR_Neu'] || (selectedCard['TR_History'] && selectedCard['TR_History'].length > 0)) && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--line)' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    TR-Termine
                  </Typography>

                  {selectedCard['TR_Datum'] && (
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#4caf50', mb: 0.5 }}>
                      TR ursprünglich: {new Date(selectedCard['TR_Datum']).toLocaleDateString('de-DE')}
                    </Typography>
                  )}

                  {(() => {
                    const history = selectedCard['TR_History'] || [];
                    const currentTRNeu = selectedCard['TR_Neu'];
                    const uniqueDates = new Set();
                    const uniqueEntries: any[] = [];

                    history.forEach((entry: any) => {
                      const entryDate = entry.date;
                      if (entryDate !== currentTRNeu && !uniqueDates.has(entryDate)) {
                        uniqueDates.add(entryDate);
                        uniqueEntries.push(entry);
                      }
                    });

                    return (
                      uniqueEntries.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          {uniqueEntries.map((trEntry: any, idx: number) => (
                            <Typography
                              key={`${trEntry.date}-${idx}`}
                              variant="body2"
                              sx={{
                                color: 'var(--muted)',
                                display: 'block',
                                textDecoration: 'line-through',
                                opacity: 0.7,
                                mb: 0.5,
                              }}
                            >
                              TR geändert: {new Date(trEntry.date).toLocaleDateString('de-DE')}
                              {trEntry.changedBy && (
                                <span style={{ fontSize: '12px', marginLeft: '8px' }}>(von {trEntry.changedBy})</span>
                              )}
                            </Typography>
                          ))}
                        </Box>
                      )
                    );
                  })()}

                  {selectedCard['TR_Neu'] && (
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196f3' }}>
                      TR aktuell: {new Date(selectedCard['TR_Neu']).toLocaleDateString('de-DE')}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {editTabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Team-Mitglieder
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(selectedCard.Team || []).map((member: any, idx: number) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 3fr 2fr auto',
                    alignItems: 'center',
                    gap: 1,
                    border: '1px solid var(--line)',
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <TextField
                    size="small"
                    label="Name"
                    value={member.name || ''}
                    onChange={(e) => {
                      selectedCard.Team[idx].name = e.target.value;
                      setRows([...rows]);
                    }}
                  />
                  <TextField
                    size="small"
                    label="E-Mail"
                    value={member.email || ''}
                    onChange={(e) => {
                      selectedCard.Team[idx].email = e.target.value;
                      setRows([...rows]);
                    }}
                  />
                  <TextField
                    size="small"
                    label="Rolle"
                    value={member.role || ''}
                    onChange={(e) => {
                      selectedCard.Team[idx].role = e.target.value;
                      setRows([...rows]);
                    }}
                    sx={{ minWidth: 120, maxWidth: 150 }}
                    placeholder="z.B. Dev, Design..."
                  />
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                      selectedCard.Team.splice(idx, 1);
                      setRows([...rows]);
                    }}
                    title="Mitglied entfernen"
                    sx={{
                      flexShrink: 0,
                      '&:hover': { backgroundColor: 'error.light', color: 'white' },
                    }}
                  >
                    🗑️
                  </IconButton>
                </Box>
              ))}
            </Box>

            <Button
              variant="outlined"
              onClick={() => {
                if (!selectedCard.Team) selectedCard.Team = [];
                selectedCard.Team.push({ userId: '', name: '', email: '', role: '' });
                setRows([...rows]);
              }}
              sx={{ mt: 1 }}
            >
              + Team-Mitglied hinzufügen
            </Button>

            {selectedCard.Team && selectedCard.Team.length > 0 && (
              <Box sx={{ mt: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Team-Übersicht:
                </Typography>
                <Typography variant="body2">{selectedCard.Team.length} Mitglieder</Typography>
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
            if (window.confirm(`Soll die Karte "${selectedCard['Nummer']} ${selectedCard['Teil']}" wirklich archiviert werden?`)) {
              selectedCard['Archived'] = '1';
              selectedCard['ArchivedDate'] = new Date().toLocaleDateString('de-DE');
              setRows([...rows]);
              setEditModalOpen(false);
              setTimeout(() => saveCards(), 500);
            }
          }}
        >
          Archivieren
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => {
            if (window.confirm(`Soll die Karte "${selectedCard['Nummer']} – ${selectedCard['Teil']}" wirklich gelöscht werden?`)) {
              if (window.confirm('Bist Du sicher, dass diese Karte dauerhaft gelöscht werden soll?')) {
                const idx = rows.findIndex((r) => idFor(r) === idFor(selectedCard));
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
}

export interface ArchiveDialogProps {
  archiveOpen: boolean;
  setArchiveOpen: (open: boolean) => void;
  archivedCards: any[];
  restoreCard: (card: any) => void;
  deleteCardPermanently: (card: any) => void;
}

export function ArchiveDialog({ archiveOpen, setArchiveOpen, archivedCards, restoreCard, deleteCardPermanently }: ArchiveDialogProps) {
  return (
    <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>📦 Archivierte Karten</DialogTitle>
      <DialogContent>
        {archivedCards.length === 0 ? (
          <Typography color="text.secondary">Keine archivierten Karten vorhanden.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nummer</TableCell>
                <TableCell>Teil</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Verantwortlich</TableCell>
                <TableCell>Archiviert am</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {archivedCards.map((card, index) => (
                <TableRow key={index}>
                  <TableCell>{card.Nummer}</TableCell>
                  <TableCell>{card.Teil}</TableCell>
                  <TableCell>{card['Status Kurz']}</TableCell>
                  <TableCell>{card.Verantwortlich}</TableCell>
                  <TableCell>{card.ArchivedDate || 'Unbekannt'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => restoreCard(card)} sx={{ mr: 1 }}>
                      ↩️ Wiederherstellen
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => deleteCardPermanently(card)}>
                      🗑️ Endgültig löschen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setArchiveOpen(false)}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}

export interface NewCardDialogProps {
  newCardOpen: boolean;
  setNewCardOpen: (open: boolean) => void;
  cols: { name: string }[];
  lanes: string[];
  rows: any[];
  setRows: (rows: any[]) => void;
  users: any[];
}

export function NewCardDialog({ newCardOpen, setNewCardOpen, cols, lanes, rows, setRows, users }: NewCardDialogProps) {
  const [newCard, setNewCard] = useState(() => ({
    Nummer: '',
    Teil: '',
    'Board Stage': cols[0]?.name || '',
    'Status Kurz': '',
    Verantwortlich: '',
    'Due Date': '',
    Ampel: 'grün',
    Swimlane: lanes[0] || 'Allgemein',
    UID: `uid_${Date.now()}`,
    TR_Datum: '',
    TR_Neu: '',
    TR_History: [] as any[],
  }));

  const handleSave = () => {
    if (!newCard.Nummer.trim() || !newCard.Teil.trim()) {
      alert('Nummer und Teil sind Pflichtfelder!');
      return;
    }

    if (rows.some((r) => r.Nummer === newCard.Nummer)) {
      alert('Diese Nummer existiert bereits!');
      return;
    }

    setRows([...rows, { ...newCard }]);
    setNewCardOpen(false);
    setNewCard({
      Nummer: '',
      Teil: '',
      'Board Stage': cols[0]?.name || '',
      'Status Kurz': '',
      Verantwortlich: '',
      'Due Date': '',
      Ampel: 'grün',
      Swimlane: lanes[0] || 'Allgemein',
      UID: `uid_${Date.now()}`,
      TR_Datum: '',
      TR_Neu: '',
      TR_History: [],
    });
  };

  const availableUsers = useMemo(() => users || [], [users]);

  return (
    <Dialog open={newCardOpen} onClose={() => setNewCardOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>➕ Neue Karte erstellen</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nummer *"
            value={newCard.Nummer}
            onChange={(e) => setNewCard({ ...newCard, Nummer: e.target.value })}
          />
          <TextField
            label="Teil *"
            value={newCard.Teil}
            onChange={(e) => setNewCard({ ...newCard, Teil: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Phase</InputLabel>
            <Select
              value={newCard['Board Stage']}
              label="Phase"
              onChange={(e) => setNewCard({ ...newCard, 'Board Stage': e.target.value as string })}
            >
              {cols.map((col) => (
                <MenuItem key={col.name} value={col.name}>
                  {col.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Verantwortlich</InputLabel>
            <Select
              value={newCard.Verantwortlich}
              label="Verantwortlich"
              onChange={(e) => setNewCard({ ...newCard, Verantwortlich: e.target.value as string })}
            >
              <MenuItem value="">
                <em>Keiner</em>
              </MenuItem>
              {availableUsers.map((user: any) => (
                <MenuItem key={user.id || user.email} value={user.name || user.email}>
                  {(user.name || user.email) ?? 'Unbekannt'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Projekt/Kategorie</InputLabel>
            <Select
              value={newCard.Swimlane}
              label="Projekt/Kategorie"
              onChange={(e) => setNewCard({ ...newCard, Swimlane: e.target.value as string })}
            >
              {lanes.map((lane) => (
                <MenuItem key={lane} value={lane}>
                  {lane}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Fälligkeitsdatum"
            type="date"
            value={newCard['Due Date']}
            onChange={(e) => setNewCard({ ...newCard, 'Due Date': e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Status"
            value={newCard['Status Kurz']}
            onChange={(e) => setNewCard({ ...newCard, 'Status Kurz': e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setNewCardOpen(false)}>Abbrechen</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ backgroundColor: '#14c38e', '&:hover': { backgroundColor: '#0ea770' } }}
        >
          Karte erstellen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
