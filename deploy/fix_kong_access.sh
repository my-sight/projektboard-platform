#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING KONG PERMISSIONS ===${NC}"

# 1. Fix Kong Configuration Permission (The Crash Cause)
echo "Fixing permissions on volumes/api/kong.yml..."
chmod 777 volumes/api/kong.yml
ls -l volumes/api/kong.yml

# 2. Restart Kong
echo "Restarting Kong..."
docker restart supabase-kong

# 3. Check Realtime (Downgrade was requested, ensure it is healthy)
echo -e "\nChecking Realtime (restarting to be safe)..."
docker restart supabase-realtime

# 4. Final Logs
echo -e "\nWatching Kong Logs (5s)..."
timeout 5s docker logs -f supabase-kong

echo -e "${GREEN}Permission Fix Applied.${NC}"
