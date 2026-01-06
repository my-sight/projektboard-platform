#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FINAL FIX: PERMISSIONS, PATHS & NETWORKING ===${NC}"

# 1. Fix Kong Permissions using CORRECT PATHS
# Assuming we are in ~/projektboard-platform/deploy/ or ~/projektboard-platform/
# We will use find to be sure or check both.
echo "Fixing Kong Permissions..."
if [ -d "deploy/volumes/api" ]; then
  chmod -R 777 deploy/volumes/api
  echo "Fixed deploy/volumes/api"
elif [ -d "volumes/api" ]; then
  chmod -R 777 volumes/api
  echo "Fixed volumes/api"
else
  echo -e "${GREEN}Could not find relative path, trying absolute assumption...${NC}"
  chmod -R 777 ~/projektboard-platform/deploy/volumes/api
fi

# 2. Grant Missing Table Permissions (Fixes 500 Error on Kanban)
echo "Granting Table Permissions to Anon/Authenticated..."
docker exec supabase-db psql -U postgres -d postgres -c "
  -- Grant Usage on Schemas
  GRANT USAGE ON SCHEMA public, auth, storage, extensions TO postgres, anon, authenticated, service_role;
  
  -- Grant Table Access (Critical for 500 fixes)
  GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  
  -- Grant Auth Access (for User Management)
  GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role, supabase_auth_admin;
  GRANT SELECT ON TABLE auth.users TO anon, authenticated;

  -- Grant Storage Access (for Logos)
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin, postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin, postgres, anon, authenticated, service_role;
"

# 3. Restart ALL Connectivity Services
echo "Restarting Connectivity Services..."
docker restart supabase-kong supabase-rest supabase-realtime

echo -e "${GREEN}Final Fix Applied. Wait 15s before testing.${NC}"
