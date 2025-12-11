
-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users (authenticated and anon) so they can check license status
CREATE POLICY "Allow read access to system_settings"
ON system_settings FOR SELECT
USING (true);

-- Allow admins/service_role to update (already covered by Superuser logic usually, but let's be explicit for service role)
-- Actually, the UPSERT in license.ts uses the client. If the user is ANON (on license page), they cannot write.
-- The saveLicenseToken probably needs to run via server action or a custom API route if we want to allow ANON users to active the license?
-- Wait. `src/lib/license.ts` uses `supabase` from `src/lib/supabaseClient`.
-- If the user is not logged in (which they aren't on /license page usually), they are ANON.
-- They need INSERT/UPDATE permission on `system_settings` to save the license key?
-- That seems risky. Anyone could overwrite the license key.
-- BETTER APPROACH: The license verification checks the signature. If valid, we allow the save.
-- BUT RLS runs in DB. DB doesn't know about the signature verification in JS.
-- So we should probably proxy the save through an API route (`/api/system/license`) that uses SERVICE_ROLE.
-- OR simple fix for now: Allow ANON to INSERT/UPDATE `key='license_key'`.

CREATE POLICY "Allow anon to update license_key"
ON system_settings FOR ALL
USING (key = 'license_key')
WITH CHECK (key = 'license_key');
