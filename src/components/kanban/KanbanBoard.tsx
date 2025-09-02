'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Menu, 
  MenuItem, 
  Button,
  Chip,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { 
  Settings as SettingsIcon,
  Add as AddIcon,
  ViewColumn as ViewColumnIcon,
  ViewList as ViewListIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { boardService } from '@/lib/supabase';
import { Board, Card, BoardColumn } from '@/types';
import KanbanCard from './KanbanCard';
import CardDialog from './CardDialog';
import BoardSettings from './BoardSettings';

interface KanbanBoardProps {
  boardId: string;
}

export default function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [viewMode, setViewMode] = useState<'columns' | 'list'>('columns');
  const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Dialog States
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Menu States
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    loadBoard();
  }, [boardId]);

  const loadBoard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const boardData = await boardService.getBoard(boardId);
      setBoard(boardData);
      
      // Apply board settings
      if (boardData.settings) {
        setViewMode(boardData.settings.view_mode || 'columns');
        setDensity(boardData.settings.density || 'normal');
      }
    } catch (error) {
      console.error('Error loading board:', error);
      setError(error instanceof Error ? error.message : 'Fehler beim Laden des Boards');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !board) return;

    const { source, destination, draggableId } = result;
    
    // Same position, no change
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    try {
      // Optimistic update
      const newBoard = { ...board };
      const sourceColumn = newBoard.board_columns.find(col => col.id === source.droppableId);
      const destColumn = newBoard.board_columns.find(col => col.id === destination.droppableId);
      
      if (!sourceColumn || !destColumn) return;

      // Remove card from source
      const [movedCard] = sourceColumn.cards.splice(source.index, 1);
      
      // Add card to destination
      destColumn.cards.splice(destination.index, 0, {
        ...movedCard,
        column_id: destination.droppableId
      });

      setBoard(newBoard);

      // Update in database
      await boardService.moveCard(draggableId, destination.droppableId, destination.index);
      
    } catch (error) {
      console.error('Error moving card:', error);
      // Revert on error
      loadBoard();
    }
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setCardDialogOpen(true);
  };

  const handleCardUpdate = async (cardId: string, updates: Partial<Card>) => {
    try {
      await boardService.updateCard(cardId, updates);
      await loadBoard(); // Reload to get fresh data
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const handleAddCard = (columnId: string) => {
    const newCard: Card = {
      id: `temp-${Date.now()}`,
      column_id: columnId,
      title: 'Neue Karte',
      description: '',
      status: 'open',
      priority: 'medium',
      position: 0,
      due_date: null,
      start_date: null,
      completed_at: null,
      assigned_to: null,
      metadata: {},
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setSelectedCard(newCard);
    setCardDialogOpen(true);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  const getDensitySpacing = () => {
    switch (density) {
      case 'compact': return { gap: 1, padding: 1 };
      case 'comfortable': return { gap: 3, padding: 3 };
      default: return { gap: 2, padding: 2 };
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
        <Button onClick={loadBoard} sx={{ ml: 2 }}>
          Erneut versuchen
        </Button>
      </Alert>
    );
  }

  if (!board) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        Board nicht gefunden
      </Alert>
    );
  }

  const spacing = getDensitySpacing();

  return (
    <Box sx={{ 
      height: isFullscreen ? '100vh' : 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default'
    }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: spacing.padding,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            {board.name}
          </Typography>
          {board.description && (
            <Typography variant="body2" color="text.secondary">
              {board.description}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <Tooltip title={viewMode === 'columns' ? 'Zur Listenansicht' : 'Zur Spaltenansicht'}>
            <IconButton 
              onClick={() => setViewMode(viewMode === 'columns' ? 'list' : 'columns')}
              color={viewMode === 'columns' ? 'primary' : 'default'}
            >
              {viewMode === 'columns' ? <ViewColumnIcon /> : <ViewListIcon />}
            </IconButton>
          </Tooltip>

          {/* Density Chips */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(['compact', 'normal', 'comfortable'] as const).map((d) => (
              <Chip
                key={d}
                label={d === 'compact' ? 'S' : d === 'normal' ? 'M' : 'L'}
                size="small"
                variant={density === d ? 'filled' : 'outlined'}
                onClick={() => setDensity(d)}
                sx={{ minWidth: 32, height: 24 }}
              />
            ))}
          </Box>

          {/* Fullscreen Toggle */}
          <Tooltip title={isFullscreen ? 'Vollbild verlassen' : 'Vollbild'}>
            <IconButton onClick={toggleFullscreen}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>

          {/* Settings */}
          <Tooltip title="Board-Einstellungen">
            <IconButton onClick={handleSettingsClick}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Board Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'columns' ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Box sx={{ 
              display: 'flex',
              height: '100%',
              overflow: 'auto',
              p: spacing.padding,
              gap: spacing.gap
            }}>
              {board.board_columns.map((column) => (
                <Droppable key={column.id} droppableId={column.id}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        minWidth: 300,
                        maxWidth: 350,
                        bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'background.paper',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '100%'
                      }}
                    >
                      {/* Column Header */}
                      <Box sx={{ 
                        p: spacing.padding,
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: column.color || '#6b7280'
                            }}
                          />
                          <Typography variant="h6" component="h2">
                            {column.name}
                          </Typography>
                          <Chip 
                            label={column.cards.length} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                        <Tooltip title="Karte hinzufügen">
                          <IconButton 
                            size="small"
                            onClick={() => handleAddCard(column.id)}
                          >
                            <AddIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Cards */}
                      <Box sx={{ 
                        flex: 1,
                        overflow: 'auto',
                        p: spacing.padding,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: spacing.gap
                      }}>
                        {column.cards.map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <KanbanCard
                                  card={card}
                                  onClick={() => handleCardClick(card)}
                                  isDragging={snapshot.isDragging}
                                  density={density}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Box>
                    </Box>
                  )}
                </Droppable>
              ))}
            </Box>
          </DragDropContext>
        ) : (
          // List View (simplified for now)
          <Box sx={{ p: spacing.padding }}>
            <Typography variant="h6">Listenansicht (Coming Soon)</Typography>
          </Box>
        )}
      </Box>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={handleSettingsClose}
      >
        <MenuItem onClick={() => { setSettingsOpen(true); handleSettingsClose(); }}>
          Board-Einstellungen
        </MenuItem>
        <MenuItem onClick={handleSettingsClose}>
          Spalten verwalten
        </MenuItem>
        <MenuItem onClick={handleSettingsClose}>
          Board archivieren
        </MenuItem>
      </Menu>

      {/* Card Dialog */}
      <CardDialog
        open={cardDialogOpen}
        card={selectedCard}
        onClose={() => {
          setCardDialogOpen(false);
          setSelectedCard(null);
        }}
        onSave={handleCardUpdate}
        onDelete={(cardId) => {
          // TODO: Implement delete
          console.log('Delete card:', cardId);
        }}
      />

      {/* Board Settings Dialog */}
      <BoardSettings
        open={settingsOpen}
        board={board}
        onClose={() => setSettingsOpen(false)}
        onSave={(settings) => {
          // TODO: Implement settings save
          console.log('Save settings:', settings);
          setSettingsOpen(false);
        }}
      />
    </Box>
  );
}
