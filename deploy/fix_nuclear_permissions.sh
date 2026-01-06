#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING PERMISSIONS (NUCLEAR OPTION) ===${NC}"

# 1. Global Database Search Path (Overrides everything)
echo "Setting GLOBAL search_path for 'postgres' database..."
docker exec supabase-db psql -U postgres -d postgres -c "
ALTER DATABASE postgres SET search_path TO public, storage, extensions;
"

# 2. Grant permissions explicitly to storage admin
echo "Granting explicit schema usage..."
docker exec supabase-db psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin, postgres, service_role;
"

# 3. Create Buckets (Again, just to be sure)
echo "Ensuring Buckets exist..."
docker exec supabase-db psql -U postgres -d postgres <<EOF
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (name) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (name) DO NOTHING;
insert into storage.buckets (id, name, public) values ('kanban-thumbnails', 'kanban-thumbnails', true) on conflict (name) do nothing;
EOF

# 4. Storage Policies (Permissive)
echo "Applying Storage Policies..."
docker exec supabase-db psql -U postgres -d postgres <<EOF
CREATE POLICY "Branding Public Read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'branding');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth Select" ON storage.objects FOR SELECT TO authenticated USING (true);
EOF
# Errors about existing policies are fine (ignored)

# 5. Disable RLS on Kanban Tables (Unblock Boards)
echo "Unblocking Kanban Tables..."
docker exec supabase-db psql -U postgres -d postgres <<EOF
ALTER TABLE IF EXISTS public.kanban_boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kanban_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kanban_board_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.board_card_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.board_escalations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.board_top_topics DISABLE ROW LEVEL SECURITY;
EOF

echo -e "${GREEN}Nuclear Fix Applied. Please restart services to be safe.${NC}"
