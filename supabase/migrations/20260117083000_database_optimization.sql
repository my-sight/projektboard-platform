-- Database Optimization Migration
-- Created: 2026-01-17

-- 1. Update kanban_cards (Main Project & Task Data)
ALTER TABLE kanban_cards 
ADD COLUMN IF NOT EXISTS sop_date_original DATE,
ADD COLUMN IF NOT EXISTS sop_date_current DATE,
ADD COLUMN IF NOT EXISTS ms_date_original DATE,
ADD COLUMN IF NOT EXISTS ms_date_current DATE,
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS task_description TEXT;

-- 2. Update board_card_statuses (Board-specific Status)
ALTER TABLE board_card_statuses 
ADD COLUMN IF NOT EXISTS ampel_status TEXT,
ADD COLUMN IF NOT EXISTS escalation_status TEXT,
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sop_date_local DATE,
ADD COLUMN IF NOT EXISTS ms_date_local DATE,
ADD COLUMN IF NOT EXISTS task_status TEXT;

-- 3. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_project_number ON kanban_cards (project_number);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_project_name ON kanban_cards (project_name);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_ms_date ON kanban_cards (ms_date_current);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_assignee ON kanban_cards (assignee_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_due_date ON kanban_cards (due_date);
CREATE INDEX IF NOT EXISTS idx_board_card_statuses_ampel ON board_card_statuses (ampel_status);

-- 4. Backfill Function
CREATE OR REPLACE FUNCTION backfill_data_v4()
RETURNS void AS $$
BEGIN
    -- Backfill kanban_cards
    UPDATE kanban_cards
    SET 
        project_number = COALESCE(project_number, card_data->>'Nummer'),
        project_name = COALESCE(project_name, card_data->>'Teil', card_data->>'title'),
        sop_date_original = CASE 
            WHEN (card_data->>'SOP-Datum') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'SOP-Datum')::DATE 
            WHEN (card_data->>'SOP-Datum') ~ '^\d{2}\.\d{2}\.\d{4}$' THEN TO_DATE(card_data->>'SOP-Datum', 'DD.MM.YYYY')
            ELSE NULL END,
        sop_date_current = CASE WHEN (card_data->>'SOP_Neu') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'SOP_Neu')::DATE ELSE NULL END,
        ms_date_original = CASE 
            WHEN (card_data->>'TR-Datum') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'TR-Datum')::DATE 
            WHEN (card_data->>'TR-Datum') ~ '^\d{2}\.\d{2}\.\d{4}$' THEN TO_DATE(card_data->>'TR-Datum', 'DD.MM.YYYY')
            ELSE NULL END,
        ms_date_current = CASE 
            WHEN (card_data->>'TR_Neu') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'TR_Neu')::DATE 
            WHEN (card_data->>'MS_Neu') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'MS_Neu')::DATE
            ELSE NULL END,
        is_completed = COALESCE((card_data->>'TR_Completed')::BOOLEAN, (card_data->>'MS_Completed')::BOOLEAN, (card_data->>'status') = 'done', false),
        assignee_id = CASE WHEN (card_data->>'assigneeId') ~ '^[0-9a-fA-F-]{36}$' THEN (card_data->>'assigneeId')::UUID ELSE NULL END,
        due_date = CASE 
            WHEN (card_data->>'Due Date') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'Due Date')::DATE
            WHEN (card_data->>'dueDate') ~ '^\d{4}-\d{2}-\d{2}$' THEN (card_data->>'dueDate')::DATE
            ELSE NULL END,
        is_important = COALESCE((card_data->>'important')::BOOLEAN, (card_data->>'Priorität') = 'Hoch', false),
        task_description = COALESCE(card_data->>'description', card_data->>'title');

    -- Backfill board_card_statuses
    UPDATE board_card_statuses
    SET 
        ampel_status = local_data->>'Ampel',
        escalation_status = local_data->>'Eskalation',
        is_confirmed = COALESCE((local_data->>'TR_Completed')::BOOLEAN, (local_data->>'MS_Completed')::BOOLEAN, false),
        task_status = local_data->>'status';
END;
$$ LANGUAGE plpgsql;

-- Execute
SELECT backfill_data_v4();
drop function backfill_data_v4();
