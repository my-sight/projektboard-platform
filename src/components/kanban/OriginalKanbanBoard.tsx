
'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';

// Types
import { ProjectBoardCard, LayoutDensity, ViewMode } from '@/types';
// OriginalKanbanBoardTypes import removed as we use inline interfaces

// Hooks
import { useKanbanData } from './original/hooks/useKanbanData';
import { useKanbanKPIs } from './original/hooks/useKanbanKPIs';
import { useKanbanPermissions } from './original/hooks/useKanbanPermissions';
import { useKanbanUtils } from './original/hooks/useKanbanUtils';

// Components
import { KanbanCard } from './original/KanbanCard';
import { KanbanColumnsView, KanbanLaneView, KanbanSwimlaneView } from './original/KanbanViews';
import { EditCardDialog, NewCardDialog, ArchiveDialog } from './original/KanbanDialogs';
import { KanbanSettingsDialog } from './original/KanbanSettingsDialog';
import { KanbanHeader, KanbanFilters } from './original/components/KanbanHeader';
import { KanbanKPIDialog } from './original/components/KanbanKPIDialog';
import { TopTopicsDialog } from './original/components/TopTopicsDialog';
import { ProjectStatusReportDialog } from '../board/management/ProjectStatusReportDialog';

// Define Props Interface inline if not reusing the old file's exports immediately (safest implementation)
export interface OriginalKanbanBoardHandleInterface {
  openSettings: () => void;
  openKpis: () => void;
  openArchive: () => void;
}
export type OriginalKanbanBoardHandle = OriginalKanbanBoardHandleInterface;

export interface OriginalKanbanBoardPropsInterface {
  boardId: string;
  onArchiveCountChange?: (count: number) => void;
  onKpiCountChange?: (count: number) => void;
  highlightCardId?: string | null;
  onExit?: () => void;
}
export type OriginalKanbanBoardProps = OriginalKanbanBoardPropsInterface;

