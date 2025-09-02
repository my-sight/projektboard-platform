'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  IconButton,
  Divider,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { Board } from '@/types';

interface BoardSettingsProps {
  open: boolean;
  board: Board | null;
  onClose: () => void;
  onSave: (settings: any) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ height: '100%' }}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function BoardSettings({ open, board, onClose, onSave }: BoardSettingsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    settings: {
      view_mode: 'columns' as 'columns' | 'list',
      density: 'normal' as 'compact' | 'normal' | 'comfortable',
      show_assignee: true,
      show_due_dates: true,
      auto_archive: false,
      card_limit_per_column: null as number | null
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (board) {
      setFormData({
        name: board.name,
        description: board.description || '',
        settings: {
          view_mode: board.settings?.view_mode || 'columns',
          density: board.settings?.density || 'normal',
          show_assignee: board.settings?.show_assignee ?? true,
          show_due_dates: board.settings?.show_due_dates ?? true,
          auto_archive: board.settings?.auto_archive ?? false,
          card_limit_per_column: board.settings?.card_limit_per_column || null
        }
      });
    }
    setError(null);
  }, [board]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Board-Name ist erforderlich');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await onSave({
        name: formData.name,
        description: formData.description,
        settings: formData.settings
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving board settings:', error);
      setError(error instanceof Error ? error.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (!board) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6">
          Board-Einstellungen
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Tabs 
          value={tabValue} 
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Allgemein" />
          <Tab label="Ansicht" />
          <Tab label="Spalten" />
          <Tab label="Erweitert" />
        </Tabs>

        <Box sx={{ height: '400px', overflow: 'auto' }}>
          {/* General Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Board-Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                error={!formData.name.trim()}
                helperText={!formData.name.trim() ? 'Board-Name ist erforderlich' : ''}
              />

              <TextField
                label="Beschreibung"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibe das Board..."
              />

              <Divider />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Board-Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Erstellt: {new Date(board.created_at).toLocaleString('de-DE')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Zuletzt geändert: {new Date(board.updated_at).toLocaleString('de-DE')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Spalten: {board.board_columns?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Karten: {board.board_columns?.reduce((total, col) => total + (col.cards?.length || 0), 0) || 0}
                </Typography>
              </Box>
            </Box>
          </TabPanel>

          {/* View Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Standard-Ansicht</InputLabel>
                <Select
                  value={formData.settings.view_mode}
                  label="Standard-Ansicht"
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, view_mode: e.target.value as any }
                  }))}
                >
                  <MenuItem value="columns">Spalten-Ansicht</MenuItem>
                  <MenuItem value="list">Listen-Ansicht</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Standard-Dichte</InputLabel>
                <Select
                  value={formData.settings.density}
                  label="Standard-Dichte"
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, density: e.target.value as any }
                  }))}
                >
                  <MenuItem value="compact">Kompakt</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="comfortable">Komfortabel</MenuItem>
                </Select>
              </FormControl>

              <Divider />

              <Typography variant="subtitle2">
                Karten-Anzeige
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.show_assignee}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, show_assignee: e.target.checked }
                    }))}
                  />
                }
                label="Zugewiesene Personen anzeigen"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.show_due_dates}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, show_due_dates: e.target.checked }
                    }))}
                  />
                }
                label="Fälligkeitsdaten anzeigen"
              />
            </Box>
          </TabPanel>

          {/* Columns Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  Spalten verwalten
                </Typography>
                <Button startIcon={<AddIcon />} size="small">
                  Spalte hinzufügen
                </Button>
              </Box>

              <List>
                {board.board_columns?.map((column, index) => (
                  <ListItem key={column.id} divider>
                    <DragIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: column.color || '#6b7280',
                        mr: 2
                      }}
                    />
                    <ListItemText
                      primary={column.name}
                      secondary={`${column.cards?.length || 0} Karten${column.is_done ? ' • Fertig-Spalte' : ''}`}
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {column.is_done && (
                          <Chip label="Fertig" size="small" color="success" />
                        )}
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </TabPanel>

          {/* Advanced Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Karten-Limit pro Spalte"
                type="number"
                fullWidth
                value={formData.settings.card_limit_per_column || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { 
                    ...prev.settings, 
                    card_limit_per_column: e.target.value ? parseInt(e.target.value) : null 
                  }
                }))}
                helperText="Leer lassen für unbegrenzt"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.settings.auto_archive}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, auto_archive: e.target.checked }
                    }))}
                  />
                }
                label="Automatisches Archivieren nach 30 Tagen in 'Fertig'"
              />

              <Divider />

              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Gefährliche Aktionen
                </Typography>
                <Button variant="outlined" color="error" size="small">
                  Board archivieren
                </Button>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Das Board wird ausgeblendet, aber nicht gelöscht.
                </Typography>
              </Box>
            </Box>
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Abbrechen
        </Button>
        
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !formData.name.trim()}
          startIcon={saving ? undefined : <SaveIcon />}
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
