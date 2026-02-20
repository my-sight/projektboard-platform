-- Enable RLS
ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;

-- Drop verify policy if exists (to be safe)
DROP POLICY IF EXISTS "Admins can update departments" ON "public"."departments";

-- Create Update Policy
CREATE POLICY "Admins can update departments"
ON "public"."departments"
FOR UPDATE
USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
)
WITH CHECK (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);
