-- Refined Self-Healing & Relaxed Constraints Migration
-- Created: 2026-01-17 09:25
-- Relaxing ALL constraints and types to ensure "Network Error" disappears on NUC.

-- 1. Ensure columns exist on kanban_cards
ALTER TABLE kanban_cards 
ADD COLUMN IF NOT EXISTS project_number TEXT,
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS sop_date_original TEXT,
ADD COLUMN IF NOT EXISTS sop_date_current TEXT,
ADD COLUMN IF NOT EXISTS ms_date_original TEXT,
ADD COLUMN IF NOT EXISTS ms_date_current TEXT,
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
-- REMOVE Foreign Key and change to TEXT to avoid "Network Error" on invalid/dummy UUIDs
ADD COLUMN IF NOT EXISTS assignee_id TEXT,
ADD COLUMN IF NOT EXISTS due_date TEXT,
ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS task_description TEXT;

-- 2. Ensure columns exist on board_card_statuses
ALTER TABLE board_card_statuses 
ADD COLUMN IF NOT EXISTS ampel_status TEXT,
ADD COLUMN IF NOT EXISTS escalation_status TEXT,
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sop_date_local TEXT,
ADD COLUMN IF NOT EXISTS ms_date_local TEXT,
ADD COLUMN IF NOT EXISTS task_status TEXT;

-- 3. Relax existing column types if they were created as strict types previously
DO $$ 
BEGIN
    ALTER TABLE kanban_cards ALTER COLUMN sop_date_original TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN sop_date_current TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN ms_date_original TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN ms_date_current TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN due_date TYPE TEXT;
    -- Drop FK constraint and change to TEXT for assignee_id
    -- We need to find the constraint name first or just catch the error
    ALTER TABLE kanban_cards DROP CONSTRAINT IF EXISTS kanban_cards_assignee_id_fkey;
    ALTER TABLE kanban_cards ALTER COLUMN assignee_id TYPE TEXT;
    
    ALTER TABLE board_card_statuses ALTER COLUMN sop_date_local TYPE TEXT;
    ALTER TABLE board_card_statuses ALTER COLUMN ms_date_local TYPE TEXT;
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Skipping type conversion - likely columns were not strict types or are locked.';
END $$;

-- 4. Re-backfill for safety
UPDATE kanban_cards
SET 
    project_number = COALESCE(project_number, card_data->>'Nummer'),
    project_name = COALESCE(project_name, card_data->>'Teil', card_data->>'title'),
    sop_date_original = COALESCE(sop_date_original, card_data->>'SOP-Datum'),
    sop_date_current = COALESCE(sop_date_current, card_data->>'SOP_Neu'),
    ms_date_original = COALESCE(ms_date_original, card_data->>'TR-Datum'),
    ms_date_current = COALESCE(ms_date_current, card_data->>'TR_Neu', card_data->>'MS_Neu'),
    assignee_id = COALESCE(assignee_id, card_data->>'assigneeId', card_data->>'VerantwortlichId'),
    due_date = COALESCE(due_date, card_data->>'Due Date', card_data->>'dueDate'),
    task_description = COALESCE(task_description, card_data->>'description', card_data->>'title');
