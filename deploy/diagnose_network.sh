#!/bin/bash
# Network Diagnostic Script for the Projektboard App Container

echo "--- DOCKER NETWORK DIAGNOSTICS ---"
echo "Container: projektboard-app"
echo "Target: kong:8000"
echo ""

# 1. Check if the internal URL is set
echo "[1] Checking Environment Variables:"
docker exec projektboard-app env | grep -E "INTERNAL_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL"
echo ""

# 2. Test DNS resolution
echo "[2] Testing DNS Resolution (nslookup):"
docker exec projektboard-app nslookup kong || echo "nslookup failed"
echo ""

# 3. Test TCP connectivity (wget)
echo "[3] Testing TCP Connectivity (wget):"
docker exec projektboard-app wget -qO- --spider http://kong:8000/rest/v1/system_settings || echo "Connection to kong:8000 failed"
echo ""

# 4. Test direct connectivity to PostgREST
echo "[4] Testing direct connectivity to rest:3000:"
docker exec projektboard-app wget -qO- --spider http://rest:3000 || echo "Connection to rest:3000 failed"
echo ""

# 5. Check app logs for Supabase errors
echo "[5] Recent Application Logs:"
docker logs --tail 20 projektboard-app
echo ""

echo "--- DIAGNOSTICS COMPLETE ---"
