#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== RESTORING AUTH SCHEMA & FIXING PATHS ===${NC}"

# 1. Update Global Search Path to include 'auth'
echo "Updating GLOBAL search_path (Adding 'auth')..."
docker exec supabase-db psql -U postgres -d postgres -c "
ALTER DATABASE postgres SET search_path TO public, storage, auth, extensions;
"

# 2. Re-Apply Grants for Auth (Just in case)
echo "Ensuring Auth Permissions..."
docker exec supabase-db psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, supabase_auth_admin, service_role;
GRANT SELECT ON TABLE auth.users TO anon, authenticated; -- Minimal read access often needed for user checks
"

# 3. Verify System Settings table (for colors/branding)
echo "Verifying system_settings permissions..."
docker exec supabase-db psql -U postgres -d postgres -c "
GRANT ALL ON TABLE public.system_settings TO postgres, service_role;
GRANT SELECT ON TABLE public.system_settings TO anon, authenticated;
"

echo -e "${GREEN}Auth Schema Restored to Path.${NC}"
