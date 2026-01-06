#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== DIAGNOSING ACCESS CRISIS ===${NC}"

echo -e "\n1. Global Database Search Path:"
docker exec supabase-db psql -U postgres -d postgres -c "SHOW search_path;"

echo -e "\n2. Testing AUTHENTICATOR Role (Used by API):"
# Can it see auth.users?
docker exec supabase-db psql -U postgres -d postgres -c "
  SET ROLE authenticator; 
  SHOW search_path; 
  SELECT count(*) as user_count FROM auth.users;
" || echo -e "${RED}FAIL: authenticator cannot access auth.users${NC}"

echo -e "\n3. Testing STORAGE ADMIN Role:"
# Can it see storage.buckets?
docker exec supabase-db psql -U postgres -d postgres -c "
  SET ROLE supabase_storage_admin; 
  SHOW search_path; 
  SELECT count(*) as bucket_count FROM storage.buckets;
" || echo -e "${RED}FAIL: storage_admin cannot access storage.buckets${NC}"

echo -e "\n4. Testing POSTGRES Role (superuser):"
docker exec supabase-db psql -U postgres -d postgres -c "
  SELECT count(*) as profiles_count FROM public.profiles;
"

echo -e "\n5. Checking Schema Usage Grants:"
docker exec supabase-db psql -U postgres -d postgres -c "
  SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('auth', 'storage', 'public');
"
