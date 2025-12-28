-- Add local_data column to board_card_statuses for storing board-specific card overrides
ALTER TABLE board_card_statuses 
ADD COLUMN IF NOT EXISTS local_data JSONB DEFAULT '{}'::jsonb;
