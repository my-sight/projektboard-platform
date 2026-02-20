-- Add parent_id to kanban_boards to support Con-Boards (Child Boards)
ALTER TABLE kanban_boards 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES kanban_boards(id) ON DELETE SET NULL;

-- Create table to track status of shared cards in Con-Boards
CREATE TABLE IF NOT EXISTS board_card_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    column_id TEXT, -- The name of the column (stage) in the Con-Board
    position INTEGER DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(board_id, card_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_board_card_statuses_board_card ON board_card_statuses(board_id, card_id);
