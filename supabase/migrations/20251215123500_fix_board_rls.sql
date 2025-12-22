-- Fix RLS policies for kanban_boards to allow explicit superuser email updates
-- This is necessary because sometimes the role-based check fails if the profile isn't fully synced or if using a specific superuser email that should always have access.

DROP POLICY IF EXISTS "rbac_manage_boards" ON "public"."kanban_boards";

CREATE POLICY "rbac_manage_boards"
ON "public"."kanban_boards"
AS PERMISSIVE
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
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net') -- Explicit Superuser Fallback
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.role) = ANY (ARRAY['admin', 'owner', 'manager', 'superuser'])
  ))
  OR (auth.uid() = owner_id)
  OR (auth.uid() = board_admin_id)
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net') -- Explicit Superuser Fallback
);

-- Also update kanban_board_settings just in case
DROP POLICY IF EXISTS "rbac_manage_board_settings" ON "public"."kanban_board_settings";

CREATE POLICY "rbac_manage_board_settings"
ON "public"."kanban_board_settings"
AS PERMISSIVE
FOR ALL
TO public
USING (
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.role) = ANY (ARRAY['admin', 'owner', 'manager', 'superuser'])
  ))
  OR (EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = kanban_board_settings.board_id
      AND (b.owner_id = auth.uid() OR b.board_admin_id = auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM public.board_members bm
    WHERE bm.board_id = kanban_board_settings.board_id
      AND bm.profile_id = auth.uid()
  ))
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net') -- Explicit Superuser Fallback
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.role) = ANY (ARRAY['admin', 'owner', 'manager', 'superuser'])
  ))
  OR (EXISTS (
    SELECT 1 FROM public.kanban_boards b
    WHERE b.id = kanban_board_settings.board_id
      AND (b.owner_id = auth.uid() OR b.board_admin_id = auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM public.board_members bm
    WHERE bm.board_id = kanban_board_settings.board_id
      AND bm.profile_id = auth.uid()
  ))
  OR ((auth.jwt() ->> 'email') = 'michael@mysight.net') -- Explicit Superuser Fallback
);
