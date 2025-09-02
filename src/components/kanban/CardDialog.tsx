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
  Chip,
  Typography,
  IconButton,
  Divider,
  Avatar,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Flag as FlagIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { de } from 'date-fns/locale';
import { Card } from '@/types';

interface CardDialogProps {
  open: boolean;
  card: Card | null;
  onClose: () => void;
  onSave: (cardId: string, updates: Partial<Card>) => Promise<void>;
  onDelete: (cardId: string) => Promise<void>;
}

export default function CardDialog({ open, card, onClose, onSave, onDelete }: CardDialogProps) {
  const [formData, setFormData] = useState<Partial<Card>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (card) {
      setFormData({
        title: card.title,
        description: card.description || '',
        priority: card.priority,
        status: card.status,
        due_date: card.due_date,
        start_date: card.start_date,
        metadata: card.metadata || {}
      });
    }
    setError(null);
  }, [card]);

  const handleSave = async () => {
    if (!card || !formData.title?.trim()) {
      setError('Titel ist erforderlich');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const isNewCard = card.id.startsWith('temp-');
      
      if (isNewCard) {
        // Create new card
        const newCard = {
          ...formData,
          column_id: card.column_id,
          position: 0
        } as Omit<Card, 'id' | 'created_at' | 'updated_at'>;
        
        // This would need to be implemented in the parent component
        console.log('Creating new card:', newCard);
      } else {
        // Update existing card
        await onSave(card.id, formData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving card:', error);
      setError(error instanceof Error ? error.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!card || card.id.startsWith('temp-')) return;

    try {
      setDeleting(true);
      await onDelete(card.id);
      onClose();
    } catch (error) {
      console.error('Error deleting card:', error);
      setError(error instanceof Error ? error.message : 'Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    const currentTags = formData.metadata?.tags || [];
    if (currentTags.includes(newTag.trim())) return;

    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: [...currentTags, newTag.trim()]
      }
    }));
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = formData.metadata?.tags || [];
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: currentTags.filter(tag => tag !== tagToRemove)
      }
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  if (!card) return null;

  const isNewCard = card.id.startsWith('temp-');

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon sx={{ color: getPriorityColor(formData.priority || 'medium') }} />
            <Typography variant="h6">
              {isNewCard ? 'Neue Karte erstellen' : 'Karte bearbeiten'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Title */}
            <TextField
              label="Titel"
              fullWidth
              required
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              error={!formData.title?.trim()}
              helperText={!formData.title?.trim() ? 'Titel ist erforderlich' : ''}
            />

            {/* Description */}
            <TextField
              label="Beschreibung"
              fullWidth
              multiline
              rows={4}
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beschreibe die Aufgabe..."
            />

            {/* Priority and Status Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Priorität</InputLabel>
                <Select
                  value={formData.priority || 'medium'}
                  label="Priorität"
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                >
                  <MenuItem value="low">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#22c55e' }} />
                      Niedrig
                    </Box>
                  </MenuItem>
                  <MenuItem value="medium">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#eab308' }} />
                      Mittel
                    </Box>
                  </MenuItem>
                  <MenuItem value="high">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f97316' }} />
                      Hoch
                    </Box>
                  </MenuItem>
                  <MenuItem value="urgent">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef4444' }} />
                      Dringend
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || 'open'}
                  label="Status"
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                >
                  <MenuItem value="open">Offen</MenuItem>
                  <MenuItem value="in_progress">In Bearbeitung</MenuItem>
                  <MenuItem value="review">Review</MenuItem>
                  <MenuItem value="blocked">Blockiert</MenuItem>
                  <MenuItem value="done">Fertig</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Dates Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Startdatum"
                value={formData.start_date ? new Date(formData.start_date) : null}
                onChange={(date) => setFormData(prev => ({ 
                  ...prev, 
                  start_date: date ? date.toISOString().split('T')[0] : null 
                }))}
                slotProps={{
                  textField: { sx: { flex: 1 } }
                }}
              />
              <DatePicker
                label="Fälligkeitsdatum"
                value={formData.due_date ? new Date(formData.due_date) : null}
                onChange={(date) => setFormData(prev => ({ 
                  ...prev, 
                  due_date: date ? date.toISOString().split('T')[0] : null 
                }))}
                slotProps={{
                  textField: { sx: { flex: 1 } }
                }}
              />
            </Box>

            <Divider />

            {/* Tags Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LabelIcon fontSize="small" />
                Tags
              </Typography>
              
              {/* Existing Tags */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {(formData.metadata?.tags || []).map((tag: string, index: number) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>

              {/* Add New Tag */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Neuen Tag hinzufügen..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  sx={{ flex: 1 }}
                />
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  Hinzufügen
                </Button>
              </Box>
            </Box>

            {/* Card Info (for existing cards) */}
            {!isNewCard && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Karten-Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Erstellt: {new Date(card.created_at).toLocaleString('de-DE')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Zuletzt geändert: {new Date(card.updated_at).toLocaleString('de-DE')}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          {/* Delete Button (only for existing cards) */}
          {!isNewCard && (
            <Tooltip title="Karte löschen">
              <IconButton
                onClick={handleDelete}
                disabled={deleting}
                color="error"
                sx={{ mr: 'auto' }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}

          <Button onClick={onClose} disabled={saving || deleting}>
            Abbrechen
          </Button>
          
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || deleting || !formData.title?.trim()}
            startIcon={saving ? undefined : <SaveIcon />}
          >
            {saving ? 'Speichern...' : isNewCard ? 'Erstellen' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
