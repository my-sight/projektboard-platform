'use client';

import { ReactNode } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Box, IconButton, Typography, Paper, Chip } from '@mui/material';
import { KanbanDensity } from './KanbanCard';
import { alpha } from '@mui/material/styles';
import { useLanguage } from '@/contexts/LanguageContext';

export interface KanbanColumnsViewProps {
  rows: any[];
  cols: { id: string; name: string; done?: boolean }[];
  density: KanbanDensity;
  searchTerm: string;
  onDragEnd: (result: DropResult) => void;
  inferStage: (card: any) => string;
  archiveColumn: (columnName: string) => void;
  renderCard: (card: any, index: number) => ReactNode;
  allowDrag: boolean;
}

import { useKanbanAutoScroll } from '@/hooks/useKanbanAutoScroll';

export function KanbanColumnsView({
  rows,
  cols,
  density,
  searchTerm,
  onDragEnd,
  inferStage,
  archiveColumn,
  renderCard,
  allowDrag,
}: KanbanColumnsViewProps) {
  const { t } = useLanguage();
  const { scrollContainerRef, onDragStart: onAutoScrollStart, onDragEnd: onAutoScrollEnd } = useKanbanAutoScroll();

  const filtered = rows.filter(
    (row) =>
      !row['Archived'] &&
      (!searchTerm ||
        Object.values(row).some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        )),
  );

  const handleDragStart = () => {
    onAutoScrollStart();
  };

  const handleDragEnd = (result: DropResult) => {
    onAutoScrollEnd();
    if (allowDrag) onDragEnd(result);
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box
        ref={scrollContainerRef}
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          overflowX: 'auto',
          alignItems: 'flex-start',
          height: '100%',
        }}
      >
        {cols.map((col) => {
          const colCards = filtered.filter((row) => inferStage(row) === col.name);
          const redCount = colCards.filter(c => {
            const ampel = String(c.Ampel || '').toLowerCase();
            const eskalation = String(c.Eskalation || '').toUpperCase();
            // R counts as Red
            return ampel === 'rot' || eskalation === 'R';
          }).length;

          const yellowCount = colCards.filter(c => {
            const ampel = String(c.Ampel || '').toLowerCase();
            const eskalation = String(c.Eskalation || '').toUpperCase();
            // Y counts as Yellow
            return ampel === 'gelb' || eskalation === 'Y';
          }).length;

          const greenCount = colCards.length - redCount - yellowCount;

          return (
            <Paper
              key={col.id}
              className="glass"
              sx={{
                minWidth: 320,
                width: 320,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 140px)',
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  p: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: alpha('#fff', 0.02),
                }}
              >
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    {col.name} {col.done && '✓'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5, minHeight: 20 }}>

                    {redCount > 0 && (
                      <Chip label={`${redCount} R`} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: alpha('#d32f2f', 0.1), color: '#d32f2f', border: '1px solid', borderColor: alpha('#d32f2f', 0.3) }} />
                    )}
                    {yellowCount > 0 && (
                      <Chip label={`${yellowCount} Y`} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: alpha('#ed6c02', 0.1), color: '#ed6c02', border: '1px solid', borderColor: alpha('#ed6c02', 0.3) }} />
                    )}
                    {greenCount > 0 && (
                      <Chip label={`${greenCount} G`} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: alpha('#000', 0.05), color: 'text.secondary', border: '1px solid', borderColor: 'divider' }} />
                    )}
                  </Box>
                </Box>

                {col.done && (
                  <IconButton
                    size="small"
                    title={t('kanban.archiveColumn')}
                    onClick={() => archiveColumn(col.name)}
                    disabled={!allowDrag}
                  >
                    📦
                  </IconButton>
                )}
              </Box>

              <Droppable droppableId={col.name} isDropDisabled={!allowDrag}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      flex: 1,
                      p: 1.5,
                      pb: 8, // Added extra padding at bottom to prevent cutoff
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: density === 'xcompact' ? 0.25 : 0.5,
                      overflowY: 'auto',
                      minHeight: 300,
                      bgcolor: snapshot.isDraggingOver ? alpha('#fff', 0.05) : 'transparent',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {density === 'xcompact' ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                          gap: 1,
                        }}
                      >
                        {colCards.map((card, cardIndex) => renderCard(card, cardIndex))}
                      </Box>
                    ) : (
                      colCards.map((card, cardIndex) => renderCard(card, cardIndex))
                    )}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </Paper>
          );
        })}
      </Box>
    </DragDropContext>
  );
}

export interface KanbanSwimlaneViewProps {
  rows: any[];
  cols: { name: string }[];
  searchTerm: string;
  onDragEnd: (result: DropResult) => void;
  inferStage: (card: any) => string;
  renderCard: (card: any, index: number) => ReactNode;
  allowDrag: boolean;
}

