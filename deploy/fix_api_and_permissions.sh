#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING API & PERMISSIONS ===${NC}"

# 1. Inspect Logs BEFORE fix (to confirm hypothesis)
echo "Inspecting PostgREST logs (last 20 lines)..."
docker logs --tail 20 supabase-rest

# 2. Grant permissions to AUTHENTICATOR (Critical for PostgREST)
echo "Granting 'authenticator' permissions..."
docker exec supabase-db psql -U postgres -d postgres -c "
  GRANT USAGE ON SCHEMA public, auth, storage, extensions TO authenticator;
  GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
  
  -- Ensure Authenticator can see tables to build cache
  GRANT SELECT ON ALL TABLES IN SCHEMA public, auth TO authenticator;
  
  -- Re-apply Storage Grants
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin, postgres;
  GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin, postgres;
"

# 3. Force Restart API Services
echo "Restarting API services (rest, kong)..."
docker restart supabase-rest supabase-kong

# 4. Wait and Verify
echo "Waiting for services..."
sleep 5
echo "Inspecting PostgREST logs AFTER restart..."
docker logs --tail 20 supabase-rest

echo -e "${GREEN}API Access Fix Applied.${NC}"
