'use client';

import { useState, useEffect } from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Typography, TextField, IconButton, Tabs, Tab, List, ListItem, Card
} from '@mui/material';
import { Settings, Close, ArrowUpward, ArrowDownward, Delete, Add, Inventory2 } from '@mui/icons-material';
import { useLanguage } from '@/contexts/LanguageContext';

interface KanbanSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    cols: any[];
    setCols: (cols: any[]) => void;
    checklistTemplates: Record<string, string[]>;
    setChecklistTemplates: (templates: Record<string, string[]>) => void;
    customLabels: { tr: string; sop: string };
    setCustomLabels: (labels: { tr: string; sop: string }) => void;
    boardName: string;
    setBoardName: (name: string) => void;
    boardDescription: string;
    setBoardDescription: (desc: string) => void;
    canManageSettings: boolean;
    onSave: (options?: any) => Promise<boolean | void>;
    loadCards: () => Promise<boolean>;
    onOpenArchive: () => void;
}

export function KanbanSettingsDialog({
    open,
    onClose,
    cols,
    setCols,
    checklistTemplates,
    setChecklistTemplates,
    customLabels,
    setCustomLabels,
    boardName,
    setBoardName,
    boardDescription,
    setBoardDescription,
    canManageSettings,
    onSave,
    loadCards,
    onOpenArchive
}: KanbanSettingsDialogProps) {
    const { t } = useLanguage();
    const [currentCols, setCurrentCols] = useState(cols);
    const [currentTemplates, setCurrentTemplates] = useState(checklistTemplates);
    const [localCustomLabels, setLocalCustomLabels] = useState(customLabels);
    const [tab, setTab] = useState(0);
    const [newColName, setNewColName] = useState('');

    // Sync state when dialog opens
    useEffect(() => {
        if (open) {
            setCurrentCols(cols);
            setCurrentTemplates(checklistTemplates);
            setLocalCustomLabels(customLabels);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleSave = async () => {
        // We pass the new settings to the parent via onSave
        // The parent (OriginalKanbanBoard) handles the local state updates to ensure correct order (e.g. card migration)

        // We update the parent state AND trigger the save
        // NOTE: In the original code, `saveSettings` reads from state. 
        // Since state updates are async, passing overrides is safer.
        const success = await onSave({
            settingsOverrides: {
                cols: currentCols,
                checklistTemplates: currentTemplates,
                trLabel: localCustomLabels.tr,
                sopLabel: localCustomLabels.sop
            }
        });

        if (success) {
            onClose();
            loadCards();
        }
    };

    const addChecklistItem = (colName: string) => {
        const currentList = currentTemplates[colName] || [];
        const newItem = `${t('kanban.newEntry')} ${currentList.length + 1}`;
        setCurrentTemplates({
            ...currentTemplates,
            [colName]: [...currentList, newItem]
        });
    };

    const updateChecklistItem = (colName: string, idx: number, text: string) => {
        const currentList = currentTemplates[colName] || [];
        const newList = [...currentList];
        newList[idx] = text;
        setCurrentTemplates({
            ...currentTemplates,
            [colName]: newList
        });
    };

    const deleteChecklistItem = (colName: string, idx: number) => {
        const currentList = currentTemplates[colName] || [];
        const newList = [...currentList];
        newList.splice(idx, 1);
        setCurrentTemplates({
            ...currentTemplates,
            [colName]: newList
        });
    };

    const handleMove = (id: string, dir: 'up' | 'down') => {
        const idx = currentCols.findIndex(c => c.id === id); if (idx === -1) return;
        const newC = [...currentCols]; const [rem] = newC.splice(idx, 1);
        newC.splice(dir === 'up' ? Math.max(0, idx - 1) : Math.min(newC.length, idx + 1), 0, rem);
        setCurrentCols(newC);
    };

    const handleAddCol = () => { if (newColName.trim()) { setCurrentCols([...currentCols, { id: `c${Date.now()}`, name: newColName, done: false }]); setNewColName(''); } };
    const handleDelCol = (id: string) => { if (confirm(t('kanban.deletePrompt'))) setCurrentCols(currentCols.filter(c => c.id !== id)); };
    const handleToggleDone = (id: string) => { setCurrentCols(currentCols.map(c => c.id === id ? { ...c, done: !c.done } : c)); }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Settings color="primary" /> {t('kanban.boardSettings')}<IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton></DialogTitle>
            <DialogContent dividers>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                    <Tab label={t('kanban.metaData')} />
                    <Tab label={t('kanban.columns')} />
                    <Tab label={t('kanban.checklists')} />
                </Tabs>

                {tab === 0 && (
                    <Box sx={{ pt: 1 }}>
                        <TextField label={t('kanban.boardName')} value={boardName} onChange={(e) => setBoardName(e.target.value)} fullWidth sx={{ mt: 2 }} disabled={!canManageSettings} />
                        <TextField label={t('kanban.description')} value={boardDescription} onChange={(e) => setBoardDescription(e.target.value)} fullWidth multiline rows={2} sx={{ mt: 2 }} disabled={!canManageSettings} />
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <TextField label="TR Label" value={localCustomLabels.tr} onChange={(e) => setLocalCustomLabels(prev => ({ ...prev, tr: e.target.value }))} fullWidth size="small" disabled={!canManageSettings} />
                            <TextField label="SOP Label" value={localCustomLabels.sop} onChange={(e) => setLocalCustomLabels(prev => ({ ...prev, sop: e.target.value }))} fullWidth size="small" disabled={!canManageSettings} />
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                            <Button variant="outlined" startIcon={<Inventory2 />} onClick={() => { onClose(); onOpenArchive(); }}>
                                {t('kanban.openArchive') || 'Archiv öffnen'}
                            </Button>
                        </Box>
                    </Box>
                )}

                {tab === 1 && (
                    <Box sx={{ pt: 1 }}>
                        <List dense>
                            {currentCols.map((col, idx) => (
                                <ListItem key={col.id} secondaryAction={
                                    <Box>
                                        <IconButton size="small" onClick={() => handleMove(col.id, 'up')} disabled={!canManageSettings || idx === 0}><ArrowUpward fontSize="small" /></IconButton>
                                        <IconButton size="small" onClick={() => handleMove(col.id, 'down')} disabled={!canManageSettings || idx === currentCols.length - 1}><ArrowDownward fontSize="small" /></IconButton>
                                        <Button size="small" onClick={() => handleToggleDone(col.id)} disabled={!canManageSettings} sx={{ ml: 1, border: '1px solid', borderColor: col.done ? 'success.main' : 'grey.400', color: col.done ? 'success.main' : 'text.primary' }}>{col.done ? t('kanban.done') : t('kanban.normal')}</Button>
                                        <IconButton onClick={() => handleDelCol(col.id)} disabled={!canManageSettings}><Delete /></IconButton>
                                    </Box>
                                }>
                                    <TextField
                                        value={col.name}
                                        onChange={(e) => {
                                            const newName = e.target.value;
                                            const oldName = col.name;

                                            // Update column name
                                            const nc = currentCols.map((c, i) => i === idx ? { ...c, name: newName } : c);
                                            setCurrentCols(nc);
                                            if (oldName !== newName && currentTemplates[oldName]) {
                                                const newT = { ...currentTemplates };
                                                newT[newName] = newT[oldName];
                                                delete newT[oldName];
                                                setCurrentTemplates(newT);
                                            }
                                        }}
                                        size="small"
                                        fullWidth
                                        sx={{ mr: 2 }}
                                        disabled={!canManageSettings}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <TextField size="small" label={t('kanban.newColumn')} value={newColName} onChange={(e) => setNewColName(e.target.value)} fullWidth disabled={!canManageSettings} />
                            <Button variant="contained" startIcon={<Add />} onClick={handleAddCol} disabled={!canManageSettings}>{t('kanban.add')}</Button>
                        </Box>
                    </Box>
                )}

                {tab === 2 && (
                    <Box sx={{ pt: 1, height: '400px', overflowY: 'auto' }}>
                        {currentCols.map((col) => (
                            <Card key={col.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>{col.name}</Typography>
                                <List dense>
                                    {(currentTemplates[col.name] || []).map((item, idx) => (
                                        <ListItem key={idx} disableGutters secondaryAction={
                                            <IconButton edge="end" onClick={() => deleteChecklistItem(col.name, idx)} disabled={!canManageSettings}>
                                                <Delete fontSize="small" color="error" />
                                            </IconButton>
                                        }>
                                            <TextField fullWidth size="small" value={item} onChange={(e) => updateChecklistItem(col.name, idx, e.target.value)} sx={{ mr: 2 }} disabled={!canManageSettings} />
                                        </ListItem>
                                    ))}
                                </List>
                                <Button startIcon={<Add />} size="small" onClick={() => addChecklistItem(col.name)} disabled={!canManageSettings}>{t('kanban.addItem')}</Button>
                            </Card>
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>{t('kanban.cancel')}</Button><Button onClick={handleSave} variant="contained" disabled={!canManageSettings}>{t('kanban.saveAndClose')}</Button></DialogActions>
        </Dialog>
    );
}
