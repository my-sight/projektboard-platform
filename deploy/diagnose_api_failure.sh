#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== DIAGNOSING API FAILURE ===${NC}"

# 1. Check Container Status
echo -e "\n1. Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep supabase-

# 2. Check PostgREST Logs (Critical)
echo -e "\n2. PostgREST Logs (Last 20 lines):"
docker logs --tail 20 supabase-rest

# 3. Check Kong Logs (Gateway)
echo -e "\n3. Kong Logs (Last 20 lines):"
docker logs --tail 20 supabase-kong

# 4. Internal Connectivity Check (From App Container)
echo -e "\n4. Testing Connectivity from APP Container:"
echo "Testing access to http://kong:8000/rest/v1/ ..."
docker exec projektboard-app curl -v http://kong:8000/rest/v1/ -H "apikey: $ANON_KEY" || echo -e "${RED}Connectivity Check FAILED${NC}"
