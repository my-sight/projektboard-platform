-- Board Normalization & Lanes Fix
-- Ensures dedicated columns exist for board configuration and syncs data from settings JSONB.

-- 1. Add columns to kanban_boards
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS tr_label TEXT;
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS sop_label TEXT;
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS view_mode TEXT DEFAULT 'kanban';
ALTER TABLE kanban_boards ADD COLUMN IF NOT EXISTS lanes TEXT[];

-- 2. Backfill from settings JSONB
UPDATE kanban_boards
SET 
    tr_label = COALESCE(tr_label, settings->>'trLabel', 'Milestone'),
    sop_label = COALESCE(sop_label, settings->>'sopLabel', 'SOP'),
    view_mode = COALESCE(view_mode, settings->>'viewMode', 'kanban'),
    lanes = COALESCE(lanes, ARRAY(SELECT jsonb_array_elements_text(settings->'lanes')))
WHERE tr_label IS NULL OR sop_label IS NULL OR lanes IS NULL;

-- 3. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
