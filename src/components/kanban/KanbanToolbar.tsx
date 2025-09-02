'use client';

import { ExtendedCard } from '@/types';

interface KanbanToolbarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedLane: string;
  onLaneChange: (lane: string) => void;
  viewMode: 'columns' | 'swimlanes-responsible' | 'swimlanes-category';
  onViewModeChange: (mode: 'columns' | 'swimlanes-responsible' | 'swimlanes-category') => void;
  density: 'compact' | 'normal' | 'large';
  onDensityChange: (density: 'compact' | 'normal' | 'large') => void;
  cards: ExtendedCard[];
}

export default function KanbanToolbar({
  searchTerm,
  onSearchChange,
  selectedLane,
  onLaneChange,
  viewMode,
  onViewModeChange,
  density,
  onDensityChange,
  cards
}: KanbanToolbarProps) {
  // Get unique swimlanes from cards
  const swimlanes = Array.from(new Set(
    cards.map(card => card.swimlane).filter(Boolean)
  ));

  // Get unique assignees
  const assignees = Array.from(new Set(
    cards.map(card => card.assignee?.display_name).filter(Boolean)
  ));

  const handleAddCard = () => {
    // TODO: Implement add card functionality
    console.log('Add new card');
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export board');
  };

  const handleSettings = () => {
    // TODO: Implement settings functionality
    console.log('Open settings');
  };

  return (
    <div className="toolbar">
      {/* Search */}
      <input
        type="search"
        placeholder="Suche nach Karten..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Lane filter */}
      <select
        value={selectedLane}
        onChange={(e) => onLaneChange(e.target.value)}
      >
        <option value="all">Alle Bereiche</option>
        <option value="unassigned">Nicht zugeordnet</option>
        {swimlanes.map(lane => (
          <option key={lane} value={lane}>{lane}</option>
        ))}
      </select>

      {/* View Mode Buttons */}
      <div id="viewModeButtons">
        <button
          className={`btn ${viewMode === 'columns' ? 'active' : ''}`}
          onClick={() => onViewModeChange('columns')}
          title="Spaltenansicht"
        >
          ⚏
        </button>
        <button
          className={`btn ${viewMode === 'swimlanes-responsible' ? 'active' : ''}`}
          onClick={() => onViewModeChange('swimlanes-responsible')}
          title="Swimlanes nach Verantwortlichen"
        >
          👥
        </button>
        <button
          className={`btn ${viewMode === 'swimlanes-category' ? 'active' : ''}`}
          onClick={() => onViewModeChange('swimlanes-category')}
          title="Swimlanes nach Kategorie"
        >
          📂
        </button>
      </div>

      {/* Density Buttons */}
      <div id="densityButtons">
        <button
          className={`btn ${density === 'large' ? 'active' : ''}`}
          onClick={() => onDensityChange('large')}
          title="Große Karten"
        >
          ⬜
        </button>
        <button
          className={`btn ${density === 'normal' ? 'active' : ''}`}
          onClick={() => onDensityChange('normal')}
          title="Normale Karten"
        >
          ▢
        </button>
        <button
          className={`btn ${density === 'compact' ? 'active' : ''}`}
          onClick={() => onDensityChange('compact')}
          title="Kompakte Karten"
        >
          ▫
        </button>
      </div>

      {/* Action Buttons */}
      <button className="btn primary" onClick={handleAddCard}>
        + Neue Karte
      </button>
      
      <button className="btn" onClick={handleExport}>
        📊 Export
      </button>
      
      <button className="btn" onClick={handleSettings}>
        ⚙ Einstellungen
      </button>
    </div>
  );
}
