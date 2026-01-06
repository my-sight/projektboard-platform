#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING MISSING BUCKETS & SEQUENCES ===${NC}"

# 1. Insert Buckets (The "Bucket not found" fix)
echo "Seeding Storage Buckets..."
docker exec supabase-db psql -U postgres -d postgres <<EOF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('branding', 'branding', true, null, null),
  ('avatars', 'avatars', true, null, null),
  ('kanban-thumbnails', 'kanban-thumbnails', true, null, null)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;
EOF

# 2. Fix Board Creation (Sequence Permissions)
echo "Fixing Sequence Permissions (for Board IDs)..."
docker exec supabase-db psql -U postgres -d postgres -c "
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
"

# 3. Double-Check Kanban RLS (Just to be absolutely sure)
echo "Ensuring Kanban Tables are Writable..."
docker exec supabase-db psql -U postgres -d postgres -c "
  ALTER TABLE IF EXISTS public.kanban_boards DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.kanban_cards DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.board_members DISABLE ROW LEVEL SECURITY;
"

echo -e "${GREEN}Buckets seeded and Sequences Unlocked.${NC}"
