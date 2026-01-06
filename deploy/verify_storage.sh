#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== VERIFYING STORAGE SCHEMA ===${NC}"

echo "Checking if 'buckets' table exists in 'storage' schema..."
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema = 'storage' AND table_name = 'buckets';"

echo -e "\n${GREEN}=== RESTARTING STORAGE SERVICE ===${NC}"
echo "Restarting service to pick up search_path changes..."
docker restart supabase-storage

echo -e "\n${GREEN}=== LOGS (TAIL) ===${NC}"
sleep 2
docker logs --tail 20 supabase-storage
