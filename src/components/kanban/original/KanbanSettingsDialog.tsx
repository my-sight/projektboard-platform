'use client';

import { useState, useEffect } from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Typography, TextField, IconButton, Tabs, Tab, List, ListItem, Card, Tooltip
} from '@mui/material';
import { Settings, Close, ArrowUpward, ArrowDownward, Delete, Add, Inventory2, Share } from '@mui/icons-material';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

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
    lanes: string[];
    boardMeta?: any;
    boardId?: string;
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
    onOpenArchive,
    lanes,
    boardMeta,
    boardId
}: KanbanSettingsDialogProps) {
    const { t } = useLanguage();
    const [currentCols, setCurrentCols] = useState(cols);
    const [currentLanes, setCurrentLanes] = useState(lanes || []);
    const [currentTemplates, setCurrentTemplates] = useState(checklistTemplates);
    const [localCustomLabels, setLocalCustomLabels] = useState(customLabels);
    const [localName, setLocalName] = useState(boardName);
    const [localDesc, setLocalDesc] = useState(boardDescription);
    const [tab, setTab] = useState(0);
    const [conBoards, setConBoards] = useState<any[]>([]);

    useEffect(() => {
        if (open && tab === 4 && boardId && !boardMeta?.parent_id) {
            supabase.from('kanban_boards').select('*').eq('parent_id', boardId)
                .then(({ data }) => {
                    if (data) setConBoards(data);
                });
        }
    }, [open, tab, boardId, boardMeta]);
    const [newColName, setNewColName] = useState('');
    const [newLaneName, setNewLaneName] = useState('');
    const [newChecklistItems, setNewChecklistItems] = useState<Record<string, string>>({});
    const [conBoardsList, setConBoardsList] = useState<any[]>([]);

    useEffect(() => {
        // Use boardId if available, fallback to boardMeta.id
        const bId = boardId || boardMeta?.id;
        console.log('Fetching Con-Boards for Parent ID:', bId, 'Tab:', tab, 'Open:', open);
        if (open && tab === 4 && bId) {
            const fetch = async () => {
                const { data, error } = await supabase.from('kanban_boards').select('*').eq('parent_id', bId);
                if (error) console.error('Error fetching Con-Boards:', error);
                if (data) {
                    console.log('Fetched Con-Boards:', data);
                    setConBoardsList(data);
                }
            };
            fetch();
        }
    }, [open, tab, boardMeta, boardId]);

    // Sync state when dialog opens
    useEffect(() => {
        if (open) {
            setCurrentCols(cols);
            setCurrentLanes(lanes || []);
            setCurrentTemplates(checklistTemplates);
            setLocalCustomLabels(customLabels);
            setLocalName(boardName);
            setLocalDesc(boardDescription);
            setNewLaneName('');
            setNewChecklistItems({});
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
            boardName: localName,
            boardDescription: localDesc,
            settingsOverrides: {
                cols: currentCols,
                lanes: currentLanes,
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
        const text = newChecklistItems[colName]?.trim();
        if (!text) return;

        const currentList = currentTemplates[colName] || [];
        setCurrentTemplates({
            ...currentTemplates,
            [colName]: [...currentList, text]
        });

        setNewChecklistItems(prev => ({ ...prev, [colName]: '' }));
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

    const handleAddLane = () => {
        if (newLaneName.trim()) {
            setCurrentLanes([...currentLanes, newLaneName.trim()]);
            setNewLaneName('');
        }
    };

    const handleDelLane = (idx: number) => { if (confirm(t('kanban.deletePrompt'))) setCurrentLanes(currentLanes.filter((_, i) => i !== idx)); };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Settings color="primary" /> {t('kanban.boardSettings')}<IconButton onClick={onClose} sx={{ ml: 'auto' }}><Close /></IconButton></DialogTitle>
            <DialogContent dividers>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                    <Tab label={t('kanban.metaData')} />
                    <Tab label={t('kanban.columns')} />
                    <Tab label="Lanes" />
                    <Tab label={t('kanban.checklists')} />
                    {!boardMeta?.parent_id && <Tab label="Con-Boards" />}
                </Tabs>

                {tab === 0 && (
                    <Box sx={{ pt: 1 }}>
                        <TextField label={t('kanban.boardName')} value={localName} onChange={(e) => setLocalName(e.target.value)} fullWidth sx={{ mt: 2 }} disabled={!canManageSettings} />
                        <TextField label={t('kanban.description')} value={localDesc} onChange={(e) => setLocalDesc(e.target.value)} fullWidth multiline rows={2} sx={{ mt: 2 }} disabled={!canManageSettings} />
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <TextField label="MS Label" value={localCustomLabels.tr} onChange={(e) => setLocalCustomLabels(prev => ({ ...prev, tr: e.target.value }))} fullWidth size="small" disabled={!canManageSettings} />
                            <TextField label={t('kanban.completionLabel')} value={localCustomLabels.sop} onChange={(e) => setLocalCustomLabels(prev => ({ ...prev, sop: e.target.value }))} fullWidth size="small" disabled={!canManageSettings} />
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                            <Tooltip title={t('kanban.openArchive') || 'Archiv öffnen'}>
                                <IconButton onClick={() => { onClose(); onOpenArchive(); }}>
                                    <Inventory2 />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                )}

                {tab === 1 && (
                    <Box sx={{ pt: 1 }}>
                        <Card variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {currentCols.map((col, idx) => (
                                    <Box key={col.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                            disabled={!canManageSettings || (idx === 0 && boardMeta?.parent_id)}
                                        />
                                        <Box sx={{ display: 'flex', flexShrink: 0 }}>
                                            <IconButton size="small" onClick={() => handleMove(col.id, 'up')} disabled={!canManageSettings || idx === 0}><ArrowUpward fontSize="small" /></IconButton>
                                            <IconButton size="small" onClick={() => handleMove(col.id, 'down')} disabled={!canManageSettings || idx === currentCols.length - 1 || (idx === 0 && boardMeta?.parent_id)}><ArrowDownward fontSize="small" /></IconButton>
                                            <Button size="small" onClick={() => handleToggleDone(col.id)} disabled={!canManageSettings} sx={{ ml: 1, border: '1px solid', borderColor: col.done ? 'success.main' : 'grey.400', color: col.done ? 'success.main' : 'text.primary', minWidth: '80px' }}>{col.done ? t('kanban.done') : t('kanban.normal')}</Button>
                                            <IconButton size="small" onClick={() => handleDelCol(col.id)} disabled={!canManageSettings} sx={{ ml: 0.5 }}><Delete fontSize="small" /></IconButton>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                <TextField size="small" label={t('kanban.newColumn')} value={newColName} onChange={(e) => setNewColName(e.target.value)} fullWidth disabled={!canManageSettings} />
                                <Button variant="outlined" startIcon={<Add />} onClick={handleAddCol} disabled={!canManageSettings}>{t('kanban.add')}</Button>
                            </Box>
                        </Card>
                    </Box>
                )}

                {tab === 3 && (
                    <Box sx={{ pt: 1, height: '400px', overflowY: 'auto' }}>
                        {currentCols.map((col) => (
                            <Card key={col.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>{col.name}</Typography>
                                <List dense>
                                    {(currentTemplates[col.name] || []).map((item, idx) => (
                                        <ListItem key={idx} disableGutters secondaryAction={
                                            <IconButton size="small" edge="end" onClick={() => deleteChecklistItem(col.name, idx)} disabled={!canManageSettings}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        }>
                                            <TextField fullWidth size="small" value={item} onChange={(e) => updateChecklistItem(col.name, idx, e.target.value)} sx={{ mr: 2 }} disabled={!canManageSettings} />
                                        </ListItem>
                                    ))}
                                </List>
                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        placeholder={t('kanban.newEntry')}
                                        value={newChecklistItems[col.name] || ''}
                                        onChange={(e) => setNewChecklistItems(prev => ({ ...prev, [col.name]: e.target.value }))}
                                        disabled={!canManageSettings}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addChecklistItem(col.name);
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        startIcon={<Add />}
                                        size="small"
                                        onClick={() => addChecklistItem(col.name)}
                                        disabled={!canManageSettings}
                                    >
                                        {t('kanban.add')}
                                    </Button>
                                </Box>
                            </Card>
                        ))}
                    </Box>
                )}

                {tab === 2 && (
                    <Box sx={{ pt: 1 }}>
                        <Card variant="outlined" sx={{ p: 2 }}>
                            <List dense>
                                {currentLanes.map((lane, idx) => (
                                    <ListItem key={idx} secondaryAction={
                                        <IconButton size="small" onClick={() => handleDelLane(idx)} disabled={!canManageSettings}><Delete fontSize="small" /></IconButton>
                                    }>
                                        <TextField
                                            value={lane}
                                            onChange={(e) => {
                                                const newLanes = [...currentLanes];
                                                newLanes[idx] = e.target.value;
                                                setCurrentLanes(newLanes);
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
                                <TextField
                                    size="small"
                                    label={t('kanban.viewLanes') || 'Lane'}
                                    value={newLaneName}
                                    onChange={(e) => setNewLaneName(e.target.value)}
                                    fullWidth
                                    disabled={!canManageSettings}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddLane();
                                        }
                                    }}
                                />
                                <Button variant="outlined" startIcon={<Add />} onClick={handleAddLane} disabled={!canManageSettings}>{t('kanban.add')}</Button>
                            </Box>
                        </Card>
                    </Box>
                )}

                {tab === 4 && !boardMeta?.parent_id && (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Con-Boards sind verbundene Boards, die Kopien aller Karten dieses Boards erhalten, aber einen eigenen Fortschritts-Status pflegen.
                        </Typography>
                        <TextField
                            label="Neues Con-Board erstellen"
                            placeholder="Name des Con-Boards"
                            fullWidth
                            disabled={!canManageSettings}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value;
                                    if (val.trim()) {
                                        await onSave({ createConBoard: val.trim() });
                                        (e.target as HTMLInputElement).value = '';
                                        loadCards(); // Reload to refresh list if needed
                                    }
                                }
                            }}
                        />
                        <Box sx={{ mt: 2 }}>
                            {/* List of existing con-boards would be loaded here, passed as prop? 
                              For now, we just rely on parent component to handle creation and maybe passing list down if needed.
                              But user requirement just said "ein elternboard kann beliebig viele con-boards haben".
                              We might need to pass `conBoards` prop to list them here.
                          */}
                            <Typography variant="caption">Drücken Sie Enter zum Erstellen.</Typography>
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>{t('kanban.cancel')}</Button><Button onClick={handleSave} variant="contained" disabled={!canManageSettings}>{t('kanban.saveAndClose')}</Button></DialogActions>
        </Dialog>
    );
}
