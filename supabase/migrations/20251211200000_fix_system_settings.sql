
DROP TABLE IF EXISTS "public"."system_settings";

CREATE TABLE "public"."system_settings" (
    "key" text NOT NULL,
    "value" jsonb DEFAULT '{}'::jsonb,
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."system_settings"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "public"."system_settings"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "public"."system_settings"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
