
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSnackbar } from 'notistack';
import { ProjectBoardCard, ViewMode, LayoutDensity } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { KanbanPermissions } from './useKanbanPermissions';
import { useKanbanUtils } from './useKanbanUtils';
import { useKanbanRealtime } from './useKanbanRealtime';
import { DEFAULT_COLS, DEFAULT_TEMPLATES } from '../constants';
import { generateUUID } from '@/lib/uuid';
import dayjs from 'dayjs';

const redundantFields = [
    'Nummer', 'Teil', 'title', 'SOP_Neu', 'TR_Neu', 'MS_Neu',
    'SOP-Datum', 'TR-Datum', 'assigneeId', 'userId', 'VerantwortlichId',
    'dueDate', 'Due Date', 'important', 'description',
    'Board Stage', 'position', 'order'
];

const purgeRedundantFields = (data: any) => {
    if (!data) return data;
    const purged = { ...data };
    redundantFields.forEach(f => delete purged[f]);
    return purged;
};

const redundantSettings = [
    'lanes', 'trLabel', 'sopLabel', 'viewMode', 'lastUpdated'
];

const purgeRedundantSettings = (settings: any) => {
    if (!settings) return settings;
    const purged = { ...settings };
    redundantSettings.forEach(f => delete purged[f]);
    return purged;
};

