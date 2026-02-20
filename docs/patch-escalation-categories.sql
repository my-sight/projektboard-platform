--
-- Updates the check constraint on board_escalations to allow 'Y' and 'R' categories.
-- This fixes the issue where saving escalations in the Management View fails.
--

BEGIN;

-- 1. Drop the existing constraint (name might vary, so we try to identify it or just drop the likely name)
-- Note: Supabase/Postgres usually names check constraints like <table>_<column>_check
ALTER TABLE public.board_escalations DROP CONSTRAINT IF EXISTS board_escalations_category_check;

-- 2. Add the new constraint allowing LK, SK, Y, R
ALTER TABLE public.board_escalations
  ADD CONSTRAINT board_escalations_category_check 
  CHECK (category IN ('LK', 'SK', 'Y', 'R'));

COMMIT;
