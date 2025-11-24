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
  patchCard: (card: any, changes: any) => Promise<void | boolean>;
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
  patchCard
}: EditCardDialogProps) {
  if (!selectedCard) return null;

  const stage = inferStage(selectedCard);
  const tasks = checklistTemplates[stage] || [];
  const stageChecklist = (selectedCard.ChecklistDone && selectedCard.ChecklistDone[stage]) || {};

  // Helfer: Den aktuell ausgewählten User anhand ID oder Name finden
  const getCurrentUserValue = () => {
    if (selectedCard.userId) return selectedCard.userId;
    if (selectedCard.assigneeId) return selectedCard.assigneeId;
    
    // Fallback: Suche über den Namenstring
    const name = selectedCard['Verantwortlich'];
    if (!name) return '';
    const found = users.find(u => 
        (u.full_name && u.full_name === name) || 
        (u.name && u.name === name) ||
        (u.email && u.email === name)
    );
    return found ? found.id : ''; // Wenn nicht gefunden, leer lassen (oder man könnte den Namen als String lassen, aber Select braucht Value)
  };

  // Helfer: User setzen und alle Felder updaten
  const handleUserChange = (newId: string) => {
      const user = users.find(u => u.id === newId);
      if (user) {
          const displayName = user.full_name || user.name || user.email;
          // Update local state immediately
          selectedCard['Verantwortlich'] = displayName;
          selectedCard['userId'] = user.id;
          selectedCard['assigneeId'] = user.id; // Redundanz für Teamboard-Kompatibilität
          selectedCard['email'] = user.email;
      } else {
          // Reset
          selectedCard['Verantwortlich'] = '';
          selectedCard['userId'] = null;
          selectedCard['assigneeId'] = null;
          selectedCard['email'] = null;
      }
      setRows([...rows]);
      // Trigger save/patch
      if (patchCard) {
          patchCard(selectedCard, {
              Verantwortlich: selectedCard['Verantwortlich'],
              userId: selectedCard['userId'],
              assigneeId: selectedCard['assigneeId'],
              email: selectedCard['email']
          });
      }
  };

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
              <FormControl size="small" fullWidth>
                  <Select
                    value={getCurrentUserValue()}
                    displayEmpty
                    onChange={(e) => handleUserChange(e.target.value as string)}
                    renderValue={(selected) => {
                        if (!selected) {
                            // Wenn keine ID da ist, zeige den Legacy-String an
                            return selectedCard['Verantwortlich'] || <em>Nicht zugewiesen</em>;
                        }
                        const u = users.find(user => user.id === selected);
                        return u ? (u.full_name || u.name || u.email) : (selectedCard['Verantwortlich'] || <em>Unbekannt</em>);
                    }}
                  >
                    <MenuItem value="">
                      <em>Nicht zugewiesen</em>
                    </MenuItem>
                    {users.map((user: any) => (
                      <MenuItem key={user.id || user.email} value={user.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {(user.full_name || user.name || user.email) ?? 'Unbekannt'}
                            {user.department || user.company ? ` – ${user.department || user.company}` : ''}
                          </Typography>
                          {user.email && (
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
              </FormControl>

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

              <Typography>Priorität</Typography>
              <Checkbox
                checked={toBoolean(selectedCard['Priorität'])}
                onChange={(e) => {
                  selectedCard['Priorität'] = e.target.checked;
                  setRows([...rows]);
                  setTimeout(() => saveCards(), 500);
                }}
              />

              <Typography>SOP</Typography>
              <TextField
                size="small"
                type="date"
                value={String(selectedCard['SOP_Datum'] || '').slice(0, 10)}
                onChange={(e) => {
                  selectedCard['SOP_Datum'] = e.target.value;
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
              {/* TR Datum Logic identical to original */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                TR-Datum (Original)
              </Typography>
              {selectedCard['TR_Datum'] ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, backgroundColor: 'action.hover', borderRadius: 1 }}>
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
                <Typography variant="subtitle2" sx={{ mb: 1 }}>TR neu</Typography>
                <TextField
                  size="small"
                  type="date"
                  value={selectedCard['TR_Neu'] || ''}
                  onChange={(e) => handleTRNeuChange(selectedCard, e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

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
                          updatedRows[index] = newCard;
                          setRows(updatedRows);
                          setTimeout(() => saveCards(), 500);
                        }
                      }}
                      sx={{ color: 'success.main', '&.Mui-checked': { color: 'success.main' } }}
                    />
                  }
                  label="TR abgeschlossen"
                  sx={{ mt: 1, mb: 2 }}
                />
              )}
            </Box>
          </Box>
        )}

        {editTabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Team-Mitglieder</Typography>
            {/* Team logic same as original */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(() => {
                const userList = Array.isArray(users) ? users : [];
                const userById = new Map<string, any>();
                userList.forEach((user: any) => { if (user.id) userById.set(user.id, user); });

                return (selectedCard.Team || []).map((member: any, idx: number) => {
                  return (
                    <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '3fr 2fr auto', alignItems: 'flex-start', gap: 1, border: '1px solid var(--line)', borderRadius: 1, p: 1 }}>
                      <FormControl size="small" fullWidth>
                          <InputLabel>Mitglied</InputLabel>
                          <Select
                            value={member.userId || ''}
                            label="Mitglied"
                            onChange={(e) => {
                              const userId = String(e.target.value);
                              if (userId) {
                                const selected = userById.get(userId);
                                if (selected) {
                                  selectedCard.Team[idx] = {
                                    ...selectedCard.Team[idx],
                                    userId,
                                    name: selected.full_name || selected.name || selected.email,
                                    email: selected.email || '',
                                    department: selected.department || selected.company || '',
                                  };
                                }
                              }
                              setRows([...rows]);
                            }}
                          >
                            {userList.map((user: any) => (
                                <MenuItem key={user.id} value={user.id}>{user.full_name || user.email}</MenuItem>
                            ))}
                          </Select>
                      </FormControl>
                      <TextField size="small" label="Rolle" value={member.role || ''} onChange={(e) => { selectedCard.Team[idx].role = e.target.value; setRows([...rows]); }} />
                      <IconButton color="error" size="small" onClick={() => { selectedCard.Team.splice(idx, 1); setRows([...rows]); }}><Typography>🗑️</Typography></IconButton>
                    </Box>
                  );
                });
              })()}
            </Box>
            <Button variant="outlined" onClick={() => { if (!selectedCard.Team) selectedCard.Team = []; selectedCard.Team.push({ userId: '', name: '', role: '' }); setRows([...rows]); }} sx={{ mt: 1 }}>+ Team-Mitglied</Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Button variant="outlined" onClick={() => { if (window.confirm('Archivieren?')) { selectedCard['Archived'] = '1'; selectedCard['ArchivedDate'] = new Date().toLocaleDateString('de-DE'); setRows([...rows]); setEditModalOpen(false); setTimeout(() => saveCards(), 500); } }}>Archivieren</Button>
        <Button variant="outlined" color="error" onClick={() => { if (window.confirm('Wirklich löschen?')) { const idx = rows.findIndex((r) => idFor(r) === idFor(selectedCard)); if (idx >= 0) { rows.splice(idx, 1); setRows([...rows]); setEditModalOpen(false); } } }}>Löschen</Button>
        <Button variant="contained" onClick={() => setEditModalOpen(false)}>Schließen</Button>
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
                <TableCell>Verantwortlich</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {archivedCards.map((card, index) => (
                <TableRow key={index}>
                  <TableCell>{card.Nummer}</TableCell>
                  <TableCell>{card.Teil}</TableCell>
                  <TableCell>{card.Verantwortlich}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => restoreCard(card)} sx={{ mr: 1 }}>↩️</Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => deleteCardPermanently(card)}>🗑️</Button>
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
  const [newCard, setNewCard] = useState<any>({
    Nummer: '',
    Teil: '',
    'Board Stage': cols[0]?.name || '',
    Verantwortlich: '',
    'Due Date': '',
    'Priorität': false,
    SOP_Datum: '',
    Ampel: 'grün',
    Swimlane: lanes[0] || 'Allgemein',
    UID: `uid_${Date.now()}`,
    TR_Datum: '',
    TR_Neu: '',
    TR_History: [] as any[],
    userId: null,     // WICHTIG: ID speichern
    assigneeId: null  // WICHTIG: ID speichern
  });

  const handleUserChange = (id: string) => {
      const user = users.find(u => u.id === id);
      if (user) {
          setNewCard({
              ...newCard,
              userId: user.id,
              assigneeId: user.id,
              Verantwortlich: user.full_name || user.name || user.email,
              email: user.email
          });
      } else {
          setNewCard({ ...newCard, userId: null, assigneeId: null, Verantwortlich: '', email: null });
      }
  };

  const handleSave = () => {
    if (!newCard.Nummer.trim() || !newCard.Teil.trim()) {
      alert('Nummer und Teil sind Pflichtfelder!');
      return;
    }
    setRows([...rows, { ...newCard }]);
    setNewCardOpen(false);
    // Reset
    setNewCard({
      Nummer: '', Teil: '', 'Board Stage': cols[0]?.name || '', Verantwortlich: '', 'Due Date': '', 'Priorität': false,
      SOP_Datum: '', Ampel: 'grün', Swimlane: lanes[0] || 'Allgemein', UID: `uid_${Date.now()}`, TR_Datum: '', TR_Neu: '', TR_History: [], userId: null, assigneeId: null
    });
  };

  return (
    <Dialog open={newCardOpen} onClose={() => setNewCardOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>➕ Neue Karte erstellen</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Nummer *" value={newCard.Nummer} onChange={(e) => setNewCard({ ...newCard, Nummer: e.target.value })} />
          <TextField label="Teil *" value={newCard.Teil} onChange={(e) => setNewCard({ ...newCard, Teil: e.target.value })} />
          <FormControl fullWidth>
            <InputLabel>Phase</InputLabel>
            <Select value={newCard['Board Stage']} label="Phase" onChange={(e) => setNewCard({ ...newCard, 'Board Stage': e.target.value as string })}>
              {cols.map((col) => (<MenuItem key={col.name} value={col.name}>{col.name}</MenuItem>))}
            </Select>
          </FormControl>
          
          {/* USERS SELECT für NEUE Karte */}
          <FormControl fullWidth>
            <InputLabel>Verantwortlich</InputLabel>
            <Select
              value={newCard.userId || ''}
              label="Verantwortlich"
              onChange={(e) => handleUserChange(e.target.value as string)}
            >
              <MenuItem value=""><em>Keiner</em></MenuItem>
              {users.map((user: any) => (
                <MenuItem key={user.id} value={user.id}>
                    {user.full_name || user.name || user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Projekt/Kategorie</InputLabel>
            <Select value={newCard.Swimlane} label="Projekt/Kategorie" onChange={(e) => setNewCard({ ...newCard, Swimlane: e.target.value as string })}>
              {lanes.map((lane) => (<MenuItem key={lane} value={lane}>{lane}</MenuItem>))}
            </Select>
          </FormControl>
          <TextField label="Fälligkeitsdatum" type="date" value={newCard['Due Date']} onChange={(e) => setNewCard({ ...newCard, 'Due Date': e.target.value })} InputLabelProps={{ shrink: true }} />
          <FormControlLabel control={<Checkbox checked={Boolean(newCard['Priorität'])} onChange={(e) => setNewCard({ ...newCard, 'Priorität': e.target.checked })} />} label="Priorität" />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setNewCardOpen(false)}>Abbrechen</Button>
        <Button variant="contained" onClick={handleSave}>Karte erstellen</Button>
      </DialogActions>
    </Dialog>
  );
}