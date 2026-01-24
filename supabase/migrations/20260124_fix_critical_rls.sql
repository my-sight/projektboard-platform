-- CRITICAL SECURITY FIX: Strict Row Level Security (RESTRICTED MODEL)
-- Date: 2026-01-24
-- Description: Implement strict hierarchial permissions.

-- 1. Helper Function (Secure Admin Check)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reset Policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.system_settings;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kanban_boards;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kanban_cards;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.board_members;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kanban_board_settings;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.board_card_statuses;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.departments;

-- Cleanup previous attempts
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
-- (and others if they were applied, safe to drop if exists)


-- 3. Strict Policies Implementation

-- === PROFILES ===
-- Read: Everyone (Required for Avatars/Assigned Users on Boards)
CREATE POLICY "Profiles View All" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Update: Own basic data only, or Admin
CREATE POLICY "Profiles Update Self" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id); 
-- Note: Logic to prevent 'role' change via API validation or separate trigger is recommended.

CREATE POLICY "Profiles Update Admin" ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Delete: ONLY Admin
CREATE POLICY "Profiles Delete Admin" ON public.profiles FOR DELETE TO authenticated
USING (public.is_admin());


-- === SYSTEM SETTINGS ===
-- Read: Everyone (System State/License)
CREATE POLICY "Settings View" ON public.system_settings FOR SELECT TO authenticated USING (true);

-- Write: ONLY Admin
CREATE POLICY "Settings Manage" ON public.system_settings FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- === KANBAN BOARDS ===
-- Read: Everyone (Transparency)
CREATE POLICY "Boards View All" ON public.kanban_boards FOR SELECT TO authenticated USING (true);

-- Create: ONLY Admin (User Request)
CREATE POLICY "Boards Create Admin" ON public.kanban_boards FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- Update: Owner (should allow basic settings) OR Admin
-- Note: If only Admins create boards, they are Owners. 
CREATE POLICY "Boards Update Owner/Admin" ON public.kanban_boards FOR UPDATE TO authenticated
USING (auth.uid() = owner_id OR public.is_admin())
WITH CHECK (auth.uid() = owner_id OR public.is_admin());

-- Delete: Owner OR Admin
CREATE POLICY "Boards Delete Owner/Admin" ON public.kanban_boards FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.is_admin());


-- === BOARD MEMBERS ===
-- Manage: Admin OR Board Owner
CREATE POLICY "Members Manage" ON public.board_members FOR ALL TO authenticated
USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id = board_members.board_id AND b.owner_id = auth.uid())
  OR user_id = auth.uid() -- Users can leave
)
WITH CHECK (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id = board_members.board_id AND b.owner_id = auth.uid())
);


-- === KANBAN CARDS (and statuses) ===
-- Read: Everyone (Transparency)
CREATE POLICY "Cards View All" ON public.kanban_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Statuses View All" ON public.board_card_statuses FOR SELECT TO authenticated USING (true);

-- Write (Edit/Move/Create/Delete): Members Only (+ Admin)
-- "Nur Boardmitglieder und Admins dürfen die Karten bearbeiten oder löschen."
CREATE POLICY "Cards Manage Member" ON public.kanban_cards FOR ALL TO authenticated
USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.board_members m 
    WHERE m.board_id = kanban_cards.board_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.board_members m 
    WHERE m.board_id = kanban_cards.board_id AND m.user_id = auth.uid()
  )
);

-- Same for Statuses (Columns) - usually Admin/Owner, but let's allow members if they manage cards?
-- Usually modifying columns is a Board Admin task. Let's make it Owner/Admin for structure stability.
CREATE POLICY "Statuses Manage Owner/Admin" ON public.board_card_statuses FOR ALL TO authenticated
USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id = board_card_statuses.board_id AND b.owner_id = auth.uid())
)
WITH CHECK (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id = board_card_statuses.board_id AND b.owner_id = auth.uid())
);

-- 4. Extra Hardening: Protect Role Column via Trigger
-- Even if RLS allows UPDATE on the row, this trigger prevents non-admins from touching 'role'.
CREATE OR REPLACE FUNCTION public.protect_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If role changed...
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- ...and user is NOT admin
    IF NOT public.is_admin() THEN
       RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_role_change ON public.profiles;
CREATE TRIGGER tr_protect_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_role_change();

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
