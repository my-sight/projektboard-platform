#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== DIAGNOSING BOARDS & STORAGE ===${NC}"

# 1. RLS on boards
echo -e "\n1. Checking 'boards' RLS status..."
docker exec supabase-db psql -U postgres -d postgres -c "\
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'boards';"

# 2. RLS Policies on boards
echo -e "\n2. Checking 'boards' policies..."
docker exec supabase-db psql -U postgres -d postgres -c "\
SELECT * FROM pg_policies WHEREtablename = 'boards';"

# 3. Storage Buckets
echo -e "\n3. Checking Storage Buckets..."
docker exec supabase-db psql -U postgres -d postgres -c "\
SELECT id, name, public FROM storage.buckets;"

# 4. Storage Policies
echo -e "\n4. Checking Storage Policies (Objects)..."
docker exec supabase-db psql -U postgres -d postgres -c "\
SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';"
