#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== DEBUGGING STORAGE ROLE ===${NC}"

echo "1. Checking role config in pg_roles..."
docker exec supabase-db psql -U postgres -d postgres -c "\
SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'supabase_storage_admin';"

echo -e "\n2. Connecting AS supabase_storage_admin and checking search_path..."
# Using the POSTGRES_PASSWORD env var inside the container or assuming trust/password passed via env
# We'll use the environment variable if available, otherwise try without (trust usually not enabled for external, but local socket might be)
# Actually, the easiest way is to use postgres superuser to 'SET ROLE' which mimics the behavior perfectly without needing the password.

docker exec supabase-db psql -U postgres -d postgres -c "
  SET ROLE supabase_storage_admin;
  SHOW search_path;
  SELECT count(*) FROM buckets;
"
