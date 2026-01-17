-- LOUD SCHEMA CORRECTION
-- This migration ensures columns exist and fixes types without silencing errors.
-- If this fails, the NUC update script will STOP and show the error.

-- 1. Ensure columns exist on kanban_cards
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS project_number TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS sop_date_original TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS sop_date_current TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS ms_date_original TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS ms_date_current TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS due_date TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS task_description TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS assignee_id TEXT;

-- 2. Force TEXT type for date-like columns (idempotent)
ALTER TABLE kanban_cards ALTER COLUMN sop_date_original TYPE TEXT;
ALTER TABLE kanban_cards ALTER COLUMN sop_date_current TYPE TEXT;
ALTER TABLE kanban_cards ALTER COLUMN ms_date_original TYPE TEXT;
ALTER TABLE kanban_cards ALTER COLUMN ms_date_current TYPE TEXT;
ALTER TABLE kanban_cards ALTER COLUMN due_date TYPE TEXT;
ALTER TABLE kanban_cards ALTER COLUMN assignee_id TYPE TEXT;

-- 3. Ensure columns exist on board_card_statuses
ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS ampel_status TEXT;
ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS escalation_status TEXT;
ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;
ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS sop_date_local TEXT;
ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS ms_date_local TEXT;
ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS task_status TEXT;

-- 4. Force TEXT type on board_card_statuses
ALTER TABLE board_card_statuses ALTER COLUMN sop_date_local TYPE TEXT;
ALTER TABLE board_card_statuses ALTER COLUMN ms_date_local TYPE TEXT;

-- 5. Drop problematic constraints if they exist (assignee_id FK)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kanban_cards_assignee_id_fkey') THEN
        ALTER TABLE kanban_cards DROP CONSTRAINT kanban_cards_assignee_id_fkey;
    END IF;
END $$;

-- 6. Backfill missing data
UPDATE kanban_cards
SET 
    project_number = COALESCE(project_number, card_data->>'Nummer', ''),
    project_name = COALESCE(project_name, card_data->>'Teil', card_data->>'title', 'Unbekannt'),
    sop_date_original = COALESCE(sop_date_original, card_data->>'SOP-Datum'),
    sop_date_current = COALESCE(sop_date_current, card_data->>'SOP_Neu'),
    ms_date_original = COALESCE(ms_date_original, card_data->>'TR-Datum'),
    ms_date_current = COALESCE(ms_date_current, card_data->>'TR_Neu', card_data->>'MS_Neu'),
    assignee_id = COALESCE(assignee_id, card_data->>'assigneeId', card_data->>'VerantwortlichId'),
    due_date = COALESCE(due_date, card_data->>'Due Date', card_data->>'dueDate'),
    task_description = COALESCE(task_description, card_data->>'description', card_data->>'title', '')
WHERE project_name IS NULL OR project_number IS NULL;

-- 7. Force Schema Reload
NOTIFY pgrst, 'reload schema';
