--
-- Ensures that board escalations and their history can be managed by ALL authenticated users.
-- This fixes the issue where only board members could edit escalations.
--

BEGIN;

-- 1. Enable RLS on tables (idempotent)
ALTER TABLE public.board_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_escalation_history ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if any (to be safe)
DROP POLICY IF EXISTS "Authenticated users manage escalations" ON public.board_escalations;
DROP POLICY IF EXISTS "Authenticated users can read escalations" ON public.board_escalations;

-- 3. Create permissive policies for board_escalations
-- Allow all authenticated users to Select, Insert, Update, Delete
CREATE POLICY "Authenticated users manage escalations"
  ON public.board_escalations
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- 4. Drop existing history policies
DROP POLICY IF EXISTS "Authenticated users can read escalation history" ON public.board_escalation_history;
DROP POLICY IF EXISTS "Authenticated users can write escalation history" ON public.board_escalation_history;

-- 5. Create permissive policies for board_escalation_history
CREATE POLICY "Authenticated users can read escalation history"
  ON public.board_escalation_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can write escalation history"
  ON public.board_escalation_history
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

COMMIT;
