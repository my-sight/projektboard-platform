
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSnackbar } from 'notistack';
import { ProjectBoardCard, ViewMode, LayoutDensity } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { KanbanPermissions } from './useKanbanPermissions';
import { useKanbanUtils } from './useKanbanUtils';
import { DEFAULT_COLS, DEFAULT_TEMPLATES } from '../constants';

export function useKanbanData(
    boardId: string,
    permissions: KanbanPermissions,
    viewMode: ViewMode,
    setViewMode: (m: ViewMode) => void,
    setDensity: (d: LayoutDensity) => void
) {
    const { t } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();

    const [rows, setRows] = useState<ProjectBoardCard[]>([]);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
    const [checklistTemplates, setChecklistTemplates] = useState<Record<string, string[]>>(DEFAULT_TEMPLATES);
    const [customLabels, setCustomLabels] = useState({ tr: 'TR', sop: 'SOP' });
    const [completedCount, setCompletedCount] = useState(0);
    const [boardMeta, setBoardMeta] = useState<{ name: string; description?: string | null; updated_at?: string | null } | null>(null);
    const [boardName, setBoardName] = useState('');
    const [boardDescription, setBoardDescription] = useState('');
    const [topTopics, setTopTopics] = useState<any[]>([]);

    const { inferStage, idFor, convertDbToCard, reindexByStage } = useKanbanUtils(cols, viewMode);

    const formatPocketBaseActionError = (action: string, error: any): string => {
        const message = error?.message || error?.toString();
        if (!message) return `${action} fehlgeschlagen: Unbekannter Fehler.`;
        return `${action} fehlgeschlagen: ${message}`;
    };

    const loadSettings = useCallback(async () => {
        try {
            const { data: record, error } = await supabase
                .from('kanban_boards')
                .select('*')
                .eq('id', boardId)
                .single();

            if (error) throw error;

            if (record) {
                setBoardMeta(record);
                setBoardName(record.name);
                setBoardDescription(record.description || '');
            }

            if (record?.settings) {
                const s = record.settings;
                if (s.cols) setCols(s.cols);
                if (s.lanes) setLanes(s.lanes);
                if (s.checklistTemplates) setChecklistTemplates(s.checklistTemplates);
                if (s.viewMode) setViewMode(s.viewMode);
                if (s.density) setDensity(s.density);
                if (s.trLabel || s.sopLabel) {
                    setCustomLabels({
                        tr: s.trLabel || 'TR',
                        sop: s.sopLabel || 'SOP'
                    });
                }
                if (s.completedCount) setCompletedCount(s.completedCount);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }, [boardId, setViewMode, setDensity]);

    const loadCards = useCallback(async () => {
        try {
            const { data: records, error } = await supabase
                .from('kanban_cards')
                .select('*')
                .eq('board_id', boardId);

            if (error) throw error;

            if (records && records.length > 0) {
                let loadedCards = records.map(convertDbToCard);
                // Filter out archived cards
                loadedCards = loadedCards.filter(c => c.Archived !== '1');

                // Initial client-side sort
                loadedCards.sort((a, b) => {
                    const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
                    const stageA = inferStage(a);
                    const stageB = inferStage(b);
                    if (stageA !== stageB) return pos(stageA) - pos(stageB);
                    return (a.position || 0) - (b.position || 0);
                });
                setRows(loadedCards);
                return true;
            }
            setRows([]);
            return false;
        } catch (error) {
            console.error('❌ Fehler beim Laden der Karten:', error);
            setRows([]);
            return false;
        }
    }, [boardId, convertDbToCard, inferStage]);

    const loadTopTopics = useCallback(async () => {
        try {
            const { data: records, error } = await supabase
                .from('board_top_topics')
                .select('*')
                .eq('board_id', boardId)
                .order('position', { ascending: true });

            if (error) throw error;
            setTopTopics(records as any[]);
        } catch (e) {
            console.error('Error loading top topics', e);
        }
    }, [boardId]);

    const saveSettings = useCallback(async (options?: { skipMeta?: boolean; settingsOverrides?: any; boardName?: string; boardDescription?: string }) => {
        if (!permissions.canManageSettings) {
            console.error('saveSettings blocked: No permission');
            enqueueSnackbar(t('kanban.noPermission') || 'Keine Berechtigung', { variant: 'error' });
            return false;
        }

        try {
            const settings = {
                cols,
                lanes,
                checklistTemplates,
                viewMode,
                // density prop comes from parent
                trLabel: customLabels.tr,
                sopLabel: customLabels.sop,
                lastUpdated: new Date().toISOString(),
                ...(options?.settingsOverrides || {})
            };

            const overrides = options?.settingsOverrides;

            // Detect column renaming logic
            if (overrides?.cols) {
                const oldColsMap = new Map(cols.map(c => [c.id, c.name]));
                const newCols = overrides.cols as any[];
                const renames: { oldName: string, newName: string }[] = [];

                newCols.forEach(nc => {
                    const oldName = oldColsMap.get(nc.id);
                    if (oldName && oldName !== nc.name) {
                        renames.push({ oldName, newName: nc.name });
                    }
                });

                if (renames.length > 0) {
                    console.log('Detected column renames:', renames);

                    // 1. Update local rows optimistically
                    setRows(prevRows => prevRows.map(row => {
                        const currentStage = (row["Board Stage"] || "").trim();
                        const rename = renames.find(r => r.oldName === currentStage);
                        if (rename) {
                            return { ...row, "Board Stage": rename.newName };
                        }
                        return row;
                    }));

                    // 2. Update cards in Supabase
                    // We do this in parallel with settings save or before. 
                    // To be safe, let's fire and forget or await if critical.
                    const updatePromises = renames.map(async ({ oldName, newName }) => {
                        // We need to update both the 'stage' column and the 'card_data->Board Stage' field
                        // Queries to find cards with old stage
                        const { data: cardsToUpdate, error: fetchError } = await supabase
                            .from('kanban_cards')
                            .select('id, card_data')
                            .eq('stage', oldName)
                            .eq('board_id', boardId);

                        if (fetchError || !cardsToUpdate) return;

                        const batchUpdates = cardsToUpdate.map(c => {
                            const newCardData = { ...c.card_data, "Board Stage": newName };
                            return supabase
                                .from('kanban_cards')
                                .update({
                                    stage: newName,
                                    card_data: newCardData
                                })
                                .eq('id', c.id);
                        });

                        await Promise.all(batchUpdates);
                    });

                    await Promise.all(updatePromises);
                }
            }

            const updateData: any = { settings };

            if (!options?.skipMeta) {
                // Use options passed from dialog if available (to avoid stale closure), else fallback to state
                const nameToUse = options?.boardName !== undefined ? options.boardName : boardName;
                const descToUse = options?.boardDescription !== undefined ? options.boardDescription : boardDescription;

                const trimmedName = nameToUse.trim();
                updateData.name = trimmedName || boardMeta?.name;
                updateData.description = descToUse.trim() || null;
            }

            console.log('Attempting to save board settings:', { boardId, updateData });

            const { data: record, error } = await supabase
                .from('kanban_boards')
                .update(updateData)
                .eq('id', boardId)
                .select()
                .maybeSingle();

            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }

            if (!record) {
                console.error('Supabase update returned no data (RLS check failed?)');
                throw new Error("Update successful but no data returned. Check RLS policies.");
            }

            if (record) {
                setBoardMeta(record);
                // dispatch event if needed
            }

            if (!options?.skipMeta) {
                enqueueSnackbar(t('kanban.settingsSaved'), { variant: 'success' });
            }
            return true;
        } catch (error: any) {
            console.error('saveSettings execution error:', error);
            enqueueSnackbar(formatPocketBaseActionError('Einstellungen speichern', error), { variant: 'error' });
            return false;
        }
    }, [permissions.canManageSettings, boardId, cols, lanes, checklistTemplates, viewMode, boardName, boardDescription, customLabels, boardMeta, enqueueSnackbar, t]);

    const patchCard = useCallback(async (card: ProjectBoardCard, changes: Partial<ProjectBoardCard>) => {
        if (!permissions.canEditContent) {
            enqueueSnackbar(t('kanban.noPermission') || 'Keine Berechtigung', { variant: 'error' });
            return;
        }

        // Optimistic Update
        setRows(prev => prev.map(r => idFor(r) === idFor(card) ? { ...r, ...changes } as ProjectBoardCard : r));

        try {
            const cardId = card.id;
            if (!cardId) throw new Error("Card ID missing");

            const fullUpdatedCard = { ...card, ...changes };
            const updateData: any = { card_data: fullUpdatedCard };
            if (changes['Board Stage']) updateData.stage = changes['Board Stage'];
            if (changes.position !== undefined) updateData.position = changes.position;

            const { error } = await supabase.from('kanban_cards').update(updateData).eq('id', cardId);
            if (error) throw error;
        } catch (error) {
            console.error('Patch error:', error);
            enqueueSnackbar(t('kanban.networkError'), { variant: 'error' });
        }
    }, [permissions.canEditContent, idFor, enqueueSnackbar, t]);

    const saveCards = useCallback(async () => {
        if (!permissions.canEditContent) return false;
        try {
            const promises = rows.map(card => {
                if (!card.id) return Promise.resolve();
                const stage = inferStage(card);
                const data = {
                    card_data: card,
                    stage: stage,
                    position: card.position ?? card.order ?? 0,
                    project_number: card.Nummer || null,
                    project_name: card.Teil,
                };
                return supabase.from('kanban_cards').update(data).eq('id', card.id);
            });
            await Promise.all(promises);
            return true;
        } catch (error) {
            return false;
        }
    }, [permissions.canEditContent, rows, inferStage]);

    const handleCreateCard = useCallback(async (newCardData: any) => {
        if (!permissions.canEditContent) {
            enqueueSnackbar(t('kanban.noPermission'), { variant: 'error' });
            return false;
        }
        try {
            const payload = {
                board_id: boardId,
                card_id: crypto.randomUUID(),
                card_data: newCardData,
                stage: newCardData['Board Stage'],
                position: 0,
                project_number: newCardData.Nummer || null,
                project_name: newCardData.Teil || null
            };

            const { data, error } = await supabase.from('kanban_cards').insert(payload).select().single();
            if (error) throw error;

            const newCard = convertDbToCard(data);
            setRows(prev => [...prev, newCard]);
            enqueueSnackbar(t('kanban.cardCreated'), { variant: 'success' });
            return true;
        } catch (error) {
            enqueueSnackbar(formatPocketBaseActionError('Karte erstellen', error), { variant: 'error' });
            return false;
        }
    }, [permissions.canEditContent, boardId, enqueueSnackbar, t, convertDbToCard]);


    // Realtime Subscription
    useEffect(() => {
        if (!boardId) return;

        const channel = supabase
            .channel(`kanban_cards_${boardId} `)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards', filter: `board_id = eq.${boardId} ` }, (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload;

                if (eventType === 'INSERT') {
                    const newCard = convertDbToCard(newRecord);
                    setRows(prev => {
                        if (prev.some(r => idFor(r) === idFor(newCard))) return prev;
                        return reindexByStage([...prev, newCard]);
                    });
                } else if (eventType === 'UPDATE') {
                    const updatedCard = convertDbToCard(newRecord);
                    setRows(prev => {
                        const isArchived = updatedCard["Archived"] === "1";
                        if (isArchived) return prev.filter(r => idFor(r) !== idFor(updatedCard));

                        const index = prev.findIndex(r => idFor(r) === idFor(updatedCard));
                        if (index === -1) return reindexByStage([...prev, updatedCard]);

                        const newRows = [...prev];
                        newRows[index] = updatedCard;
                        return newRows;
                    });
                } else if (eventType === 'DELETE') {
                    setRows(prev => prev.filter(r => r.id !== oldRecord.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [boardId, convertDbToCard, reindexByStage, idFor]);

    return {
        rows, setRows,
        cols, setCols,
        lanes, setLanes,
        checklistTemplates, setChecklistTemplates,
        customLabels, setCustomLabels,
        completedCount, setCompletedCount,
        boardMeta, setBoardMeta,
        boardName, setBoardName,
        boardDescription, setBoardDescription,
        topTopics, setTopTopics,

        // Actions
        loadCards, loadSettings, loadTopTopics,
        saveSettings, saveCards, patchCard, handleCreateCard,
        inferStage, idFor
    };
}
