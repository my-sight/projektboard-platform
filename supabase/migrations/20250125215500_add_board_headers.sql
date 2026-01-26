-- Add tr_label and sop_label to kanban_boards to support custom naming persistence
ALTER TABLE public.kanban_boards ADD COLUMN IF NOT EXISTS tr_label TEXT;
ALTER TABLE public.kanban_boards ADD COLUMN IF NOT EXISTS sop_label TEXT;

-- Update existing boards to have default values if null (optional, but good for consistency)
UPDATE public.kanban_boards SET tr_label = 'TR' WHERE tr_label IS NULL;
UPDATE public.kanban_boards SET sop_label = 'SOP' WHERE sop_label IS NULL;

-- Trigger update timestamp
UPDATE public.kanban_boards SET updated_at = timezone('utc', now()) WHERE tr_label IS NOT NULL OR sop_label IS NOT NULL;
