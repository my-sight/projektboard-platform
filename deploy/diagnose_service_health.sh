#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== CHECKING CONTAINER HEALTH ===${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "supabase-storage|supabase-realtime|supabase-kong"

echo -e "\n${GREEN}=== STORAGE LOGS (Tail) ===${NC}"
docker logs --tail 20 supabase-storage

echo -e "\n${GREEN}=== REALTIME LOGS (Tail) ===${NC}"
docker logs --tail 20 supabase-realtime

echo -e "\n${GREEN}=== KONG ERROR LOGS ===${NC}"
docker logs --tail 20 supabase-kong 2>&1 | grep "error" || echo "No recent Kong errors"
