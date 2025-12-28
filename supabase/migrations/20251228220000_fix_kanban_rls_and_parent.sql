-- Ensure parent_id exists (idempotent)
ALTER TABLE public.kanban_boards ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.kanban_boards(id) ON DELETE SET NULL;

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "rbac_manage_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "select_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "modify_boards" ON "public"."kanban_boards";

-- Split into SELECT and MODIFY policies for better granularity

-- 1. SELECT: Allow access to Admins, Owners, AND Board Members
CREATE POLICY "select_boards"
ON "public"."kanban_boards"
FOR SELECT
TO public
USING (
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.role) = ANY (ARRAY['admin', 'owner', 'manager', 'superuser'])
  ))
  OR (auth.uid() = owner_id)
  OR (auth.uid() = board_admin_id)
  OR (EXISTS (
    SELECT 1 FROM public.board_members bm
    WHERE bm.board_id = id
      AND bm.profile_id = auth.uid()
  ))
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net')
  -- Optional: Allow Public Boards?
  -- OR (visibility = 'public') 
);

-- 2. MODIFY: Restrict to Admins, Owners (Original Logic)
CREATE POLICY "modify_boards"
ON "public"."kanban_boards"
FOR ALL
TO public
USING (
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.role) = ANY (ARRAY['admin', 'owner', 'manager', 'superuser'])
  ))
  OR (auth.uid() = owner_id)
  OR (auth.uid() = board_admin_id)
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net')
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.role) = ANY (ARRAY['admin', 'owner', 'manager', 'superuser'])
  ))
  OR (auth.uid() = owner_id)
  OR (auth.uid() = board_admin_id)
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net')
);