const OriginalKanbanBoard = forwardRef<OriginalKanbanBoardHandleInterface, OriginalKanbanBoardPropsInterface>(
  function OriginalKanbanBoard({ boardId, onArchiveCountChange, onKpiCountChange, highlightCardId, onExit }, ref) {
    const { t } = useLanguage();
    const { user, profile, visibilityCounter } = useAuth();
    const { enqueueSnackbar } = useSnackbar();
    const isFetchingRef = useRef(false);

    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('columns');
    const [density, setDensity] = useState<LayoutDensity>('compact');
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<KanbanFilters>({
      mine: false,
      overdue: false,
      critical: false,
      phaseTransition: false
    });

    // Dialog State
    // Dialog State
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [kpiPopupOpen, setKpiPopupOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [topTopicsOpen, setTopTopicsOpen] = useState(false);
    const [newCardOpen, setNewCardOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState<ProjectBoardCard | null>(null);
    const [editTabValue, setEditTabValue] = useState('status');

    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [reportingCard, setReportingCard] = useState<ProjectBoardCard | null>(null);



    // Data - Members
    const [users, setUsers] = useState<any[]>([]);
    const [boardMembers, setBoardMembers] = useState<any[]>([]);
    const [archivedCards, setArchivedCards] = useState<ProjectBoardCard[]>([]);

    const isSuperForce = user?.email ? isSuperuserEmail(user.email) : false;
    const { permissions: rawPermissions, canModifyBoard, resolvePermissions } = useKanbanPermissions(boardId, user, profile);

    const permissions = isSuperForce
      ? { canEditContent: true, canManageSettings: true, canManageAttendance: true }
      : rawPermissions;

    const {
      rows, setRows, cols, lanes, checklistTemplates, setChecklistTemplates,
      customLabels, setCustomLabels, completedCount, boardName, setBoardName, boardDescription, setBoardDescription, topTopics,
      loadCards, loadSettings, loadTopTopics, saveSettings, saveCards, patchCard, handleCreateCard,
      inferStage, idFor, boardMeta
    } = useKanbanData(boardId, permissions, viewMode, setViewMode, setDensity);

    const { kpis, distribution, memberDistribution, laneDistribution, kpiBadgeCount } = useKanbanKPIs(rows, inferStage, users);
    const { convertDbToCard } = useKanbanUtils(cols, viewMode);

    // --- Loading & Initialization ---

    useEffect(() => {
      onKpiCountChange?.(kpiBadgeCount);
    }, [kpiBadgeCount, onKpiCountChange]);

    // 0. View Reset Effect (ONLY on boardId change)
    useEffect(() => {
      // Force starting view to 'columns' and density to 'compact' on every NEW board load
      setViewMode('columns');
      setDensity('compact');
    }, [boardId]);

    // 1. Data Loading Effect (Stable, only on Board ID change)
    useEffect(() => {
      const loadData = async () => {
        const loadedUsers = await fetchClientProfiles();
        setUsers(loadedUsers);

        // Sequence loading to ensure cols are set (via loadSettings) before loadCards uses them for stage inference
        const settings = await loadSettings();
        const explicitCols = settings?.cols;

        // loadTopTopics and boardMembers can run in parallel with each other if desired, but let's keep it simple
        await Promise.all([
          loadTopTopics(),
          loadBoardMembers()
        ]);

        await loadCards(explicitCols); // Now runs with updated cols if re-triggered, or at least after settings fetch
      };
      if (boardId) loadData();

      return () => {
        // no cleanup needed for simple data load
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId]);

    // visibility refresh via centralized trigger
    useEffect(() => {
      const runRefresh = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
          console.log('[OriginalKanbanBoard] Visibility refresh triggered via AuthContext');
          const settings = await loadSettings();
          const explicitCols = settings?.cols;
          await loadTopTopics();
          await loadCards(explicitCols);
        } finally {
          isFetchingRef.current = false;
        }
      };

      if (visibilityCounter > 0 && boardId) {
        runRefresh();
      }
    }, [visibilityCounter, boardId, loadCards, loadSettings, loadTopTopics]);


    // 2. Permission Resolution Effect (Triggers when user/auth changes)
    useEffect(() => {
      const resolve = async () => {
        const loadedUsers = await fetchClientProfiles();
        resolvePermissions(loadedUsers);
      };
      if (boardId && user) resolve();
    }, [boardId, user, resolvePermissions]);

    const loadBoardMembers = async () => {
      try {
        const { data } = await supabase.from('board_members').select('*').eq('board_id', boardId);
        if (data) {
          const profiles = await fetchClientProfiles();
          const members = data.map(m => {
            const p = profiles.find(p => p.id === (m.user_id || m.profile_id));
            return p ? { ...p, role: m.role } : m;
          });
          setBoardMembers(members);
        }
      } catch (e) { console.error(e); }
    };

    const loadArchivedCards = async () => {
      try {
        console.log('Loading archive for board:', boardId);
        // Load ALL cards for this board and filter for archived ones in JS to avoid JSON syntax pitfalls
        const { data, error } = await supabase
          .from('kanban_cards')
          .select('*')
          .eq('board_id', boardId);

        if (error) throw error;

        if (data) {
          const archived = data.filter(r => {
            const d = r.card_data || {};
            return d.Archived === '1' || d.archived === true || d.archived === 'true';
          });
          console.log('Found archived cards:', archived.length);
          const converted = archived.map(convertDbToCard);
          setArchivedCards(converted);
        }
      } catch (e) {
        console.error('Error loading archive:', e);
        enqueueSnackbar('Fehler beim Laden des Archivs', { variant: 'error' });
      }
    };

    const handleOpenStatusReport = (card: ProjectBoardCard) => {
      setReportingCard(card);
      setReportDialogOpen(true);
    };

    // --- Actions ---

    const handleOpenArchive = async () => {
      console.log('Opening archive...');
      await loadArchivedCards();
      setArchiveOpen(true);
    };

    useImperativeHandle(ref, () => ({
      openSettings: () => setSettingsOpen(true),
      openKpis: () => setKpiPopupOpen(true),
      openArchive: handleOpenArchive
    }));

    const archiveColumn = async (columnName: string) => {
      if (!confirm(t('kanban.archiveColumnConfirm').replace('{col}', columnName))) return;
      const cardsToArchive = rows.filter(r => inferStage(r) === columnName);
      const promises = cardsToArchive.map(card =>
        patchCard(card, { Archived: '1', ArchivedDate: new Date().toISOString() })
      );
      await Promise.all(promises);
      loadCards(); // refresh
    };

    const handleRestoreCard = async (card: ProjectBoardCard) => {
      await patchCard(card, { Archived: undefined, ArchivedDate: undefined });
      await loadArchivedCards();
      loadCards();
    };

    const handleDeletePermanently = async (card: ProjectBoardCard) => {
      // Con-Board Check: Cannot delete shared cards
      if (boardMeta && (boardMeta as any).parent_id) {
        alert(t('kanban.conBoardDeleteError') || 'Karten können in Con-Boards nicht gelöscht werden.');
        return;
      }

      if (!confirm(t('kanban.deleteConfirm'))) return;
      if (!card.id) return;
      const { error } = await supabase.from('kanban_cards').delete().eq('id', card.id);
      if (!error) {
        setArchivedCards(prev => prev.filter(c => c.id !== card.id));
        setRows(prev => prev.filter(c => c.id !== card.id));
      }
    };

    const handleCardDragEnd = async (result: any) => {
      if (!result.destination || !canModifyBoard) return;
      const { draggableId, source, destination } = result;

      const sourceDroppableId = source.droppableId;
      const destDroppableId = destination.droppableId;

      const draggedCard = rows.find(r => idFor(r) === draggableId);
      if (!draggedCard) return;

      // Extract new stage and swimlane/member from droppableId
      let newStage = '';
      let newValue = ''; // used for swimlane or member
      if (viewMode === 'columns') {
        newStage = destDroppableId;
      } else {
        const parts = destDroppableId.split('||');
        newStage = parts[0];
        newValue = parts[1] || '';
      }

      const currentStage = inferStage(draggedCard);

      // 1. Checklist check
      if (newStage && newStage !== currentStage) {
        const stageTemplates = checklistTemplates[currentStage] || [];
        if (stageTemplates.length > 0) {
          const doneItems = draggedCard.ChecklistDone?.[currentStage] || {};
          const unfinished = stageTemplates.filter(item => !doneItems[item]);
          if (unfinished.length > 0) {
            const message = t('kanban.checklistUnfinished')
              .replace('{stage}', currentStage)
              .replace('{count}', String(unfinished.length))
              .replace('{items}', unfinished.map(i => ` - ${i}`).join('\n'));
            if (!confirm(message)) return;
          }
        }
      }

      // 2. Perform Reordering
      const newRows = [...rows];
      // Note: we must identify which cards are in which droppable "column"
      const getColCards = (droppableId: string) => {
        return newRows.filter(r => {
          if (r.Archived === '1') return false;
          if (viewMode === 'columns') return inferStage(r) === droppableId;
          const parts = droppableId.split('||');
          const s = parts[0];
          const v = parts[1] || '';
          if (inferStage(r) !== s) return false;
          if (viewMode === 'swim') return (String(r.Verantwortlich || '').trim() || '—') === (v || '—');
          if (viewMode === 'lane') return (r.Swimlane || '') === v;
          return true;
        }).sort((a, b) => (a.position || 0) - (b.position || 0));
      };

      const sourceCards = getColCards(sourceDroppableId);
      const destCards = sourceDroppableId === destDroppableId ? sourceCards : getColCards(destDroppableId);

      // Find original index in source column
      const sourceIdx = sourceCards.findIndex(r => idFor(r) === draggableId);
      if (sourceIdx === -1) return;

      // Remove from source
      sourceCards.splice(sourceIdx, 1);

      // Update dragged card with new properties
      const updatedDraggedCard = { ...draggedCard };
      updatedDraggedCard['Board Stage'] = newStage;
      if (viewMode === 'swim') updatedDraggedCard.Verantwortlich = (newValue === '—' ? '' : newValue);
      if (viewMode === 'lane') updatedDraggedCard.Swimlane = newValue;

      // Insert into destination
      destCards.splice(destination.index, 0, updatedDraggedCard);

      // Update positions for all cards in affected column(s)
      sourceCards.forEach((c, i) => { c.position = i; c.order = i; });
      destCards.forEach((c, i) => { c.position = i; c.order = i; });

      // Build the final row list
      const affectedIds = new Set([...sourceCards, ...destCards].map(idFor));
      const finalRows = [
        ...newRows.filter(r => !affectedIds.has(idFor(r))),
        ...sourceCards,
        ...(sourceDroppableId === destDroppableId ? [] : destCards)
      ];

      setRows(finalRows);

      // Persist changes
      const cardsToUpdate = Array.from(new Set([...sourceCards, ...destCards]));
      await saveCards(cardsToUpdate);
    };

    // --- Filtering ---
    const filteredRows = rows.filter(row => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = Object.values(row).some(v => String(v || '').toLowerCase().includes(term));
        if (!matches) return false;
      }
      if (filters.mine && user) {
        const myId = user.id;
        const myProfileId = profile?.id;
        const myEmail = user.email?.toLowerCase();
        const myName = (profile?.full_name || '').toLowerCase();
        const myAlias = (profile?.alias || '').toLowerCase();

        // Robust check for assignment
        const isAssigned = (r: any) => {
          // 1. Check ID-based fields
          if (r.VerantwortlichId && (r.VerantwortlichId === myId || r.VerantwortlichId === myProfileId)) return true;
          if (r.assigneeId && (r.assigneeId === myId || r.assigneeId === myProfileId)) return true;
          if (r.userId && (r.userId === myId || r.userId === myProfileId)) return true;

          // 2. Check Email (if present on row/card)
          if (r.VerantwortlichEmail && String(r.VerantwortlichEmail).toLowerCase() === myEmail) return true;

          // 3. Check Team membership
          if (Array.isArray(r.Team)) {
            const inTeam = r.Team.some((member: any) => {
              if (member.userId && (member.userId === myId || member.userId === myProfileId)) return true;
              if (member.email && String(member.email).toLowerCase() === myEmail) return true;
              return false;
            });
            if (inTeam) return true;
          }

          // 4. Fallback: Strict String matching on 'Verantwortlich'
          // We split by standard separators to avoid partial matches (e.g. "Max" matching "Maximilian")
          const resp = String(r.Verantwortlich || '').toLowerCase();
          if (!resp) return false;

          const parts = resp.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);

          if (myName && parts.some(p => p === myName)) return true;
          if (myAlias && parts.some(p => p === myAlias)) return true;
          if (myEmail && parts.some(p => p === myEmail)) return true;

          return false;
        };

        if (!isAssigned(row)) return false;
      }
      if (filters.overdue) {
        const d = row['Due Date'];
        if (!d || d >= new Date().toISOString().split('T')[0]) return false;
      }
      if (filters.critical) {
        const esc = String(row.Eskalation || '').toUpperCase();
        const ampel = String(row.Ampel || '').toLowerCase();
        if (!['R', 'SK'].includes(esc) && !ampel.includes('rot')) return false;
      }
      if (filters.phaseTransition) {
        // @ts-ignore
        if (String(row.PhaseTransition) !== 'true' && row.PhaseTransition !== true) return false;
      }
      return true;
    });

    // --- Render ---

    const renderBoardProps = {
      rows: filteredRows,
      cols,
      density,
      searchTerm,
      onDragEnd: handleCardDragEnd,
      inferStage,
      renderCard: (card: ProjectBoardCard, index: number) => (
        <KanbanCard
          key={idFor(card)}
          card={card}
          index={index}
          density={density}
          rows={rows}
          setRows={setRows}
          saveCards={saveCards}
          patchCard={patchCard}
          setSelectedCard={setSelectedCard}
          setEditModalOpen={setEditModalOpen}
          setEditTabValue={setEditTabValue}
          inferStage={inferStage}
          idFor={idFor}
          users={users}
          canModify={canModifyBoard}
          highlighted={
            highlightCardId === idFor(card) ||
            highlightCardId === card.id ||
            highlightCardId === card.card_id ||
            highlightCardId === card.UID
          }
          checklistTemplates={checklistTemplates}

          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
          onOpenStatusReport={handleOpenStatusReport}
        />
      ),
      allowDrag: canModifyBoard,
      completedCount,
      archiveColumn
    };

    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <KanbanHeader
          boardName={boardName}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filters}
          onToggleFilter={(key: keyof KanbanFilters) => setFilters((p: KanbanFilters) => ({ ...p, [key]: !p[key] }))}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          density={density}
          onDensityChange={setDensity}
          onOpenArchive={handleOpenArchive}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenKpis={() => setKpiPopupOpen(true)}
          onOpenTopTopics={() => setTopTopicsOpen(true)}
          onNewCard={() => setNewCardOpen(true)}
          canModify={permissions.canEditContent}
          canManageSettings={permissions.canManageSettings}
          kpiBadgeCount={kpiBadgeCount}
        />

        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {viewMode === 'swim' ? (
            <KanbanSwimlaneView {...renderBoardProps} />
          ) : viewMode === 'lane' ? (
            <KanbanLaneView {...renderBoardProps} lanes={lanes} />
          ) : (
            <KanbanColumnsView {...renderBoardProps} />
          )}
        </Box>

        {/* Dialogs */}
        <KanbanSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          cols={cols}
          setCols={() => { }}
          checklistTemplates={checklistTemplates}
          setChecklistTemplates={() => { }}
          customLabels={customLabels}
          setCustomLabels={setCustomLabels}
          boardName={boardName}
          setBoardName={setBoardName}
          boardDescription={boardDescription}
          setBoardDescription={setBoardDescription}
          canManageSettings={permissions.canManageSettings || isSuperForce}
          onSave={saveSettings}
          loadCards={() => loadCards()}
          onOpenArchive={handleOpenArchive}
          lanes={lanes}
          boardMeta={boardMeta}
          boardId={boardId}
        />

        <KanbanKPIDialog
          open={kpiPopupOpen}
          onClose={() => setKpiPopupOpen(false)}
          kpis={kpis}
          distribution={distribution}
          memberDistribution={memberDistribution}
          laneDistribution={laneDistribution}
          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
          idFor={idFor}
        />

        <TopTopicsDialog
          open={topTopicsOpen}
          onClose={() => setTopTopicsOpen(false)}
          topTopics={topTopics}
          boardId={boardId}
          t={t}
        />

        <ArchiveDialog
          archiveOpen={archiveOpen}
          setArchiveOpen={setArchiveOpen}
          archivedCards={archivedCards}
          restoreCard={handleRestoreCard}
          deleteCardPermanently={handleDeletePermanently}
        />

        <NewCardDialog
          newCardOpen={newCardOpen}
          setNewCardOpen={setNewCardOpen}
          cols={cols}
          lanes={lanes}
          rows={rows}
          setRows={setRows}
          users={users}
          boardMembers={boardMembers}
          saveCards={saveCards}
          onCreate={handleCreateCard}
          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
        />

        <EditCardDialog
          selectedCard={selectedCard}
          editModalOpen={editModalOpen}
          setEditModalOpen={setEditModalOpen}
          editTabValue={editTabValue}
          setEditTabValue={setEditTabValue}
          rows={rows}
          setRows={setRows}
          users={users}
          boardMembers={boardMembers}
          lanes={lanes}
          checklistTemplates={checklistTemplates}
          inferStage={inferStage}
          addStatusEntry={(card: any) => {
            const current = card.StatusHistory || [];
            const date = new Date().toLocaleDateString('de-DE');
            const newEntry = { date, message: { text: '' }, qualitaet: {}, kosten: {}, termine: {} };
            const updatedHistory = [newEntry, ...current];
            patchCard(card, { StatusHistory: updatedHistory });
            setSelectedCard({ ...card, StatusHistory: updatedHistory });
          }}
          updateStatusSummary={() => { }} // simplified
          handleTRNeuChange={(card: any, date: string) => patchCard(card, { TR_Neu: date })}
          saveCards={saveCards}
          patchCard={patchCard}
          idFor={idFor}
          setSelectedCard={setSelectedCard}
          canEdit={canModifyBoard}
          onDelete={async (card: any) => {
            if (confirm(t('kanban.archiveConfirm'))) {
              await patchCard(card, { Archived: '1', ArchivedDate: new Date().toISOString() });
              setEditModalOpen(false);
            }
          }}
          trLabel={customLabels.tr}
          sopLabel={customLabels.sop}
          boardId={boardId}
          isConBoard={!!(boardMeta as any)?.parent_id} // Pass Con-Board status
        />

        <ProjectStatusReportDialog
          open={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          card={reportingCard as any}
          boardId={boardId}
        />
      </Box>
    );
  }
);

export default OriginalKanbanBoard;