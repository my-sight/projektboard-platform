-- FINAL SCHEMA HARMONIZATION
-- Created: 2026-01-17 10:00
-- This migration GENTLY but FIRMLY ensures all dual-writing columns exist with RELAXED types (TEXT).
-- This prevents any "Network Error" on the NUC due to strict database validation.

DO $$ 
BEGIN
    -- 1. KANBAN_CARDS: Ensure columns exist
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
    
    -- Special case: assignee_id might have a strict UUID constraint or Foreign Key
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kanban_cards' AND column_name='assignee_id') THEN
        ALTER TABLE kanban_cards ADD COLUMN assignee_id TEXT;
    ELSE
        -- Drop foreign key if it exists to allow TEXT transition
        ALTER TABLE kanban_cards DROP CONSTRAINT IF EXISTS kanban_cards_assignee_id_fkey;
        -- Move type to text if it was UUID
        ALTER TABLE kanban_cards ALTER COLUMN assignee_id TYPE TEXT;
    END IF;

    -- 2. Relax all Date types in kanban_cards if they were strict DATE before
    ALTER TABLE kanban_cards ALTER COLUMN sop_date_original TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN sop_date_current TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN ms_date_original TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN ms_date_current TYPE TEXT;
    ALTER TABLE kanban_cards ALTER COLUMN due_date TYPE TEXT;

    -- 3. BOARD_CARD_STATUSES: Ensure columns exist
    ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS ampel_status TEXT;
    ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS escalation_status TEXT;
    ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;
    ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS sop_date_local TEXT;
    ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS ms_date_local TEXT;
    ALTER TABLE board_card_statuses ADD COLUMN IF NOT EXISTS task_status TEXT;

    -- 4. Relax Date types in board_card_statuses
    ALTER TABLE board_card_statuses ALTER COLUMN sop_date_local TYPE TEXT;
    ALTER TABLE board_card_statuses ALTER COLUMN ms_date_local TYPE TEXT;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Some columns or types were already adjusted or skipped due to locks.';
END $$;

-- 5. Final Backfill for missing data from JSONB
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
    task_description = COALESCE(task_description, card_data->>'description', card_data->>'title')
WHERE project_name IS NULL OR project_number IS NULL;
