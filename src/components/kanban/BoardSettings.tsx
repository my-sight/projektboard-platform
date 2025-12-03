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
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
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
      setError(t('boardSettings.boardNameRequired'));
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
      setError(error instanceof Error ? error.message : t('boardSettings.saveError'));
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
          {t('boardSettings.title')}
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
          <Tab label={t('boardSettings.general')} />
          <Tab label={t('boardSettings.view')} />
          <Tab label={t('boardSettings.columns')} />
          <Tab label={t('boardSettings.advanced')} />
        </Tabs>

        <Box sx={{ height: '400px', overflow: 'auto' }}>
          {/* General Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label={t('boardSettings.boardName')}
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                error={!formData.name.trim()}
                helperText={!formData.name.trim() ? t('boardSettings.boardNameRequired') : ''}
              />

              <TextField
                label={t('boardSettings.description')}
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('boardSettings.descriptionPlaceholder')}
              />

              <Divider />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('boardSettings.boardInfo')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('boardSettings.created')}: {new Date(board.created_at).toLocaleString('de-DE')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('boardSettings.lastModified')}: {new Date(board.updated_at).toLocaleString('de-DE')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('boardSettings.columnsCount')}: {(board.columns?.length ?? 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('boardSettings.cardsCount')}: {(board.columns ?? []).reduce((total, col) => total + (col.cards?.length || 0), 0)}
                </Typography>
              </Box>
            </Box>
          </TabPanel>

          {/* View Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FormControl fullWidth>
                <InputLabel>{t('boardSettings.defaultView')}</InputLabel>
                <Select
                  value={formData.settings.view_mode}
                  label={t('boardSettings.defaultView')}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, view_mode: e.target.value as any }
                  }))}
                >
                  <MenuItem value="columns">{t('boardSettings.viewColumns')}</MenuItem>
                  <MenuItem value="list">{t('boardSettings.viewList')}</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>{t('boardSettings.defaultDensity')}</InputLabel>
                <Select
                  value={formData.settings.density}
                  label={t('boardSettings.defaultDensity')}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, density: e.target.value as any }
                  }))}
                >
                  <MenuItem value="compact">{t('boardSettings.densityCompact')}</MenuItem>
                  <MenuItem value="normal">{t('boardSettings.densityNormal')}</MenuItem>
                  <MenuItem value="comfortable">{t('boardSettings.densityComfortable')}</MenuItem>
                </Select>
              </FormControl>

              <Divider />

              <Typography variant="subtitle2">
                {t('boardSettings.cardDisplay')}
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
                label={t('boardSettings.showAssignee')}
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
                label={t('boardSettings.showDueDates')}
              />
            </Box>
          </TabPanel>

          {/* Columns Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  {t('boardSettings.manageColumns')}
                </Typography>
                <Button startIcon={<AddIcon />} size="small">
                  {t('boardSettings.addColumn')}
                </Button>
              </Box>

              <List>
                {(board.columns ?? []).map((column, index) => (
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
                      secondary={`${column.cards?.length || 0} ${t('boardSettings.cards')}${column.is_done ? ` • ${t('boardSettings.doneColumn')}` : ''}`}
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {column.is_done && (
                          <Chip label={t('boardSettings.done')} size="small" color="success" />
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
                label={t('boardSettings.cardLimit')}
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
                helperText={t('boardSettings.unlimited')}
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
                label={t('boardSettings.autoArchive')}
              />

              <Divider />

              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  {t('boardSettings.dangerZone')}
                </Typography>
                <Button variant="outlined" color="error" size="small">
                  {t('boardSettings.archiveBoard')}
                </Button>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  {t('boardSettings.archiveBoardDesc')}
                </Typography>
              </Box>
            </Box>
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          {t('boardSettings.cancel')}
        </Button>

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !formData.name.trim()}
          startIcon={saving ? undefined : <SaveIcon />}
        >
          {saving ? t('boardSettings.saving') : t('boardSettings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
