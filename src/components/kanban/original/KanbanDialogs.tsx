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
  InputAdornment,
  Tooltip,
  CircularProgress,
  ListSubheader
} from '@mui/material';
import { ProjectBoardCard } from '@/types';
import { Delete, Add, DeleteOutline, CloudUpload } from '@mui/icons-material';

import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import { useLanguage } from '@/contexts/LanguageContext';

// --- HELPER: BILD KOMPRIMIERUNG ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Komprimieren auf JPEG mit 70% Qualität
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          reject(new Error('Canvas Context failed'));
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
};

export interface EditCardDialogProps {
  selectedCard: ProjectBoardCard | null;
  editModalOpen: boolean;
  setEditModalOpen: (open: boolean) => void;
  editTabValue: number;
  setEditTabValue: (value: number) => void;
  rows: ProjectBoardCard[];
  setRows: (rows: ProjectBoardCard[]) => void;
  users: any[];
  boardMembers: any[];
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
  onDelete: (card: ProjectBoardCard) => void;
  trLabel?: string;
  sopLabel?: string;
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
  boardMembers,
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
  onDelete,
  trLabel = 'TR',
  sopLabel = 'SOP',
}: EditCardDialogProps) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);

  if (!selectedCard) return null;

  const updateStatusHistory = (newHistory: any[]) => {
    const updatedCard = { ...selectedCard, StatusHistory: newHistory };
    updateStatusSummary(updatedCard);
    setSelectedCard(updatedCard as ProjectBoardCard);

    // Important: Update the row in the main list so saveCards() sees the change
    const newRows = rows.map(r => idFor(r) === idFor(updatedCard) ? updatedCard : r);
    setRows(newRows as ProjectBoardCard[]);
  };

  const stage = inferStage(selectedCard);
  const tasks = checklistTemplates[stage] || [];
  const stageChecklist = (selectedCard.ChecklistDone && selectedCard.ChecklistDone[stage]) || {};

  const handlePatch = (key: keyof ProjectBoardCard, value: any) => {
    if (selectedCard) {
      const updated = { ...selectedCard, [key]: value };
      setSelectedCard(updated as ProjectBoardCard);
      patchCard(selectedCard, { [key]: value });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const compressedBase64 = await compressImage(file);
      handlePatch('Bild', compressedBase64);
    } catch (error) {
      console.error('Fehler beim Bild-Upload:', error);
      alert(t('kanban.imageProcessError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDateChangeLocal = (key: keyof ProjectBoardCard, newValue: dayjs.Dayjs | null) => {
    if (selectedCard) {
      const dateStr = newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : null;
      setSelectedCard({ ...selectedCard, [key]: dateStr } as ProjectBoardCard);
    }
  };

  const handleDateAccept = (key: keyof ProjectBoardCard, newValue: dayjs.Dayjs | null) => {
    if (selectedCard) {
      const dateStr = newValue ? newValue.format('YYYY-MM-DD') : null;
      patchCard(selectedCard, { [key]: dateStr });
    }
  };

  const handleDeleteStatusEntry = (index: number) => {
    if (!selectedCard.StatusHistory) return;
    if (!window.confirm(t('kanban.deleteEntryConfirm'))) return;

    const newHistory = [...selectedCard.StatusHistory];
    newHistory.splice(index, 1);

    updateStatusHistory(newHistory);
  };

  const handleClose = () => {
    saveCards();
    setEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditModalOpen(false);
  };

  return (
    <Dialog
      open={editModalOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        className: 'glass',
        sx: {
          backgroundImage: 'none',
          bgcolor: 'background.paper', // Fallback
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
        <Typography variant="h6" component="span">
          {canEdit ? t('kanban.editCard') : t('kanban.viewCard')}: {selectedCard.Nummer} - {selectedCard.Teil}
        </Typography>
        <IconButton onClick={handleClose}>×</IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs value={editTabValue} onChange={(e, v) => setEditTabValue(v)}>
          <Tab label={t('kanban.tabStatus')} />
          <Tab label={t('kanban.tabTeam')} />
          <Tab label={t('kanban.tabDetails')} />
        </Tabs>

        {/* TAB 0: STATUS & CHECKLISTE */}
        {editTabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{t('kanban.history')}</Typography>
                <Button variant="outlined" size="small" onClick={() => addStatusEntry(selectedCard)} disabled={!canEdit}>
                  🕓 {t('kanban.newEntry')}
                </Button>
              </Box>

              <Box sx={{ maxHeight: '400px', overflow: 'auto', mb: 3 }}>
                {(selectedCard.StatusHistory || []).map((entry: any, idx: number) => (
                  <Box key={idx} sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: 1, p: 2, position: 'relative' }}>
                    {canEdit && (
                      <Tooltip title={t('kanban.deleteEntry')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteStatusEntry(idx)}
                          sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, verticalAlign: 'top', pt: 1.5 }}>{entry.date || t('kanban.date')}</TableCell>
                          <TableCell colSpan={2}>
                            <TextField
                              size="small"
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={3}
                              placeholder={t('kanban.message')}
                              value={entry.message?.text || ''}
                              disabled={!canEdit}
                              onChange={(e) => {
                                const newHistory = JSON.parse(JSON.stringify(selectedCard.StatusHistory || []));
                                if (!newHistory[idx].message) newHistory[idx].message = { text: '', escalation: false };
                                newHistory[idx].message.text = e.target.value;
                                updateStatusHistory(newHistory);
                              }}
                              onBlur={() => saveCards()}
                            />
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {['qualitaet', 'kosten', 'termine'].map((key) => {
                          const labels: Record<string, string> = { qualitaet: t('kanban.quality'), kosten: t('kanban.cost'), termine: t('kanban.time') };
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
                                    const newHistory = JSON.parse(JSON.stringify(selectedCard.StatusHistory || []));
                                    if (!newHistory[idx][key]) newHistory[idx][key] = { text: '', escalation: false };
                                    newHistory[idx][key].text = e.target.value;
                                    updateStatusHistory(newHistory);
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
                                        const newHistory = JSON.parse(JSON.stringify(selectedCard.StatusHistory || []));
                                        if (!newHistory[idx][key]) newHistory[idx][key] = { text: '', escalation: false };
                                        newHistory[idx][key].escalation = e.target.checked;
                                        // Update state
                                        const updatedCard = { ...selectedCard, StatusHistory: newHistory };
                                        updateStatusSummary(updatedCard);
                                        setSelectedCard(updatedCard as ProjectBoardCard);
                                        const newRows = rows.map(r => idFor(r) === idFor(updatedCard) ? updatedCard : r);
                                        setRows(newRows as ProjectBoardCard[]);
                                        // Save immediately for checkboxes as there is no blur event
                                        setTimeout(() => saveCards(), 0);
                                      }}
                                    />
                                  }
                                  label={t('kanban.escalation')}
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
              <Typography variant="h6" sx={{ mb: 1 }}>{t('kanban.checklist')}: {stage}</Typography>
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
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{trLabel}-Datum</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <StandardDatePicker
                  label={`${trLabel} Original`}
                  value={selectedCard.TR_Datum ? dayjs(selectedCard.TR_Datum) : null}
                  onChange={(val) => handleDateChangeLocal('TR_Datum', val)}
                  onAccept={(val) => handleDateAccept('TR_Datum', val)}
                  disabled={!canEdit || !!selectedCard.TR_Datum}
                />

                <StandardDatePicker
                  label={`${trLabel} ${t('kanban.currentNew')}`}
                  value={selectedCard.TR_Neu ? dayjs(selectedCard.TR_Neu) : null}
                  onChange={(val) => handleDateChangeLocal('TR_Neu', val)}
                  onAccept={(val) => {
                    const dateStr = val ? val.format('YYYY-MM-DD') : '';
                    handleTRNeuChange(selectedCard, dateStr);
                  }}
                  disabled={!canEdit}
                />
              </Box>

              {/* ✅ FIX: Verwende `arr[idx-1]` statt `selectedCard.TR_History[idx-1]` */}
              {selectedCard.TR_History && selectedCard.TR_History.length > 0 && (
                <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: '3px solid rgba(0,0,0,0.1)' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{t('kanban.history')}:</Typography>
                  {/* Explizite Typisierung von arr */}
                  {(selectedCard.TR_History || []).map((entry: any, idx: number, arr: any[]) => {
                    if (entry.date === selectedCard.TR_Neu) return null;
                    // Hier lag der Fehler: arr ist sicher das gleiche Array
                    if (idx > 0 && arr[idx - 1].date === entry.date) return null;

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
                          TR_Completed_At: ts || undefined,
                          TR_Completed_Date: ts || undefined
                        });
                        const updated = {
                          ...selectedCard,
                          TR_Completed: checked,
                          TR_Completed_At: ts || undefined,
                          TR_Completed_Date: ts || undefined
                        };
                        setSelectedCard(updated as ProjectBoardCard);
                      }}
                    />
                  }
                  label={`${trLabel} erledigt`}
                  sx={{ mt: 1, ml: 2 }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* TAB 1: TEAM */}
        {editTabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('kanban.projectTeam')}</Typography>

            <Stack spacing={2} sx={{ mt: 1 }}>
              {(selectedCard.Team || []).map((member: any, idx: number) => (
                <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, alignItems: 'center', p: 2, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 1 }}>

                  <FormControl size="small" fullWidth>
                    <InputLabel>{t('kanban.member')}</InputLabel>
                    <Select
                      value={member.userId || ''}
                      label={t('kanban.member')}
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
                            department: user.department || user.company
                          };
                        }
                        handlePatch('Team', newTeam);
                      }}
                    >
                      <MenuItem value=""><em>{t('kanban.select')}</em></MenuItem>
                      {(() => {
                        // Sort users by department then name
                        const sortedUsers = [...users].sort((a, b) => {
                          const deptA = (a.department || a.company || t('kanban.noDepartment')).toLowerCase();
                          const deptB = (b.department || b.company || t('kanban.noDepartment')).toLowerCase();
                          if (deptA < deptB) return -1;
                          if (deptA > deptB) return 1;
                          const nameA = (a.full_name || a.name || a.email).toLowerCase();
                          const nameB = (b.full_name || b.name || b.email).toLowerCase();
                          return nameA.localeCompare(nameB);
                        });

                        const items: JSX.Element[] = [];
                        let lastDept = '';

                        sortedUsers.forEach((user) => {
                          const currentDept = user.department || user.company || t('kanban.noDepartment');
                          if (currentDept !== lastDept) {
                            items.push(
                              <ListSubheader key={`header-${currentDept}`} sx={{ bgcolor: 'background.paper', fontWeight: 'bold', lineHeight: '32px' }}>
                                {currentDept}
                              </ListSubheader>
                            );
                            lastDept = currentDept;
                          }
                          items.push(
                            <MenuItem key={user.id} value={user.id}>
                              <Box>
                                <Typography variant="body2">
                                  {user.full_name || user.name || user.email}
                                </Typography>
                              </Box>
                            </MenuItem>
                          );
                        });
                        return items;
                      })()}
                    </Select>
                  </FormControl>



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
              {t('kanban.addMember')}
            </Button>
          </Box>
        )}

        {/* TAB 2: DETAILS */}
        {editTabValue === 2 && (
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
              <Typography>{t('kanban.number')}</Typography>
              <TextField
                size="small"
                disabled={!canEdit}
                value={selectedCard.Nummer || ''}
                onChange={(e) => handlePatch('Nummer', e.target.value)}
              />

              <Typography>{t('kanban.title')}</Typography>
              <TextField
                size="small"
                disabled={!canEdit}
                value={selectedCard.Teil || ''}
                onChange={(e) => handlePatch('Teil', e.target.value)}
              />

              <Typography>{t('kanban.responsible')}</Typography>
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
                <MenuItem value=""><em>{t('kanban.notAssigned')}</em></MenuItem>
                {boardMembers.map((user: any) => (
                  <MenuItem key={user.id || user.email} value={user.full_name || user.name || user.email}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(user.full_name || user.name || user.email) ?? t('kanban.unknown')}
                        {user.department || user.company ? ` – ${user.department || user.company}` : ''}
                      </Typography>
                      {user.email && <Typography variant="caption" color="text.secondary">{user.email}</Typography>}
                    </Box>
                  </MenuItem>
                ))}
              </Select>

              <Typography>{t('kanban.dueDate')}</Typography>
              <StandardDatePicker
                value={selectedCard['Due Date'] ? dayjs(selectedCard['Due Date']) : null}
                onChange={(val) => handleDateChangeLocal('Due Date', val)}
                onAccept={(val) => handleDateAccept('Due Date', val)}
                disabled={!canEdit}
              />

              <Typography>{t('kanban.priority')}</Typography>
              <Checkbox
                checked={toBoolean(selectedCard.Priorität)}
                disabled={!canEdit}
                onChange={(e) => handlePatch('Priorität', e.target.checked)}
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{sopLabel}-Datum</Typography>
              <StandardDatePicker
                value={selectedCard.SOP_Datum ? dayjs(selectedCard.SOP_Datum) : null}
                onChange={(val) => handleDateChangeLocal('SOP_Datum', val)}
                onAccept={(val) => handleDateAccept('SOP_Datum', val)}
                disabled={!canEdit}
              />

              <Typography>{t('kanban.image')}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
                  disabled={!canEdit || uploading}
                  size="small"
                >
                  {uploading ? t('kanban.compressing') : t('kanban.upload')}
                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                </Button>
                {selectedCard.Bild && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handlePatch('Bild', '')}
                    disabled={!canEdit}
                  >
                    {t('kanban.delete')}
                  </Button>
                )}
              </Box>
            </Box>

            {selectedCard.Bild && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <img
                  src={selectedCard.Bild}
                  alt="Karten-Bild"
                  style={{ maxWidth: '100%', maxHeight: '500px', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}

                />
              </Box>
            )}
          </Box>
        )}

      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && (
            <Button
              color="error"
              onClick={() => {
                onDelete(selectedCard);
                setEditModalOpen(false);
              }}
            >
              {t('kanban.delete')}
            </Button>
          )}
          <Button onClick={handleCancel}>
            {t('kanban.cancel')}
          </Button>
        </Box>

        <Button variant="contained" onClick={handleClose}>
          {t('kanban.saveAndClose')}
        </Button>
      </DialogActions>
    </Dialog >
  );
}