export function KanbanSwimlaneView({ rows, cols, searchTerm, onDragEnd, inferStage, renderCard, allowDrag }: KanbanSwimlaneViewProps) {
  const { t } = useLanguage();
  const { scrollContainerRef, onDragStart: onAutoScrollStart, onDragEnd: onAutoScrollEnd } = useKanbanAutoScroll();

  const filtered = rows.filter(
    (row) =>
      !row['Archived'] &&
      (!searchTerm ||
        Object.values(row).some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        )),
  );

  const stages = cols.map((c) => c.name);
  const resps = Array.from(
    new Set(
      filtered
        .map((row) => String(row['Verantwortlich'] || '').trim() || '—')
        .sort(),
    ),
  );

  const handleDragStart = () => {
    onAutoScrollStart();
  };

  const handleDragEnd = (result: DropResult) => {
    onAutoScrollEnd();
    if (allowDrag) onDragEnd(result);
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box
        ref={scrollContainerRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: `200px ${stages.map(() => '320px').join(' ')}`,
          gap: 2,
          p: 2,
          alignItems: 'start',
          overflow: 'auto',
          height: '100%',
        }}
      >
        <Box /> {/* Empty corner */}

        {stages.map((stage) => (
          <Paper
            key={stage}
            className="glass"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              p: 2,
              fontWeight: 700,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            {stage}
          </Paper>
        ))}

        {resps.map((resp) => (
          <>
            <Paper
              key={`header-${resp}`}
              className="glass"
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 2,
              }}
            >
              <Typography fontWeight={700} noWrap title={resp}>{resp}</Typography>
              <Typography variant="caption" color="text.secondary">
                {
                  filtered.filter(
                    (row) => (String(row['Verantwortlich'] || '').trim() || '—') === resp,
                  ).length
                }{' '}
                {t('kanban.cards')}
              </Typography>
            </Paper>

            {stages.map((stage) => {
              const cellCards = filtered.filter(
                (row) => inferStage(row) === stage && (String(row['Verantwortlich'] || '').trim() || '—') === resp,
              );

              return (
                <Droppable key={`${stage}-${resp}`} droppableId={`${stage}||${resp}`} isDropDisabled={!allowDrag}>
                  {(provided, snapshot) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="glass"
                      sx={{
                        bgcolor: snapshot.isDraggingOver ? alpha('#fff', 0.05) : 'background.paper',
                        borderRadius: 2,
                        minHeight: 140,
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {cellCards.map((card, cardIndex) => renderCard(card, cardIndex))}
                      {provided.placeholder}
                    </Paper>
                  )}
                </Droppable>
              );
            })}
          </>
        ))}
      </Box>
    </DragDropContext>
  );
}

export interface KanbanLaneViewProps {
  rows: any[];
  cols: { name: string }[];
  lanes: string[];
  searchTerm: string;
  onDragEnd: (result: DropResult) => void;
  inferStage: (card: any) => string;
  renderCard: (card: any, index: number) => ReactNode;
  allowDrag: boolean;
}

export function KanbanLaneView({ rows, cols, lanes, searchTerm, onDragEnd, inferStage, renderCard, allowDrag }: KanbanLaneViewProps) {
  const { t } = useLanguage();
  const { scrollContainerRef, onDragStart: onAutoScrollStart, onDragEnd: onAutoScrollEnd } = useKanbanAutoScroll();

  const filtered = rows.filter(
    (row) =>
      !row['Archived'] &&
      (!searchTerm ||
        Object.values(row).some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
        )),
  );

  const stages = cols.map((c) => c.name);
  const laneNames = lanes.length ? lanes : [t('kanban.generalLane')];

  const handleDragStart = () => {
    onAutoScrollStart();
  };

  const handleDragEnd = (result: DropResult) => {
    onAutoScrollEnd();
    if (allowDrag) onDragEnd(result);
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box
        ref={scrollContainerRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: `200px ${stages.map(() => '320px').join(' ')}`,
          gap: 2,
          p: 2,
          alignItems: 'start',
          overflow: 'auto',
          height: '100%',
        }}
      >
        <Box />

        {stages.map((stage) => (
          <Paper
            key={stage}
            className="glass"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              p: 2,
              fontWeight: 700,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            {stage}
          </Paper>
        ))}

        {laneNames.map((laneName) => (
          <>
            <Paper
              key={`header-${laneName}`}
              className="glass"
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderRadius: 2,
              }}
            >
              <Typography fontWeight={700} noWrap title={laneName}>{laneName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {
                  filtered.filter((row) => (row['Swimlane'] || laneNames[0]) === laneName).length
                }{' '}
                {t('kanban.cards')}
              </Typography>
            </Paper>

            {stages.map((stage) => {
              const cellCards = filtered.filter(
                (row) => inferStage(row) === stage && (row['Swimlane'] || laneNames[0]) === laneName,
              );

              return (
                <Droppable key={`${stage}-${laneName}`} droppableId={`${stage}||${laneName}`} isDropDisabled={!allowDrag}>
                  {(provided, snapshot) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="glass"
                      sx={{
                        bgcolor: snapshot.isDraggingOver ? alpha('#fff', 0.05) : 'background.paper',
                        borderRadius: 2,
                        minHeight: 140,
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {cellCards.map((card, cardIndex) => renderCard(card, cardIndex))}
                      {provided.placeholder}
                    </Paper>
                  )}
                </Droppable>
              );
            })}
          </>
        ))}
      </Box>
    </DragDropContext>
  );
}