'use client';

import { ReactNode } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Box, IconButton, Typography } from '@mui/material';
import { KanbanDensity } from './KanbanCard';

export interface KanbanColumnsViewProps {
  rows: any[];
  cols: { id: string; name: string; done?: boolean }[];
  density: KanbanDensity;
  searchTerm: string;
  onDragEnd: (result: DropResult) => void;
  inferStage: (card: any) => string;
  archiveColumn: (columnName: string) => void;
  renderCard: (card: any, index: number) => ReactNode;
}

export function KanbanColumnsView({
  rows,
  cols,
  density,
  searchTerm,
  onDragEnd,
  inferStage,
  archiveColumn,
  renderCard,
}: KanbanColumnsViewProps) {
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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          p: 2,
          overflow: 'auto',
          alignItems: 'flex-start',
          minHeight: '100%',
        }}
      >
        {cols.map((col) => {
          const colCards = filtered.filter((row) => inferStage(row) === col.name);
          const redCount = colCards.filter((row) => String(row['Ampel'] || '').toLowerCase().startsWith('rot')).length;

          return (
            <Box
              key={col.id}
              sx={{
                minWidth: 'var(--colw)',
                width: 'var(--colw)',
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '55vh',
              }}
            >
              <Box
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--panel)',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 3,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    {col.name} {col.done && '✓'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                      ({colCards.length})
                    </Typography>
                    {redCount > 0 && (
                      <Typography variant="caption" sx={{ color: '#ff5a5a' }}>
                        ● {redCount}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {col.done && (
                  <IconButton
                    size="small"
                    title="Alle Karten archivieren"
                    onClick={() => archiveColumn(col.name)}
                    sx={{
                      width: 22,
                      height: 22,
                      border: '1px solid var(--line)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    📦
                  </IconButton>
                )}
              </Box>

              <Droppable droppableId={col.name}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      flex: 1,
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: density === 'xcompact' ? 0 : 1,
                      minHeight: '200px',
                      backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.06)' : 'transparent',
                      outline: snapshot.isDraggingOver ? '2px dashed var(--line)' : 'none',
                      outlineOffset: snapshot.isDraggingOver ? '-4px' : '0',
                      transition: 'background-color 0.12s ease, outline-color 0.12s ease',
                    }}
                  >
                    {density === 'xcompact' ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 1fr)',
                          gap: 0,
                          gridAutoRows: '18px',
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
            </Box>
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
}

export function KanbanSwimlaneView({ rows, cols, searchTerm, onDragEnd, inferStage, renderCard }: KanbanSwimlaneViewProps) {
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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `var(--rowheadw) ${stages.map(() => 'var(--colw)').join(' ')}`,
          gap: '8px',
          p: 2,
          alignItems: 'start',
          overflow: 'auto',
          minHeight: '100%',
          width: 'fit-content',
          minWidth: '100%',
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '10px 12px',
            minHeight: '48px',
          }}
        />

        {stages.map((stage) => (
          <Box
            key={stage}
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '10px 12px',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {stage}
          </Box>
        ))}

        {resps.map((resp) => (
          <>
            <Box
              key={`header-${resp}`}
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                minHeight: '48px',
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>{resp}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                {
                  filtered.filter(
                    (row) => (String(row['Verantwortlich'] || '').trim() || '—') === resp,
                  ).length
                }{' '}
                Karten
              </Typography>
            </Box>

            {stages.map((stage) => {
              const cellCards = filtered.filter(
                (row) => inferStage(row) === stage && (String(row['Verantwortlich'] || '').trim() || '—') === resp,
              );

              return (
                <Droppable key={`${stage}-${resp}`} droppableId={`${stage}||${resp}`}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.06)' : 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        minHeight: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '8px',
                        gap: 1,
                      }}
                    >
                      {cellCards.map((card, cardIndex) => renderCard(card, cardIndex))}
                      {provided.placeholder}
                    </Box>
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
}

export function KanbanLaneView({ rows, cols, lanes, searchTerm, onDragEnd, inferStage, renderCard }: KanbanLaneViewProps) {
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
  const laneNames = lanes.length ? lanes : ['Allgemein'];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `var(--rowheadw) ${stages.map(() => 'var(--colw)').join(' ')}`,
          gap: '8px',
          p: 2,
          alignItems: 'start',
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '10px 12px',
            minHeight: '48px',
          }}
        />

        {stages.map((stage) => (
          <Box
            key={stage}
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              backgroundColor: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '10px 12px',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {stage}
          </Box>
        ))}

        {laneNames.map((laneName) => (
          <>
            <Box
              key={`header-${laneName}`}
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                minHeight: '48px',
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>{laneName}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                {
                  filtered.filter((row) => (row['Swimlane'] || laneNames[0]) === laneName).length
                }{' '}
                Karten
              </Typography>
            </Box>

            {stages.map((stage) => {
              const cellCards = filtered.filter(
                (row) => inferStage(row) === stage && (row['Swimlane'] || laneNames[0]) === laneName,
              );

              return (
                <Droppable key={`${stage}-${laneName}`} droppableId={`${stage}||${laneName}`}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.06)' : 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        minHeight: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '8px',
                        gap: 1,
                      }}
                    >
                      {cellCards.map((card, cardIndex) => renderCard(card, cardIndex))}
                      {provided.placeholder}
                    </Box>
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
