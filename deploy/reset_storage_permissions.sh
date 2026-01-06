#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== RESETTING STORAGE PERMISSIONS (FINAL) ===${NC}"

docker exec supabase-db psql -U postgres -d postgres -c "
  -- 1. Ensure Buckets Exist (Idempotent)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
  VALUES 
    ('branding', 'branding', true, null, null),
    ('avatars', 'avatars', true, null, null),
    ('kanban-thumbnails', 'kanban-thumbnails', true, null, null)
  ON CONFLICT (id) DO UPDATE SET public = excluded.public;

  -- 2. Force Owner to supabase_storage_admin
  ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
  ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

  -- 3. Grant Usage
  GRANT ALL ON SCHEMA storage TO postgres, supabase_storage_admin, service_role;
  -- IMPORTANT: Authenticated users need permissions to SELECT buckets to 'find' them
  GRANT SELECT ON storage.buckets TO anon, authenticated;
  GRANT ALL ON storage.objects TO anon, authenticated;

  -- 4. Enable RLS but add Permissive Policy
  ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
  
  -- Drop existing policies to be clean
  DROP POLICY IF EXISTS \"Public Access\" ON storage.buckets;
  DROP POLICY IF EXISTS \"Public Access\" ON storage.objects;
  
  -- Create 'Open' Policy
  CREATE POLICY \"Public Access\" ON storage.buckets FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY \"Public Access\" ON storage.objects FOR ALL USING (true) WITH CHECK (true);
  
  -- Enable RLS on objects
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
"

echo -e "${GREEN}Storage Permissions Reset. All users can now access 'branding'.${NC}"
