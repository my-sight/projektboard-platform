#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== EMERGENCY RESET: DATABASE CONFIG ===${NC}"

# 1. Reset Global Search Path to Default (Undo Nuclear Fix)
echo "Resetting GLOBAL search_path to default..."
docker exec supabase-db psql -U postgres -d postgres -c "
ALTER DATABASE postgres RESET search_path;
"

# 2. Re-Apply Essential Grants (Safety Net)
echo "Restoring standard grants..."
docker exec supabase-db psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA public, auth, storage, extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, auth, storage TO postgres, service_role;
"

echo -e "${GREEN}Database Configuration Reset.${NC}"
echo "Please restart services immediately."
