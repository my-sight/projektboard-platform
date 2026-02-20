-- Ensure no old policies block us
DROP POLICY IF EXISTS "Allow public read access to system_settings" ON "public"."system_settings";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."system_settings";

-- Create explicit public read policy
CREATE POLICY "Allow public read access to system_settings"
ON "public"."system_settings"
FOR SELECT
TO public
USING (true);

-- Ensure RLS is enabled (should be already)
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;