export function ArchiveDialog({ archiveOpen, setArchiveOpen, archivedCards, restoreCard, deleteCardPermanently }: any) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={archiveOpen}
      onClose={() => setArchiveOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        className: 'glass',
        sx: { backgroundImage: 'none' }
      }}
    >
      <DialogTitle>📦 {t('kanban.archive')}</DialogTitle>
      <DialogContent>
        {archivedCards.length === 0 ? (
          <Typography color="text.secondary">{t('kanban.archiveEmpty')}</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('kanban.number')}</TableCell>
                <TableCell>{t('kanban.title')}</TableCell>
                <TableCell>{t('kanban.status')}</TableCell>
                <TableCell>{t('kanban.responsible')}</TableCell>
                <TableCell>{t('kanban.archivedAt')}</TableCell>
                <TableCell align="right">{t('kanban.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {archivedCards.map((card: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{card.Nummer}</TableCell>
                  <TableCell>{card.Teil}</TableCell>
                  <TableCell>{card['Status Kurz']}</TableCell>
                  <TableCell>{card.Verantwortlich}</TableCell>
                  <TableCell>{card.ArchivedDate || t('kanban.unknown')}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => restoreCard(card)} sx={{ mr: 1 }}>
                      ↩️ {t('kanban.restore')}
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => deleteCardPermanently(card)}>
                      🗑️ {t('kanban.deletePermanently')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setArchiveOpen(false)}>{t('kanban.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function NewCardDialog({ newCardOpen, setNewCardOpen, cols, lanes, rows, setRows, users, boardMembers, saveCards, trLabel = 'TR', sopLabel = 'SOP' }: any) {
  const { t } = useLanguage();
  const [newCard, setNewCard] = useState<any>({
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

    UID: `uid_${Date.now()}`,
    TR_Datum: '',
    TR_Neu: '',
    TR_History: [],
  });

  const handleSave = () => {
    if (!newCard.Nummer?.trim() || !newCard.Teil?.trim()) {
      alert(t('kanban.requiredFields'));
      return;
    }

    setRows([...rows, newCard]);
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

      UID: `uid_${Date.now()}`,
      TR_Datum: '',
      TR_Neu: '',
      TR_History: [],
    });
  };

  return (
    <Dialog
      open={newCardOpen}
      onClose={() => setNewCardOpen(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'glass',
        sx: { backgroundImage: 'none' }
      }}
    >
      <DialogTitle>➕ {t('kanban.createCard')}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('kanban.number') + " *"}
            value={newCard.Nummer}
            onChange={(e) => setNewCard({ ...newCard, Nummer: e.target.value })}
          />
          <TextField
            label={t('kanban.title') + " *"}
            value={newCard.Teil}
            onChange={(e) => setNewCard({ ...newCard, Teil: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>{t('kanban.responsible')}</InputLabel>
            <Select
              value={newCard.Verantwortlich}
              label={t('kanban.responsible')}
              onChange={(e) => {
                const selectedName = e.target.value;
                const selectedUser = boardMembers.find((u: any) => (u.full_name || u.name || u.email) === selectedName);
                setNewCard({
                  ...newCard,
                  Verantwortlich: selectedName,
                  VerantwortlichEmail: selectedUser?.email || ''
                });
              }}
            >
              <MenuItem value=""><em>{t('kanban.notAssigned')}</em></MenuItem>
              {boardMembers.map((user: any) => (
                <MenuItem key={user.id || user.email} value={user.full_name || user.name || user.email}>
                  {user.full_name || user.name || user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <StandardDatePicker
            label={t('kanban.dueDate')}
            value={newCard['Due Date'] ? dayjs(newCard['Due Date']) : null}
            onChange={(val) => {
              setNewCard({
                ...newCard,
                'Due Date': val ? val.format('YYYY-MM-DD') : ''
              });
            }}
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

          <Box sx={{ display: 'flex', gap: 2 }}>
            <StandardDatePicker
              label={`${trLabel} ${t('kanban.original')}`}
              value={newCard.TR_Datum ? dayjs(newCard.TR_Datum) : null}
              onChange={(val) => {
                setNewCard({
                  ...newCard,
                  TR_Datum: val ? val.format('YYYY-MM-DD') : ''
                });
              }}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <StandardDatePicker
              label={`${sopLabel} ${t('kanban.date')}`}
              value={newCard.SOP_Datum ? dayjs(newCard.SOP_Datum) : null}
              onChange={(val) => {
                setNewCard({
                  ...newCard,
                  SOP_Datum: val ? val.format('YYYY-MM-DD') : ''
                });
              }}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>

          <TextField
            label={t('kanban.status')}
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
    </Dialog >
  );
}