export function useKanbanData(
    boardId: string,
    permissions: KanbanPermissions,
    viewMode: ViewMode,
    setViewMode: (m: ViewMode) => void,
    setDensity: (d: LayoutDensity) => void
) {
    const { t } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();

    // Helpers for safe DB writing (Dual-Writing)
    // IMPORTANT: PostgreSQL DATE columns fail on empty strings. Use NULL instead.
    const toIsoDate = (val: any) => {
        if (!val || (typeof val !== 'string' && typeof val !== 'number' && !(val instanceof Date))) return null;
        const d = dayjs(val);
        if (!d.isValid()) {
            if (typeof val === 'string' && val.includes('.')) {
                const parts = val.trim().split('.');
                if (parts.length === 3) {
                    const germanD = dayjs(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    if (germanD.isValid()) return germanD.format('YYYY-MM-DD');
                }
            }
            return null;
        }
        return d.format('YYYY-MM-DD');
    };

    const toSafeUuid = (val: any) => {
        if (!val || typeof val !== 'string') return null;
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidPattern.test(val.trim()) ? val.trim() : null;
    };

    const [rows, setRows] = useState<ProjectBoardCard[]>([]);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [lanes, setLanes] = useState<string[]>(['Projekt A', 'Projekt B', 'Projekt C']);
    const [checklistTemplates, setChecklistTemplates] = useState<Record<string, string[]>>(DEFAULT_TEMPLATES);
    const [customLabels, setCustomLabels] = useState({ tr: 'TR', sop: 'SOP' });
    const [completedCount, setCompletedCount] = useState(0);
    const [boardMeta, setBoardMeta] = useState<{ name: string; description?: string | null; updated_at?: string | null; parent_id?: string | null } | null>(null);
    const [boardName, setBoardName] = useState('');
    const [boardDescription, setBoardDescription] = useState('');
    const [topTopics, setTopTopics] = useState<any[]>([]);

    const [isRealtimeDisabled, setIsRealtimeDisabled] = useState(false);
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

                // Phase 6: Prioritize relational columns for board config
                if (record.tr_label) setCustomLabels(prev => ({ ...prev, tr: record.tr_label }));
                if (record.sop_label) setCustomLabels(prev => ({ ...prev, sop: record.sop_label }));
                if (record.view_mode) setViewMode(record.view_mode as ViewMode);
                if (record.lanes && Array.isArray(record.lanes)) setLanes(record.lanes);
            }

            if (record?.settings) {
                const s = record.settings;
                if (s.cols) setCols(s.cols);
                if (s.checklistTemplates) setChecklistTemplates(s.checklistTemplates);
                /* View mode and density are enforced to columns/compact in OriginalKanbanBoard.tsx */

                // Fallbacks only if dedicated columns are missing
                if (!record.tr_label && s.trLabel) setCustomLabels(prev => ({ ...prev, tr: s.trLabel }));
                if (!record.sop_label && s.sopLabel) setCustomLabels(prev => ({ ...prev, sop: s.sopLabel }));
                if (!record.view_mode && s.viewMode) setViewMode(s.viewMode as ViewMode);
                if (!record.lanes && s.lanes) setLanes(s.lanes);

                if (s.completedCount) setCompletedCount(s.completedCount);
                // Return the settings so they can be used immediately
                return { cols: s.cols };
            }
            return null;
        } catch (error) {
            return null;
        }
    }, [boardId]);

    const loadCards = useCallback(async (explicitCols?: any[]) => {
        if (!boardId || isRealtimeDisabled) return false;
        try {
            const columnsToUse = explicitCols || cols;

            let isConBoard = false;
            let parentId: string | null = null;
            if (boardMeta && boardMeta.parent_id) {
                isConBoard = true;
                parentId = boardMeta.parent_id;
            } else {
                const { data: bData } = await supabase.from('kanban_boards').select('parent_id').eq('id', boardId).single();
                if (bData?.parent_id) {
                    isConBoard = true;
                    parentId = bData.parent_id;
                }
            }

            let loadedCards: ProjectBoardCard[] = [];

            if (isConBoard && parentId) {
                const { data: parentCards, error: pErr } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .eq('board_id', parentId);
                if (pErr) throw pErr;

                const { data: localStatuses, error: sErr } = await supabase
                    .from('board_card_statuses')
                    .select('*')
                    .eq('board_id', boardId);
                if (sErr) throw sErr;

                const statusMap = new Map();
                localStatuses?.forEach((s: any) => {
                    statusMap.set(s.card_id, s);
                });

                const validParentCards = (parentCards || []).filter((r: any) => {
                    const d = r.card_data || {};
                    const isArchived = d.Archived === '1' || d.archived === true || d.archived === 'true';
                    return !isArchived;
                });

                loadedCards = validParentCards.map((r: any) => {
                    const baseCard = convertDbToCard(r);
                    const localStatus = statusMap.get(r.id);

                    if (localStatus?.archived) return null;

                    baseCard.Eskalation = undefined;
                    baseCard.TR_Datum = undefined;
                    baseCard.SOP_Datum = undefined;
                    baseCard['Due Date'] = undefined;
                    baseCard['Status Kurz'] = undefined;
                    baseCard.StatusHistory = [];
                    baseCard.TR_Neu = undefined;
                    baseCard.SOP_Neu = undefined;
                    baseCard.PhaseTransition = undefined;
                    baseCard.ChecklistDone = {};

                    const parentResp = baseCard.Verantwortlich;
                    const parentRespId = (baseCard as any).VerantwortlichId;

                    if (parentResp) {
                        const currentTeam = Array.isArray(baseCard.Team) ? [...baseCard.Team] : [];
                        const alreadyInTeam = currentTeam.some((m: any) => m.name === parentResp || m.id === parentResp);
                        if (!alreadyInTeam) {
                            currentTeam.unshift({
                                name: parentResp,
                                id: parentRespId,
                                isParentResp: true
                            } as any);
                        } else {
                            const idx = currentTeam.findIndex((m: any) => m.name === parentResp || m.id === parentResp);
                            if (idx >= 0) {
                                currentTeam[idx] = { ...currentTeam[idx], isParentResp: true } as any;
                            }
                        }
                        baseCard.Team = currentTeam;
                    }

                    baseCard.Verantwortlich = undefined;
                    (baseCard as any).VerantwortlichId = undefined;
                    (baseCard as any).VerantwortlichEmail = undefined;

                    if (localStatus) {
                        baseCard['Board Stage'] = localStatus.column_id || 'Speicher';
                        baseCard.position = localStatus.position ?? 0;
                        if (localStatus.local_data) {
                            Object.assign(baseCard, localStatus.local_data);
                        }
                    } else {
                        baseCard['Board Stage'] = 'Speicher';
                        baseCard.position = 0;
                    }
                    return baseCard;
                }).filter((c: any) => c !== null) as ProjectBoardCard[];

            } else {
                const { data: records, error } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .eq('board_id', boardId);

                if (error) throw error;

                if (records && records.length > 0) {
                    loadedCards = records.map(convertDbToCard);
                    loadedCards = loadedCards.filter(c => c.Archived !== '1');
                }
            }

            loadedCards.sort((a, b) => {
                const pos = (name: string) => columnsToUse.findIndex((c: any) => c.name === name);
                const stageA = inferStage(a, columnsToUse);
                const stageB = inferStage(b, columnsToUse);
                if (stageA !== stageB) return pos(stageA) - pos(stageB);
                return (a.position || 0) - (b.position || 0);
            });
            setRows(loadedCards);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Laden der Karten:', error);
            setRows([]);
            return false;
        }
    }, [boardId, convertDbToCard, inferStage, cols, boardMeta]);

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

    const saveSettings = useCallback(async (options?: { skipMeta?: boolean; settingsOverrides?: any; boardName?: string; boardDescription?: string; createConBoard?: string }) => {
        if (!permissions.canManageSettings) {
            enqueueSnackbar(t('kanban.noPermission') || 'Keine Berechtigung', { variant: 'error' });
            return false;
        }

        try {
            const settings = {
                cols,
                lanes,
                checklistTemplates,
                viewMode,
                trLabel: customLabels.tr,
                sopLabel: customLabels.sop,
                lastUpdated: new Date().toISOString(),
                ...(options?.settingsOverrides || {})
            };

            const boardNameUpdate = options?.boardName ?? boardName;
            const boardDescUpdate = options?.boardDescription ?? boardDescription;

            const dbPayload = {
                name: boardNameUpdate,
                description: boardDescUpdate,
                settings,
                tr_label: customLabels.tr,
                sop_label: customLabels.sop,
                view_mode: viewMode,
                lanes: lanes
            };

            if (options?.createConBoard) {
                const conBoardName = options.createConBoard;
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;
                const ownerId = userData.user?.id;

                if (!ownerId) {
                    enqueueSnackbar('Benutzer konnte nicht authentifiziert werden.', { variant: 'error' });
                    return false;
                }

                const { error: createError } = await supabase.from('kanban_boards').insert({
                    name: conBoardName,
                    description: `Con-Board von ${boardName}`,
                    owner_id: ownerId,
                    visibility: 'public',
                    parent_id: boardId,
                    tr_label: 'TR',
                    sop_label: 'SOP',
                    view_mode: 'kanban',
                    settings: {
                        cols: [{ id: 'c_speicher', name: 'Speicher', done: false }, { id: 'c_todo', name: 'Zu erledigen', done: false }, { id: 'c_done', name: 'Fertig', done: true }],
                        boardType: 'con'
                    }
                });

                if (createError) throw createError;
                enqueueSnackbar('Con-Board erfolgreich erstellt', { variant: 'success' });
                return true;
            }

            const overrides = options?.settingsOverrides;
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
                    setRows(prevRows => prevRows.map(row => {
                        const currentStage = (row["Board Stage"] || "").trim();
                        const rename = renames.find(r => r.oldName === currentStage);
                        if (rename) return { ...row, "Board Stage": rename.newName };
                        return row;
                    }));

                    const isConBoard = !!boardMeta?.parent_id;
                    const updatePromises = renames.map(async ({ oldName, newName }) => {
                        if (isConBoard) {
                            await supabase.from('board_card_statuses').update({ column_id: newName }).eq('board_id', boardId).eq('column_id', oldName);
                        } else {
                            const { data: cardsToUpdate } = await supabase.from('kanban_cards').select('id, card_data').eq('stage', oldName).eq('board_id', boardId);
                            if (cardsToUpdate) {
                                await Promise.all(cardsToUpdate.map(c => {
                                    const newCardData = { ...c.card_data, "Board Stage": newName };
                                    return supabase.from('kanban_cards').update({ stage: newName, card_data: newCardData }).eq('id', c.id);
                                }));
                            }
                        }
                    });
                    await Promise.all(updatePromises);
                }
            }

            const updateData: any = {
                settings: purgeRedundantSettings(settings),
                tr_label: customLabels.tr,
                sop_label: customLabels.sop,
                view_mode: viewMode,
                lanes: lanes
            };
            if (!options?.skipMeta) {
                const nameToUse = options?.boardName !== undefined ? options.boardName : boardName;
                const descToUse = options?.boardDescription !== undefined ? options.boardDescription : boardDescription;
                updateData.name = nameToUse.trim() || boardMeta?.name;
                updateData.description = descToUse.trim() || null;
            }

            const { data: record, error } = await supabase.from('kanban_boards').update(updateData).eq('id', boardId).select().maybeSingle();
            if (error) throw error;
            if (record) {
                setBoardMeta(record);
                if (options?.settingsOverrides) {
                    const o = options.settingsOverrides;
                    if (o.cols) setCols(o.cols);
                    if (o.lanes) setLanes(o.lanes);
                    if (o.checklistTemplates) setChecklistTemplates(o.checklistTemplates);
                    if (o.trLabel !== undefined || o.sopLabel !== undefined) {
                        setCustomLabels(prev => ({ tr: o.trLabel ?? prev.tr, sop: o.sopLabel ?? prev.sop }));
                    }
                }
            }

            if (!options?.skipMeta) enqueueSnackbar(t('kanban.settingsSaved'), { variant: 'success' });
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

        setIsRealtimeDisabled(true);
        setRows(prev => prev.map(r => idFor(r) === idFor(card) ? { ...r, ...changes } as ProjectBoardCard : r));

        try {
            const cardId = card.id;
            if (!cardId) throw new Error("Card ID missing");
            const isConBoard = !!boardMeta?.parent_id;

            const localKeys = [
                'Board Stage', 'position', 'Archived', 'ArchivedDate',
                'Eskalation', 'TR_Datum', 'SOP_Datum', 'Due Date', 'Status Kurz', 'StatusHistory',
                'TR_Neu', 'SOP_Neu', 'Ampel', 'PhaseTransition',
                'Verantwortlich', 'VerantwortlichId', 'VerantwortlichEmail',
                'TR_Completed', 'TR_Completed_At', 'TR_Completed_Date',
                'ChecklistDone', 'Kerntermine'
            ];

            const localChanges: any = {};
            const sharedChanges: any = {};
            const localDataUpdates: any = {};

            Object.keys(changes).forEach(k => {
                const val = (changes as any)[k];
                if (localKeys.includes(k) && isConBoard) {
                    localChanges[k] = val;
                    if (k !== 'Board Stage' && k !== 'position' && k !== 'Archived' && k !== 'ArchivedDate') {
                        localDataUpdates[k] = val;
                    }
                } else {
                    if (isConBoard) {
                        if (!localKeys.includes(k)) sharedChanges[k] = val;
                    } else {
                        if (k === 'Board Stage') sharedChanges['stage'] = val;
                        else sharedChanges[k] = val;
                    }
                }
            });

            if (isConBoard) {
                if (Object.keys(localChanges).length > 0) {
                    const stage = localChanges['Board Stage'] || (card as any)['Board Stage'];
                    const pos = localChanges.position ?? card.position ?? 0;
                    const isArchived = !!(localChanges.Archived === '1' || localChanges.Archived === true);

                    // Build local_data by extracting ALL relevant keys from the current card
                    // This ensures we don't lose fields like StatusHistory or Kerntermine
                    const currentLocalDataFromCard: any = {};
                    localKeys.forEach(k => {
                        if (k !== 'Board Stage' && k !== 'position' && k !== 'Archived' && k !== 'ArchivedDate') {
                            if ((card as any)[k] !== undefined) {
                                currentLocalDataFromCard[k] = (card as any)[k];
                            }
                        }
                    });

                    const newLocalData = { ...currentLocalDataFromCard, ...localDataUpdates };
                    Object.keys(newLocalData).forEach(key => newLocalData[key] === undefined && delete newLocalData[key]);

                    const { error } = await supabase.from('board_card_statuses').upsert({
                        board_id: boardId,
                        card_id: cardId,
                        column_id: stage,
                        position: pos,
                        archived: isArchived,
                        local_data: newLocalData,
                        ampel_status: String(newLocalData.Ampel || ''),
                        escalation_status: String(newLocalData.Eskalation || ''),
                        is_confirmed: !!(newLocalData.TR_Completed || newLocalData.MS_Completed),
                        sop_date_local: toIsoDate(newLocalData.SOP_Neu || newLocalData.SOP_Datum),
                        ms_date_local: toIsoDate(newLocalData.TR_Neu || newLocalData.MS_Neu || newLocalData.TR_Datum),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'board_id, card_id' });

                    if (error) throw error;
                }
            } else {
                const fullUpdatedCard = { ...card, ...changes };
                const purgedCardData = purgeRedundantFields(fullUpdatedCard);
                const updateData: any = {
                    card_data: purgedCardData,
                    project_number: String(fullUpdatedCard.Nummer || ''),
                    project_name: String(fullUpdatedCard.Teil || fullUpdatedCard.title || ''),
                    sop_date_original: toIsoDate(fullUpdatedCard['SOP-Datum']),
                    sop_date_current: toIsoDate(fullUpdatedCard.SOP_Neu),
                    ms_date_original: toIsoDate(fullUpdatedCard['TR-Datum']),
                    ms_date_current: toIsoDate(fullUpdatedCard.TR_Neu || fullUpdatedCard.MS_Neu),
                    is_completed: !!(fullUpdatedCard.TR_Completed || fullUpdatedCard.MS_Completed || fullUpdatedCard.status === 'done'),
                    assignee_id: toSafeUuid(fullUpdatedCard.assigneeId || fullUpdatedCard.userId || fullUpdatedCard.VerantwortlichId),
                    due_date: toIsoDate(fullUpdatedCard['Due Date'] || fullUpdatedCard.dueDate),
                    is_important: !!(fullUpdatedCard.important || fullUpdatedCard.Priorität === 'Hoch'),
                    task_description: String(fullUpdatedCard.description || fullUpdatedCard.title || '')
                };
                if (changes['Board Stage']) updateData.stage = changes['Board Stage'];
                if (changes.position !== undefined) updateData.position = changes.position;

                const { error } = await supabase.from('kanban_cards').update(updateData).eq('id', cardId);
                if (error) {
                    console.error('Patch DB Error:', error);
                    enqueueSnackbar(`Speicherfehler: ${error.message} (${error.code})`, { variant: 'error', autoHideDuration: 10000 });
                }
            }
        } catch (error: any) {
            console.error('Patch Exception:', error);
            enqueueSnackbar(`Systemfehler: ${error.message || error}`, { variant: 'error' });
        } finally {
            setTimeout(() => {
                setIsRealtimeDisabled(false);
            }, 1000);
        }
    }, [permissions.canEditContent, idFor, enqueueSnackbar, t, boardMeta, boardId]);

    const saveCards = useCallback(async (cardsToSave?: ProjectBoardCard[]) => {
        if (!permissions.canEditContent) return false;
        setIsRealtimeDisabled(true);
        const isConBoard = !!boardMeta?.parent_id;
        const targetCards = cardsToSave || rows;

        try {
            const promises = targetCards.map(async (card) => {
                if (!card.id) return { error: null };
                const stage = inferStage(card);
                const pos = card.position ?? card.order ?? 0;

                if (isConBoard) {
                    return supabase.from('board_card_statuses').upsert({
                        board_id: boardId,
                        card_id: card.id,
                        column_id: stage,
                        position: pos,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'board_id, card_id' });
                } else {
                    const purgedCard = purgeRedundantFields(card);
                    const data = {
                        card_data: purgedCard,
                        stage: stage,
                        position: pos,
                        project_number: String(card.Nummer || ''),
                        project_name: String(card.Teil || card.title || ''),
                        sop_date_original: toIsoDate(card['SOP-Datum']),
                        sop_date_current: toIsoDate(card.SOP_Neu),
                        ms_date_original: toIsoDate(card['TR-Datum']),
                        ms_date_current: toIsoDate(card.TR_Neu || card.MS_Neu),
                        is_completed: !!(card.TR_Completed || card.MS_Completed || card.status === 'done'),
                        assignee_id: toSafeUuid(card.assigneeId || card.userId || card.VerantwortlichId),
                        due_date: toIsoDate(card['Due Date'] || card.dueDate),
                        is_important: !!(card.important || card.Priorität === 'Hoch'),
                        task_description: String(card.description || card.title || '')
                    };
                    return supabase.from('kanban_cards').update(data).eq('id', card.id);
                }
            });
            const results = await Promise.all(promises);
            const errors = results.map(r => r.error).filter(Boolean);
            if (errors.length > 0) {
                const firstErr = errors[0];
                console.error('saveCards partial failure:', errors);
                enqueueSnackbar(`Speicherfehler (${errors.length} Karten): ${firstErr?.message}`, { variant: 'error', autoHideDuration: 10000 });
                return false;
            }
            return true;
        } catch (error: any) {
            console.error('saveCards crash:', error);
            enqueueSnackbar(`Systemfehler (Bulk): ${error.message || error}`, { variant: 'error' });
            return false;
        } finally {
            setTimeout(() => {
                setIsRealtimeDisabled(false);
            }, 1000);
        }
    }, [permissions.canEditContent, rows, inferStage, boardMeta, boardId, enqueueSnackbar, toIsoDate, toSafeUuid]);

    const handleCreateCard = useCallback(async (newCardData: any) => {
        if (!permissions.canEditContent) {
            enqueueSnackbar(t('kanban.noPermission'), { variant: 'error' });
            return false;
        }
        const targetBoardId = boardMeta?.parent_id || boardId;
        try {
            const cardId = generateUUID();
            const purgedInjected = purgeRedundantFields({ ...newCardData, id: cardId, board_id: targetBoardId });
            const payload = {
                board_id: targetBoardId,
                card_id: cardId,
                card_data: purgedInjected,
                stage: newCardData['Board Stage'],
                position: 0,
                project_number: String(newCardData.Nummer || ''),
                project_name: String(newCardData.Teil || newCardData.title || ''),
                sop_date_original: toIsoDate(newCardData['SOP-Datum']),
                sop_date_current: toIsoDate(newCardData.SOP_Neu),
                ms_date_original: toIsoDate(newCardData['TR-Datum']),
                ms_date_current: toIsoDate(newCardData.TR_Neu || newCardData.MS_Neu),
                is_completed: !!(newCardData.TR_Completed || newCardData.MS_Completed || newCardData.status === 'done'),
                assignee_id: toSafeUuid(newCardData.assigneeId || newCardData.userId || newCardData.VerantwortlichId),
                due_date: toIsoDate(newCardData['Due Date'] || newCardData.dueDate),
                is_important: !!(newCardData.important || newCardData.Priorität === 'Hoch'),
                task_description: String(newCardData.description || newCardData.title || '')
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
    }, [permissions.canEditContent, boardId, boardMeta, enqueueSnackbar, t, convertDbToCard]);

    useKanbanRealtime(boardId, setRows, convertDbToCard, isRealtimeDisabled);

    return {
        rows, setRows, cols, setCols, lanes, setLanes, checklistTemplates, setChecklistTemplates, customLabels, setCustomLabels,
        completedCount, setCompletedCount, boardMeta, setBoardMeta, boardName, setBoardName, boardDescription, setBoardDescription, topTopics, setTopTopics,
        loadCards, loadSettings, loadTopTopics, saveSettings, saveCards, patchCard, handleCreateCard, inferStage, idFor
    };
}
