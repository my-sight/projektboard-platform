-- Enable RLS and apply safe default policies
-- Created: 2026-01-18

-- 1. Enable RLS on all tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_board_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_card_statuses ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh (avoids conflicts)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.system_settings;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.departments;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kanban_boards;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kanban_cards;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.board_members;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kanban_board_settings;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.board_card_statuses;

-- 3. Create BROAD policies (Phase 2 Step 1 Safety Net)
-- We want to prevent lockouts first, then refine later.
-- Allow authenticated users to EVERYTHING for now.

CREATE POLICY "Enable all access for authenticated users" ON public.system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.kanban_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.kanban_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.board_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.kanban_board_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.board_card_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Notify Reload
NOTIFY pgrst, 'reload schema';
