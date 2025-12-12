
'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
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
    const { user, profile } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [kpiPopupOpen, setKpiPopupOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [topTopicsOpen, setTopTopicsOpen] = useState(false);
    const [newCardOpen, setNewCardOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState<ProjectBoardCard | null>(null);
    const [editTabValue, setEditTabValue] = useState(0);

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
      customLabels, completedCount, boardName, setBoardName, boardDescription, setBoardDescription, topTopics,
      loadCards, loadSettings, loadTopTopics, saveSettings, saveCards, patchCard, handleCreateCard,
      inferStage, idFor
    } = useKanbanData(boardId, permissions, viewMode, setViewMode, setDensity);

    const { kpis, distribution, kpiBadgeCount } = useKanbanKPIs(rows, inferStage);
    const { convertDbToCard } = useKanbanUtils(cols, viewMode);

    // --- Loading & Initialization ---

    useEffect(() => {
      onKpiCountChange?.(kpiBadgeCount);
    }, [kpiBadgeCount, onKpiCountChange]);

    useEffect(() => {
      const init = async () => {
        const loadedUsers = await fetchClientProfiles();
        setUsers(loadedUsers);

        await Promise.all([
          loadCards(),
          loadSettings(),
          loadTopTopics(),
          resolvePermissions(loadedUsers),
          loadBoardMembers()
        ]);
      };
      if (boardId) init();
    }, [boardId, loadCards, loadSettings, loadTopTopics, resolvePermissions]);

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
      if (!confirm(t('kanban.deleteConfirm'))) return;
      if (!card.id) return;
      const { error } = await supabase.from('kanban_cards').delete().eq('id', card.id);
      if (!error) {
        setArchivedCards(prev => prev.filter(c => c.id !== card.id));
        setRows(prev => prev.filter(c => c.id !== card.id));
      }
    };

    const handleCardDragEnd = (result: any) => {
      if (!result.destination) return;
      const { draggableId, source, destination } = result;

      // Logic to reorder cards locally
      const sourceId = source.droppableId; // stage or stage|swimlane
      const destId = destination.droppableId;

      const draggedCard = rows.find(r => idFor(r) === draggableId);
      if (!draggedCard) return;

      let newStage = '';

      if (viewMode === 'columns') {
        newStage = destId;
      } else {
        // split "Stage||Value"
        const parts = destId.split('||');
        newStage = parts[0];
      }

      const currentStage = inferStage(draggedCard);

      // Check for unfinished checklist items if changing stage
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

            if (!confirm(message)) {
              return;
            }
          }
        }
      }

      const updates: Partial<ProjectBoardCard> = {};
      if (newStage && newStage !== inferStage(draggedCard)) {
        updates['Board Stage'] = newStage;
      }

      if (Object.keys(updates).length > 0) {
        patchCard(draggedCard, updates);
      }
    };

    // --- Filtering ---
    const filteredRows = rows.filter(row => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = Object.values(row).some(v => String(v || '').toLowerCase().includes(term));
        if (!matches) return false;
      }
      if (filters.mine && user?.email) {
        // simplified mine check
        const resp = String(row.Verantwortlich || '').toLowerCase();
        const myName = (profile?.full_name || '').toLowerCase();
        if (!resp.includes(myName) && (row as any).VerantwortlichEmail !== user.email) return false;
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
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenKpis={() => setKpiPopupOpen(true)}
          onOpenTopTopics={() => setTopTopicsOpen(true)}
          onOpenArchive={handleOpenArchive}
          onNewCard={() => setNewCardOpen(true)}
          canModify={canModifyBoard || isSuperForce}
          kpiBadgeCount={kpiBadgeCount}
        />

        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <KanbanColumnsView {...renderBoardProps} />
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
          setCustomLabels={() => { }}
          boardName={boardName}
          setBoardName={setBoardName}
          boardDescription={boardDescription}
          setBoardDescription={setBoardDescription}
          canManageSettings={permissions.canManageSettings || isSuperForce}
          onSave={saveSettings}
          loadCards={loadCards}
          onOpenArchive={handleOpenArchive}
        />

        <KanbanKPIDialog
          open={kpiPopupOpen}
          onClose={() => setKpiPopupOpen(false)}
          kpis={kpis}
          distribution={distribution}
          trLabel={customLabels.tr}
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
        />
      </Box>
    );
  }
);

export default OriginalKanbanBoard;