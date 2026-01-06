#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING SEARCH PATH (Storage) ===${NC}"

docker exec supabase-db psql -U postgres -d postgres -c "
  ALTER ROLE supabase_storage_admin SET search_path TO storage, public, extensions;
  ALTER ROLE authenticated SET search_path TO public, storage, extensions;
  ALTER ROLE anon SET search_path TO public, storage, extensions;
  
  -- Grant usage just in case
  GRANT USAGE ON SCHEMA storage TO supabase_storage_admin, authenticated, anon;
  GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
"

echo -e "${GREEN}Search Path Fixed.${NC}"
