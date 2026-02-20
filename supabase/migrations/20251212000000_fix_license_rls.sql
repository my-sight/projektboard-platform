-- Allow public read access to system_settings so anon users can verify license
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to system_settings" 
ON "public"."system_settings" 
FOR SELECT 
USING (true);

-- Allow authenticated users to update system_settings (for saving license)
CREATE POLICY "Allow authenticated update to system_settings"
ON "public"."system_settings"
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to insert system_settings
CREATE POLICY "Allow authenticated insert system_settings"
ON "public"."system_settings"
FOR INSERT
TO authenticated
WITH CHECK (true);
