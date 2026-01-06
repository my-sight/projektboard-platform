#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Diagnose 503 Service Unavailable ===${NC}"

# 1. Check Container Status
echo "Checking Container Status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Check Realtime Logs (Is it still crashing?)
echo -e "\n${GREEN}=== Realtime Logs (Last 10 lines) ===${NC}"
docker logs supabase-realtime --tail 10

# 3. Check Kong Logs (Is it routing?)
echo -e "\n${GREEN}=== Kong Logs (Last 10 lines) ===${NC}"
docker logs supabase-kong --tail 10

# 4. Check App Logs (Is Next.js happy?)
echo -e "\n${GREEN}=== App Logs (Last 10 lines) ===${NC}"
docker logs projektboard-app --tail 10

# 5. Network Test from INSIDE the network
echo -e "\n${GREEN}=== Network Connectivity Test ===${NC}"
echo "Testing connection from Kong to Realtime..."
docker exec supabase-kong curl -I -v http://realtime:4000/health 2>&1 | grep "HTTP/"

echo "Testing connection from App to Supabase..."
docker exec projektboard-app curl -s -o /dev/null -w "%{http_code}" http://kong:8000/rest/v1/ 2>&1 || echo "Failed"

echo "Diagnose Complete."
