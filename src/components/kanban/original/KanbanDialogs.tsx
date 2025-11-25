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
  Stack,
  InputAdornment
} from '@mui/material';
import { ProjectBoardCard } from '@/types';
import { Delete, Add } from '@mui/icons-material';

// DatePicker Imports
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/de';

dayjs.locale('de');

// --- EDIT CARD DIALOG ---

export interface EditCardDialogProps {
  selectedCard: ProjectBoardCard | null;
  editModalOpen: boolean;
  setEditModalOpen: (open: boolean) => void;
  editTabValue: number;
  setEditTabValue: (value: number) => void;
  rows: ProjectBoardCard[];
  setRows: (rows: ProjectBoardCard[]) => void;
  users: any[];
  lanes: string[];
  checklistTemplates: Record<string, string[]>;
  inferStage: (card: ProjectBoardCard) => string;
  addStatusEntry: (card: ProjectBoardCard) => void;
  updateStatusSummary: (card: ProjectBoardCard) => void;
  handleTRNeuChange: (card: ProjectBoardCard, newDate: string) => void;
  saveCards: () => void;
  patchCard: (card: ProjectBoardCard, changes: Partial<ProjectBoardCard>) => Promise<void | boolean>;
  idFor: (card: ProjectBoardCard) => string;
  setSelectedCard: (card: ProjectBoardCard) => void;
  canEdit?: boolean;
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
  patchCard,
  idFor,
  setSelectedCard,
  canEdit = true, 
}: EditCardDialogProps) {
  if (!selectedCard) return null;

  const stage = inferStage(selectedCard);
  const tasks = checklistTemplates[stage] || [];
  const stageChecklist = (selectedCard.ChecklistDone && selectedCard.ChecklistDone[stage]) || {};

  // Helper für sofortiges Speichern (Patch)
  const handlePatch = (key: keyof ProjectBoardCard, value: any) => {
     if (selectedCard) {
         const updated = { ...selectedCard, [key]: value };
         setSelectedCard(updated as ProjectBoardCard);
         patchCard(selectedCard, { [key]: value });
     }
  };

  // Helper: Bild-Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result;
          if (typeof result === 'string') {
              handlePatch('Bild', result);
          }
        };
        reader.readAsDataURL(file);
      }
  };

  // Helper: Datum lokal (Anzeige)
  const handleDateChangeLocal = (key: keyof ProjectBoardCard, newValue: dayjs.Dayjs | null) => {
      if (selectedCard) {
          const dateStr = newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : null;
          setSelectedCard({ ...selectedCard, [key]: dateStr } as ProjectBoardCard);
      }
  };

  // Helper: Datum speichern (Server)
  const handleDateAccept = (key: keyof ProjectBoardCard, newValue: dayjs.Dayjs | null) => {
      if (selectedCard) {
          const dateStr = newValue ? newValue.format('YYYY-MM-DD') : null;
          patchCard(selectedCard, { [key]: dateStr });
      }
  };

  // Schließen & Speichern
  const handleClose = () => {
      saveCards();
      setEditModalOpen(false);
  };

  return (
    <Dialog
      open={editModalOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { backgroundColor: 'background.paper', color: 'text.primary' },
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
          Karte {canEdit ? 'bearbeiten' : 'ansehen'}: {selectedCard.Nummer} - {selectedCard.Teil}
        </Typography>
        <IconButton onClick={handleClose}>×</IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
       <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <Tabs value={editTabValue} onChange={(e, v) => setEditTabValue(v)}>
          <Tab label="Details" />
          <Tab label="Status & Checkliste" />
          <Tab label="Team" />
        </Tabs>

        {/* TAB 1: DETAILS */}
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
                disabled={!canEdit}
                value={selectedCard.Nummer || ''}
                onChange={(e) => handlePatch('Nummer', e.target.value)}
              />

              <Typography>Name</Typography>
              <TextField
                size="small"
                disabled={!canEdit}
                value={selectedCard.Teil || ''}
                onChange={(e) => handlePatch('Teil', e.target.value)}
              />

              <Typography>Verantwortlich</Typography>
              <Select
                size="small"
                disabled={!canEdit}
                value={selectedCard.Verantwortlich || ''}
                onChange={(e) => {
                    const selectedName = e.target.value;
                    const selectedUser = users.find(u => (u.full_name || u.name || u.email) === selectedName);
                    
                    const updates: any = { Verantwortlich: selectedName };
                    if (selectedUser && selectedUser.email) {
                        updates['VerantwortlichEmail'] = selectedUser.email;
                    }
                    
                    if (selectedCard) {
                        const updated = { ...selectedCard, ...updates };
                        setSelectedCard(updated as ProjectBoardCard);
                        patchCard(selectedCard, updates);
                    }
                }}
              >
                <MenuItem value=""><em>Nicht zugewiesen</em></MenuItem>
                {users.map((user: any) => (
                  <MenuItem key={user.id || user.email} value={user.full_name || user.name || user.email}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(user.full_name || user.name || user.email) ?? 'Unbekannt'}
                        {user.department || user.company ? ` – ${user.department || user.company}` : ''}
                      </Typography>
                      {user.email && <Typography variant="caption" color="text.secondary">{user.email}</Typography>}
                    </Box>
                  </MenuItem>
                ))}
              </Select>

              <Typography>Fällig bis</Typography>
              <DatePicker 
                value={selectedCard['Due Date'] ? dayjs(selectedCard['Due Date']) : null}
                onChange={(val) => handleDateChangeLocal('Due Date', val)}
                onAccept={(val) => handleDateAccept('Due Date', val)}
                disabled={!canEdit}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />

              <Typography>Priorität</Typography>
              <Checkbox
                checked={toBoolean(selectedCard.Priorität)}
                disabled={!canEdit}
                onChange={(e) => handlePatch('Priorität', e.target.checked)}
              />

              <Typography>SOP</Typography>
              <DatePicker 
                value={selectedCard.SOP_Datum ? dayjs(selectedCard.SOP_Datum) : null}
                onChange={(val) => handleDateChangeLocal('SOP_Datum', val)}
                onAccept={(val) => handleDateAccept('SOP_Datum', val)}
                disabled={!canEdit}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />

              <Typography>Swimlane</Typography>
              <Select
                size="small"
                disabled={!canEdit}
                value={selectedCard.Swimlane || ''}
                onChange={(e) => handlePatch('Swimlane', e.target.value)}
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
                disabled={!canEdit}
                inputProps={{ accept: 'image/*' }}
                onChange={handleImageUpload}
              />
            </Box>

            {selectedCard.Bild && (
              <Box sx={{ mb: 2 }}>
                <img
                  src={selectedCard.Bild}
                  alt="Karten-Bild"
                  style={{ maxWidth: '300px', width: '100%', height: 'auto', borderRadius: '8px' }}
                />
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: STATUS & CHECKLISTE */}
        {editTabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Statushistorie</Typography>
                <Button variant="outlined" size="small" onClick={() => addStatusEntry(selectedCard)} disabled={!canEdit}>
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
                              disabled={!canEdit}
                              onChange={(e) => {
                                if (!entry.message) entry.message = { text: '', escalation: false };
                                entry.message.text = e.target.value;
                                updateStatusSummary(selectedCard);
                                setRows([...rows]); 
                              }}
                              onBlur={() => saveCards()} 
                            />
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {['qualitaet', 'kosten', 'termine'].map((key) => {
                          const labels: Record<string, string> = { qualitaet: 'Qualität', kosten: 'Kosten', termine: 'Termine' };
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
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    if (!entry[key]) entry[key] = { text: '', escalation: false };
                                    entry[key].text = e.target.value;
                                    updateStatusSummary(selectedCard);
                                    setRows([...rows]);
                                  }}
                                  onBlur={() => saveCards()}
                                />
                              </TableCell>
                              <TableCell>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={val.escalation || false}
                                      disabled={!canEdit}
                                      onChange={(e) => {
                                        if (!entry[key]) entry[key] = { text: '', escalation: false };
                                        entry[key].escalation = e.target.checked;
                                        updateStatusSummary(selectedCard);
                                        setRows([...rows]);
                                        saveCards();
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

            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Checkliste: {stage}</Typography>
              <List dense>
                {tasks.map((task) => {
                  const checked = stageChecklist[task];
                  return (
                    <ListItem key={task} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox
                        checked={Boolean(checked)}
                        disabled={!canEdit}
                        onChange={(e) => {
                          if (!selectedCard.ChecklistDone) selectedCard.ChecklistDone = {};
                          if (!selectedCard.ChecklistDone[stage]) selectedCard.ChecklistDone[stage] = {};
                          selectedCard.ChecklistDone[stage][task] = e.target.checked;
                          setRows([...rows]);
                          saveCards();
                        }}
                      />
                      <Typography variant="body2">{task}</Typography>
                    </ListItem>
                  );
                })}
              </List>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>TR-Datum</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                 <DatePicker 
                    label="Original"
                    value={selectedCard.TR_Datum ? dayjs(selectedCard.TR_Datum) : null}
                    onChange={(val) => handleDateChangeLocal('TR_Datum', val)}
                    onAccept={(val) => handleDateAccept('TR_Datum', val)}
                    disabled={!canEdit}
                    slotProps={{ textField: { size: 'small' } }}
                 />
                
                <DatePicker 
                    label="Aktuell (Neu)"
                    value={selectedCard.TR_Neu ? dayjs(selectedCard.TR_Neu) : null}
                    onChange={(val) => handleDateChangeLocal('TR_Neu', val)}
                    onAccept={(val) => {
                        const dateStr = val ? val.format('YYYY-MM-DD') : '';
                        handleTRNeuChange(selectedCard, dateStr);
                    }}
                    disabled={!canEdit}
                    slotProps={{ textField: { size: 'small' } }}
                 />
              </Box>

              {selectedCard.TR_History && selectedCard.TR_History.length > 0 && (
                  <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: '3px solid rgba(0,0,0,0.1)' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Historie:</Typography>
                      {selectedCard.TR_History.map((entry: any, idx: number) => {
                          if (entry.date === selectedCard.TR_Neu) return null;
                          if (idx > 0 && selectedCard.TR_History[idx-1].date === entry.date) return null;
                          
                          return (
                              <Typography key={idx} variant="caption" sx={{ display: 'block', textDecoration: 'line-through', color: 'text.disabled' }}>
                                  {new Date(entry.date).toLocaleDateString('de-DE')} 
                                  {entry.changedBy && ` (${entry.changedBy})`}
                              </Typography>
                          );
                      })}
                  </Box>
              )}
              
               {(selectedCard.TR_Neu || selectedCard.TR_Datum) && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={toBoolean(selectedCard.TR_Completed)}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const ts = checked ? new Date().toISOString() : null;
                        patchCard(selectedCard, { 
                            TR_Completed: checked, 
                            TR_Completed_At: ts, 
                            TR_Completed_Date: ts 
                        });
                        const updated = { ...selectedCard, TR_Completed: checked, TR_Completed_At: ts, TR_Completed_Date: ts };
                        setSelectedCard(updated as ProjectBoardCard);
                      }}
                    />
                  }
                  label="TR abgeschlossen"
                  sx={{ mt: 1, ml: 2 }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* TAB 3: TEAM */}
        {editTabValue === 2 && (
          <Box sx={{ p: 3 }}>
             <Typography variant="h6" sx={{ mb: 2 }}>Projekt-Team</Typography>
             
             <Stack spacing={2} sx={{ mt: 1 }}>
                 {(selectedCard.Team || []).map((member: any, idx: number) => (
                     <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 2, alignItems: 'center', p: 2, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 1 }}>
                         
                         <FormControl size="small" fullWidth>
                           <InputLabel>Mitglied</InputLabel>
                           <Select
                             value={member.userId || ''}
                             label="Mitglied"
                             disabled={!canEdit}
                             onChange={(e) => {
                                const selectedId = e.target.value;
                                const user = users.find((u: any) => u.id === selectedId);
                                const newTeam = [...(selectedCard.Team || [])];
                                if (user) {
                                   newTeam[idx] = { 
                                       ...newTeam[idx], 
                                       userId: user.id,
                                       name: user.full_name || user.name || user.email,
                                       email: user.email,
                                       department: user.department || user.company,
                                       userEmail: user.email
                                   };
                                }
                                handlePatch('Team', newTeam);
                             }}
                           >
                             <MenuItem value=""><em>Bitte wählen</em></MenuItem>
                             {users.map((user: any) => (
                               <MenuItem key={user.id} value={user.id}>
                                 <Box>
                                   <Typography variant="body2">{user.full_name || user.name || user.email}</Typography>
                                 </Box>
                               </MenuItem>
                             ))}
                           </Select>
                         </FormControl>

                         <TextField 
                            label="Rolle" 
                            size="small" 
                            value={member.role || ''} 
                            disabled={!canEdit}
                            onChange={(e) => {
                                const newTeam = [...(selectedCard.Team || [])];
                                newTeam[idx] = { ...newTeam[idx], role: e.target.value };
                                handlePatch('Team', newTeam);
                            }}
                         />
                         
                         <IconButton color="error" disabled={!canEdit} onClick={() => {
                             const newTeam = [...(selectedCard.Team || [])];
                             newTeam.splice(idx, 1);
                             handlePatch('Team', newTeam);
                         }}>
                             <Delete />
                         </IconButton>
                     </Box>
                 ))}
             </Stack>

             <Button 
                variant="outlined" 
                startIcon={<Add />} 
                disabled={!canEdit}
                onClick={() => {
                    const newTeam = [...(selectedCard.Team || []), { userId: '', name: '', role: '' }];
                    handlePatch('Team', newTeam);
                }}
                sx={{ mt: 2 }}
             >
                 Mitglied hinzufügen
             </Button>
          </Box>
        )}
       </LocalizationProvider>
      </DialogContent>

      {/* ✅ DIALOG ACTIONS mit LÖSCHEN-BUTTON LINKS */}
      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2, justifyContent: 'space-between' }}>
        {canEdit ? (
             <Button 
               color="error" 
               onClick={() => {
                  if (window.confirm('Karte wirklich löschen?')) {
                      // Da wir rows nicht haben (bzw. nicht manipulieren sollten), machen wir das via Parent Reload
                      // Alternativ: Direktes Array-Splicing (wie früher), aber das ist etwas dirty.
                      // Beste Lösung: Wir nutzen eine delete-Funktion falls vorhanden, oder den alten Weg:
                      const idx = rows.findIndex(r => idFor(r) === idFor(selectedCard));
                      if (idx !== -1) {
                          rows.splice(idx, 1);
                          setRows([...rows]);
                          saveCards(); // Autosave triggered
                          setEditModalOpen(false);
                      }
                  }
               }}
             >
               Löschen
             </Button>
        ) : <Box />}

        <Button variant="contained" onClick={handleClose}>
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- ARCHIVE DIALOG ---
export interface ArchiveDialogProps {
  archiveOpen: boolean;
  setArchiveOpen: (open: boolean) => void;
  archivedCards: ProjectBoardCard[];
  restoreCard: (card: ProjectBoardCard) => void;
  deleteCardPermanently: (card: ProjectBoardCard) => void;
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

// --- NEW CARD DIALOG ---

export interface NewCardDialogProps {
  newCardOpen: boolean;
  setNewCardOpen: (open: boolean) => void;
  cols: { name: string }[];
  lanes: string[];
  rows: ProjectBoardCard[];
  setRows: (rows: ProjectBoardCard[]) => void;
  users: any[];
  saveCards?: () => void;
}

export function NewCardDialog({ newCardOpen, setNewCardOpen, cols, lanes, rows, setRows, users, saveCards }: NewCardDialogProps) {
  const [newCard, setNewCard] = useState<Partial<ProjectBoardCard & { VerantwortlichEmail?: string }>>(() => ({
    Nummer: '',
    Teil: '',
    'Board Stage': cols[0]?.name || '',
    'Status Kurz': '',
    Verantwortlich: '',
    VerantwortlichEmail: '', 
    'Due Date': '',
    'Priorität': false,
    SOP_Datum: '',
    Ampel: 'grün',
    Swimlane: lanes[0] || 'Allgemein',
    UID: `uid_${Date.now()}`,
    TR_Datum: '',
    TR_Neu: '',
    TR_History: [] as any[],
  }));

  const availableUsers = useMemo(() => users || [], [users]);

  const handleSave = () => {
    if (!newCard.Nummer?.trim() || !newCard.Teil?.trim()) {
      alert('Nummer und Teil sind Pflichtfelder!');
      return;
    }
    
    setRows([...rows, newCard as ProjectBoardCard]);
    setNewCardOpen(false);
    
    if (saveCards) setTimeout(() => saveCards(), 100);
    
    setNewCard({
      Nummer: '',
      Teil: '',
      'Board Stage': cols[0]?.name || '',
      'Status Kurz': '',
      Verantwortlich: '',
      VerantwortlichEmail: '',
      'Due Date': '',
      'Priorität': false,
      SOP_Datum: '',
      Ampel: 'grün',
      Swimlane: lanes[0] || 'Allgemein',
      UID: `uid_${Date.now()}`,
      TR_Datum: '',
      TR_Neu: '',
      TR_History: [],
    });
  };

  return (
    <Dialog open={newCardOpen} onClose={() => setNewCardOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>➕ Neue Karte erstellen</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
       <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
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
            <InputLabel>Verantwortlich</InputLabel>
            <Select
              value={newCard.Verantwortlich}
              label="Verantwortlich"
              onChange={(e) => {
                  const selectedName = e.target.value;
                  const user = users.find(u => (u.full_name || u.name || u.email) === selectedName);
                  setNewCard({ 
                      ...newCard, 
                      Verantwortlich: selectedName as string,
                      VerantwortlichEmail: user?.email || ''
                  });
              }}
            >
              <MenuItem value="">
                <em>Keiner</em>
              </MenuItem>
              {availableUsers.map((user: any) => (
                <MenuItem key={user.id || user.email} value={user.full_name || user.name || user.email}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {(user.full_name || user.name || user.email) ?? 'Unbekannt'}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {lanes.length > 0 && (
              <FormControl fullWidth>
                 <InputLabel>Swimlane</InputLabel>
                 <Select
                    value={newCard.Swimlane || ''}
                    label="Swimlane"
                    onChange={(e) => setNewCard({...newCard, Swimlane: e.target.value as string})}
                 >
                    {lanes.map((lane) => (
                      <MenuItem key={lane} value={lane}>
                        {lane}
                      </MenuItem>
                    ))}
                 </Select>
              </FormControl>
          )}
          
          <DatePicker 
             label="Fälligkeitsdatum"
             value={newCard['Due Date'] ? dayjs(newCard['Due Date']) : null}
             onChange={(val) => setNewCard({ ...newCard, 'Due Date': val ? val.format('YYYY-MM-DD') : '' })}
             slotProps={{ textField: { fullWidth: true } }}
          />

          <FormControlLabel
            control={(
              <Checkbox
                checked={Boolean(newCard['Priorität'])}
                onChange={(e) =>
                  setNewCard({ ...newCard, 'Priorität': e.target.checked })
                }
              />
            )}
            label="Priorität"
          />

          <DatePicker 
             label="SOP Datum"
             value={newCard.SOP_Datum ? dayjs(newCard.SOP_Datum) : null}
             onChange={(val) => setNewCard({ ...newCard, SOP_Datum: val ? val.format('YYYY-MM-DD') : '' })}
             slotProps={{ textField: { fullWidth: true } }}
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
       </LocalizationProvider>
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