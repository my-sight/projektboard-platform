-- EMERGENCY FIX: Restore Board Access
-- The previous policy likely caused a recursion or was too restrictive.
-- We simplifies policies to:
-- 1. READ: All authenticated users (Resolves Con-Board parent lookup issues)
-- 2. INSERT: All authenticated users
-- 3. UPDATE/DELETE: Owner/Admin

DROP POLICY IF EXISTS "select_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "modify_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "rbac_manage_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "rbac_read_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "read_all_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "insert_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "update_delete_boards" ON "public"."kanban_boards";
DROP POLICY IF EXISTS "delete_boards" ON "public"."kanban_boards";

-- 1. READ: Allow all authenticated users to read all boards
CREATE POLICY "read_all_boards"
ON "public"."kanban_boards"
FOR SELECT
TO public
USING (auth.role() = 'authenticated');

-- 2. INSERT: Allow all authenticated users to create boards
CREATE POLICY "insert_boards"
ON "public"."kanban_boards"
FOR INSERT
TO public
WITH CHECK (auth.role() = 'authenticated');

-- 3. UPDATE: Only Owner, Admin, Board Admin
CREATE POLICY "update_boards"
ON "public"."kanban_boards"
FOR UPDATE
TO public
USING (
  (auth.uid() = owner_id) OR
  (auth.uid() = board_admin_id) OR
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) IN ('admin', 'superuser'))) OR
  ((auth.jwt() ->> 'email') = 'michael@mysight.net')
)
WITH CHECK (
  (auth.uid() = owner_id) OR
  (auth.uid() = board_admin_id) OR
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) IN ('admin', 'superuser'))) OR
  ((auth.jwt() ->> 'email') = 'michael@mysight.net')
);

-- 4. DELETE: Only Owner, Admin, Board Admin
CREATE POLICY "delete_boards"
ON "public"."kanban_boards"
FOR DELETE
TO public
USING (
  (auth.uid() = owner_id) OR
  (auth.uid() = board_admin_id) OR
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) IN ('admin', 'superuser'))) OR
  ((auth.jwt() ->> 'email') = 'michael@mysight.net')
);
