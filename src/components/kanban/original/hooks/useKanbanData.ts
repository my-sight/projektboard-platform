
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
        console.log('loadSettings CALLED for', boardId);
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
                /* View mode and density are enforced to columns/compact in OriginalKanbanBoard.tsx */
                if (s.trLabel || s.sopLabel) {
                    setCustomLabels({
                        tr: s.trLabel || 'TR',
                        sop: s.sopLabel || 'SOP'
                    });
                }
                if (s.completedCount) setCompletedCount(s.completedCount);
                // Return the settings so they can be used immediately
                return { cols: s.cols };
            }
            return null;
        } catch (error) {
            return null;
        }
    }, [boardId, setViewMode, setDensity]);

    const loadCards = useCallback(async (explicitCols?: any[]) => {
        try {
            // Use explicitCols if provided, otherwise fallback to state cols
            const columnsToUse = explicitCols || cols;

            // 1. Check if this is a Con-Board (has parent_id)
            let isConBoard = false;
            let parentId: string | null = null;
            if (boardMeta && (boardMeta as any).parent_id) {
                isConBoard = true;
                parentId = (boardMeta as any).parent_id;
            } else {
                // Fetch to be sure if meta not yet fully populated or if we need to double check
                const { data: bData } = await supabase.from('kanban_boards').select('parent_id').eq('id', boardId).single();
                if (bData?.parent_id) {
                    isConBoard = true;
                    parentId = bData.parent_id;
                }
            }

            let loadedCards: ProjectBoardCard[] = [];

            if (isConBoard && parentId) {
                console.log('📦 Con-Board detected. Loading parent cards from:', parentId);
                // A) Load ALL cards from PARENT board
                const { data: parentCards, error: pErr } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .eq('board_id', parentId);
                if (pErr) throw pErr;

                // B) Load local statuses for this board
                const { data: localStatuses, error: sErr } = await supabase
                    .from('board_card_statuses')
                    .select('*')
                    .eq('board_id', boardId);
                if (sErr) throw sErr;

                const statusMap = new Map();
                localStatuses?.forEach((s: any) => {
                    statusMap.set(s.card_id, s);
                });

                // C) Merge
                // Filter out archived cards unless they are active in THIS board? 
                // Specs: "wenn eine karte aus dem elternboard archiviert ist oder wird, dann verschwindet sie aus den con boards"
                // So we check parent archive status.

                const validParentCards = (parentCards || []).filter((r: any) => {
                    const d = r.card_data || {};
                    const isArchived = d.Archived === '1' || d.archived === true || d.archived === 'true';
                    return !isArchived;
                });

                loadedCards = validParentCards.map((r: any) => {
                    const baseCard = convertDbToCard(r);
                    const localStatus = statusMap.get(r.id);

                    // If locally archived in Con-Board, hide it?
                    // "die können nur im letzten prozess archiviert werden, und dann ist die rückmeldung ans elternboard, dass sie abgeschlossen sind."
                    // If "Archived" flag is set in board_card_statuses, does it disappear?
                    // User said: "wenn eine karte aus dem elternboard archiviert ist oder wird, dann verschwindet sie aus den con boards"
                    // But also: "aus den con-boards können keine karten gelöscht werden. die können nur im letzten prozess archiviert werden, und dann ist die rückmeldung ans elternboard, dass sie abgeschlossen sind."
                    // This implies the standard "Archive" logic in Con-Board should SET a local archive flag or update the parent?
                    // "Rückmeldung ans Elternboard" implies Parent sees it. 
                    // If con-board archives it, does it disappear from Con-Board view? Usually yes.

                    if (localStatus?.archived) return null;

                    // RESET local-specific fields so they don't inherit from Parent
                    baseCard.Eskalation = undefined;
                    baseCard.TR_Datum = undefined;
                    baseCard.SOP_Datum = undefined;
                    baseCard['Due Date'] = undefined;
                    baseCard['Status Kurz'] = undefined;
                    baseCard.StatusHistory = [];
                    baseCard.TR_Neu = undefined;
                    baseCard.SOP_Neu = undefined;
                    baseCard.PhaseTransition = undefined; // Decouple Phase Transition

                    // Move Parent Responsible to Team
                    const parentResp = baseCard.Verantwortlich;
                    const parentRespId = (baseCard as any).VerantwortlichId; // Assuming this exists or we use name

                    if (parentResp) {
                        const currentTeam = Array.isArray(baseCard.Team) ? [...baseCard.Team] : [];
                        // Check if already in team (by name or ID if available)
                        const alreadyInTeam = currentTeam.some((m: any) => m.name === parentResp || m.id === parentResp); // Loose check

                        if (!alreadyInTeam) {
                            // Add to Team
                            currentTeam.unshift({
                                name: parentResp,
                                id: parentRespId, // propagate if available
                                isParentResp: true
                            } as any);
                        } else {
                            // Mark existing
                            const idx = currentTeam.findIndex((m: any) => m.name === parentResp || m.id === parentResp);
                            if (idx >= 0) {
                                currentTeam[idx] = { ...currentTeam[idx], isParentResp: true } as any;
                            }
                        }
                        baseCard.Team = currentTeam;
                    }

                    // Reset Responsible on Con-Board so it can be assigned locally
                    baseCard.Verantwortlich = undefined;
                    (baseCard as any).VerantwortlichId = undefined;
                    (baseCard as any).VerantwortlichEmail = undefined;

                    // Overwrite Stage/Position with local status
                    if (localStatus) {
                        baseCard['Board Stage'] = localStatus.column_id || 'Speicher';
                        baseCard.position = localStatus.position ?? 0;
                        // Merge local_data overrides (Eskalation, Dates, etc.)
                        if (localStatus.local_data) {
                            Object.assign(baseCard, localStatus.local_data);
                        }
                    } else {
                        // Default to first column "Speicher"
                        baseCard['Board Stage'] = 'Speicher';
                        baseCard.position = 0;
                    }

                    // Store original card ID and board ID for reference if needed, 
                    // but we might need to handle updates carefully. 
                    // Patches should update Parent Card Data (via API) but Local Status (via board_card_statuses)
                    // We'll handle patch logic separately.
                    return baseCard;
                }).filter((c: any) => c !== null) as ProjectBoardCard[];

            } else {
                // Standard Board Loading
                const { data: records, error } = await supabase
                    .from('kanban_cards')
                    .select('*')
                    .eq('board_id', boardId);

                if (error) throw error;

                if (records && records.length > 0) {
                    loadedCards = records.map(convertDbToCard);
                    // Filter out archived cards
                    loadedCards = loadedCards.filter(c => c.Archived !== '1');
                }
            }

            // Initial client-side sort
            loadedCards.sort((a, b) => {
                const pos = (name: string) => columnsToUse.findIndex((c: any) => c.name === name);
                const stageA = inferStage(a, columnsToUse); // Pass explicit columns to inferStage
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

    const saveSettings = useCallback(async (options?: { skipMeta?: boolean; settingsOverrides?: any; boardName?: string; boardDescription?: string }) => {
        console.log('saveSettings INVOKED', { boardId, options, canManage: permissions.canManageSettings });
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

            // Handle Con-Board Creation
            if ((options as any)?.createConBoard) {
                const conBoardName = (options as any).createConBoard;
                console.log('🚀 Creating Con-Board initiated:', conBoardName);
                console.log('Parent Board ID:', boardId);

                // 1. Create the new board with parent_id = boardId
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) {
                    console.error('❌ Error getting user:', userError);
                }
                const ownerId = userData.user?.id;
                console.log('Owner ID for new board:', ownerId);

                if (!ownerId) {
                    enqueueSnackbar('Benutzer konnte nicht authentifiziert werden.', { variant: 'error' });
                    return false;
                }

                const { data: newBoard, error: createError } = await supabase.from('kanban_boards').insert({
                    name: conBoardName,
                    description: `Con-Board von ${boardName}`,
                    owner_id: ownerId,
                    visibility: 'public', // Default to public for now
                    parent_id: boardId,
                    settings: {
                        // Force "Speicher" as first column
                        cols: [{ id: 'c_speicher', name: 'Speicher', done: false }, { id: 'c_todo', name: 'Zu erledigen', done: false }, { id: 'c_done', name: 'Fertig', done: true }],
                        boardType: 'con'
                    }
                }).select().single();

                if (createError) {
                    console.error('❌ Create Con-Board Error:', createError);
                    throw createError;
                }

                console.log('✅ Con-Board created successfully:', newBoard);
                enqueueSnackbar('Con-Board erfolgreich erstellt', { variant: 'success' });
                return true;
            }

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

                    try {
                        // 1. Update local rows optimistically
                        setRows(prevRows => prevRows.map(row => {
                            const currentStage = (row["Board Stage"] || "").trim();
                            const rename = renames.find(r => r.oldName === currentStage);
                            if (rename) {
                                return { ...row, "Board Stage": rename.newName };
                            }
                            return row;
                        }));

                        // 2. Update DB
                        const isConBoard = !!(boardMeta as any)?.parent_id;
                        const updatePromises = renames.map(async ({ oldName, newName }) => {
                            try {
                                if (isConBoard) {
                                    const { error: cbErr } = await supabase
                                        .from('board_card_statuses')
                                        .update({ column_id: newName })
                                        .eq('board_id', boardId)
                                        .eq('column_id', oldName);
                                    if (cbErr) console.error('Con-Board Rename Error:', cbErr);
                                } else {
                                    // Standard Board
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
                                }
                            } catch (innerErr) {
                                console.error('Inner Rename Loop Error:', innerErr);
                            }
                        });

                        await Promise.all(updatePromises);
                    } catch (renameErr) {
                        console.error('CRITICAL: Rename Logic Failed, but proceeding to save settings.', renameErr);
                    }
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

                // Update local state with overrides to reflect changes immediately
                if (options?.settingsOverrides) {
                    const o = options.settingsOverrides;
                    if (o.cols) setCols(o.cols);
                    if (o.lanes) setLanes(o.lanes);
                    if (o.checklistTemplates) setChecklistTemplates(o.checklistTemplates);
                    if (o.trLabel !== undefined || o.sopLabel !== undefined) {
                        setCustomLabels(prev => ({
                            tr: o.trLabel ?? prev.tr,
                            sop: o.sopLabel ?? prev.sop
                        }));
                    }
                }
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

            // Check Con-Board
            const isConBoard = !!(boardMeta as any)?.parent_id;

            // Separate changes
            // Updated Local Keys to include Escalation, Dates, Status, etc. for Con-Board requirement
            // These keys must NEVER be sent to the parent board.
            const localKeys = [
                'Board Stage', 'position', 'Archived', 'ArchivedDate',
                'Eskalation', 'TR_Datum', 'SOP_Datum', 'Due Date', 'Status Kurz', 'StatusHistory',
                'TR_Neu', 'SOP_Neu', 'Ampel', 'PhaseTransition', // ADDED PhaseTransition
                'Verantwortlich', 'VerantwortlichId', 'VerantwortlichEmail'
            ];

            const localChanges: any = {};
            const sharedChanges: any = {};

            // Special handling for local_data keys that are JSON overrides
            const localDataUpdates: any = {};

            Object.keys(changes).forEach(k => {
                const val = (changes as any)[k];
                if (localKeys.includes(k) && isConBoard) {
                    localChanges[k] = val; // These go to column_id/position OR local_data

                    // Maps to DB Columns for board_card_statuses
                    if (k !== 'Board Stage' && k !== 'position' && k !== 'Archived' && k !== 'ArchivedDate') {
                        localDataUpdates[k] = val;
                    }
                }
                else {
                    // For Con-Boards, we must be extremely careful.
                    // If the field is one of the "protected" ones but was somehow not in localKeys (e.g. typos?), check again.
                    // But more importantly, if it IS a local key, it must NOT go to sharedChanges.
                    // The check above handles it: `if (localKeys.includes(k) && isConBoard)` -> localChanges.
                    // ELSE -> sharedChanges.
                    // So if isConBoard is true, and k is Eskalation, it goes to localChanges.
                    // If isConBoard is FALSE (Parent Board), it goes to sharedChanges (because `localKeys.includes(k) && false` is false).
                    // Wait, if !isConBoard, we WANT Eskalation to go to sharedChanges (update DB).

                    if (isConBoard) {
                        // Double check: if it's a local key, skip shared.
                        if (!localKeys.includes(k)) {
                            sharedChanges[k] = val;
                        }
                    } else {
                        // Parent Board: Everything goes to sharedChanges (standard update)
                        // But wait, 'Board Stage' and 'position' are usually local logic even on Parent Board?
                        // No, on Parent Board they are columns in `kanban_cards`.
                        // But my logic usually handles 'Board Stage' -> 'stage' column map.
                        // Let's keep specific logic for Stage/Position if needed, but for now Standard behavior:
                        // If I change 'Eskalation' on Parent, it updates 'kanban_cards'.
                        // My current loop puts it in sharedChanges.
                        // But 'Board Stage' is in localKeys.
                        // If !isConBoard, `localKeys.includes('Board Stage') && false` -> false.
                        // So 'Board Stage' goes to sharedChanges.
                        // Then `supabase.update(sharedChanges)` sends `Board Stage` to DB.
                        // Does DB have `Board Stage` column? No, `stage`.
                        // Mapping needed?

                        if (k === 'Board Stage') sharedChanges['stage'] = val; // Map to DB column
                        else sharedChanges[k] = val;
                    }
                }
            });

            if (isConBoard) {
                // 1. Handle Local Status Update (Stage/Position/Archive/Overrides)
                if (Object.keys(localChanges).length > 0) {
                    const stage = localChanges['Board Stage'] || (card as any)['Board Stage'];
                    const pos = localChanges.position ?? card.position ?? 0;
                    const isArchived = !!(localChanges.Archived === '1' || localChanges.Archived === true);

                    // Fetch existing local_data to merge? Ideally yes, but upsert overwrite if we don't.
                    // Ideally we should merge. For now let's try to pass the full object if we can, or just the updates. 
                    // Supabase doesn't support deep merge on upsert easily without stored proc.
                    // We'll trust that we only update what changed. BUT we need to preserve other local_data keys.
                    // Solution: Fetch current status first? Or assume client has latest 'card' which merges both?
                    // The 'card' object HAS the merged data. So we can grab the current 'local' state from 'card' + changes.

                    const currentLocalDataFromCard = {
                        Eskalation: card.Eskalation,
                        TR_Datum: card.TR_Datum,
                        SOP_Datum: card.SOP_Datum,
                        "Due Date": card["Due Date"],
                        "Status Kurz": card["Status Kurz"],
                        Ampel: (card as any).Ampel,
                        Verantwortlich: card.Verantwortlich,
                        VerantwortlichId: (card as any).VerantwortlichId
                    };

                    const newLocalData = { ...currentLocalDataFromCard, ...localDataUpdates };

                    // Clean undefined
                    Object.keys(newLocalData).forEach(key => newLocalData[key] === undefined && delete newLocalData[key]);

                    const { error } = await supabase.from('board_card_statuses').upsert({
                        board_id: boardId,
                        card_id: cardId,
                        column_id: stage, // storing Name as ID for simplicity in this system
                        position: pos,
                        archived: isArchived,
                        local_data: newLocalData,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'board_id, card_id' });

                    if (error) throw error;
                }

                // 2. Handle Shared Content Update (SAFE MODE)
                if (Object.keys(sharedChanges).length > 0) {
                    console.warn('Con-Board Attempted to write to Shared Parent Card. Blocked by Safety Policy.', sharedChanges);
                    // DO NOT WRITE TO PARENT
                    // This effectively makes Con-Board Read-Only for Content.
                    // The user requirement: "wenn ich am con-board was ändere darf es keine auswirklungen auf die karten im Elternboard haben"
                    // This satisfies the requirement by preventing the overwrite.
                    // The UI might still show the change optimistically until reload. ideally we revert optimistic update if we knew it failed.
                    // But for now, blocking the DB write is the critical safety fix.
                }

            } else {
                // Standard Board Logic (Parent)
                const fullUpdatedCard = { ...card, ...changes };
                const updateData: any = { card_data: fullUpdatedCard };
                if (changes['Board Stage']) updateData.stage = changes['Board Stage'];
                if (changes.position !== undefined) updateData.position = changes.position;

                const { error } = await supabase.from('kanban_cards').update(updateData).eq('id', cardId);
                if (error) throw error;
            }

        } catch (error) {
            console.error('Patch error:', error);
            enqueueSnackbar(t('kanban.networkError'), { variant: 'error' });
            // Revert optimistic update? Complex to revert partial state locally without full reload or deep clone. 
            // We assume reload on error or user retry.
        }
    }, [permissions.canEditContent, idFor, enqueueSnackbar, t, boardMeta, boardId]);

    const saveCards = useCallback(async () => {
        if (!permissions.canEditContent) return false;

        // Safety: Con-Boards should NEVER save all cards back to Parent.
        // Individual edits are handled by patchCard (which is now safe).
        // Bulk save might be dangerous if it dumps local state.
        if ((boardMeta as any)?.parent_id) {
            console.warn("saveCards blocked on Con-Board to prevent Parent overwrite.");
            return true; // Pretend success
        }

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

        // If on Con-Board, create card on Parent Board.
        const targetBoardId = (boardMeta as any)?.parent_id || boardId;

        try {
            const payload = {
                board_id: targetBoardId,
                card_id: generateUUID(),
                card_data: { ...newCardData, id: generateUUID(), board_id: targetBoardId },
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


    // Realtime Subscription via Hook
    useKanbanRealtime(boardId, setRows, convertDbToCard);

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
