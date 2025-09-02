'use client';

import { BoardColumn, ExtendedCard } from '@/types';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: BoardColumn;
  cards: ExtendedCard[];
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onToggleCollapse: (cardId: string) => void;
  onEscalate: (cardId: string, level: 'LK' | 'SK' | null) => void;
  onEditCard: (card: ExtendedCard) => void;
  isDragOver: boolean;
  density: 'compact' | 'normal' | 'large';
}

export default function KanbanColumn({
  column,
  cards,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onToggleCollapse,
  onEscalate,
  onEditCard,
  isDragOver,
  density
}: KanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop();
  };

  const sortedCards = [...cards].sort((a, b) => a.position - b.position);

  return (
    <div className="col">
      <h3>
        {column.name}
        {column.is_done && ' ✓'}
        <span className="muted" style={{ marginLeft: '8px' }}>
          ({cards.length})
        </span>
      </h3>
      
      <div 
        className={`lane ${isDragOver ? 'is-over' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {sortedCards.map(card => (
          <KanbanCard
            key={card.id}
            card={card}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onToggleCollapse={onToggleCollapse}
            onEscalate={onEscalate}
            onEditCard={onEditCard}
            density={density}
          />
        ))}
      </div>
    </div>
  );
}
