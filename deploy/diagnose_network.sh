#!/bin/bash
# Network & Auth Diagnostic Script v2.1

echo "--- DOCKER NETWORK & AUTH DIAGNOSTICS ---"
echo "Container: projektboard-app"
echo "Target: kong:8000"
echo ""

# 1. Check Environment Variables
echo "[1] Environment Variables:"
docker exec projektboard-app env | grep -E "INTERNAL_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL"
ANON_KEY=$(docker exec projektboard-app env | grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" | cut -d= -f2)
if [ -z "$ANON_KEY" ]; then
    echo "ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in the app container!"
else
    echo "ANON_KEY found (starts with: ${ANON_KEY:0:10}...)"
fi
echo ""

# 2. Test DNS resolution
echo "[2] Testing DNS Resolution (nslookup):"
docker exec projektboard-app nslookup kong || echo "nslookup failed"
echo ""

# 3. Test API Connectivity with ANON_KEY (The 401 Debugger)
echo "[3] Testing API with ANON_KEY (curl to system_settings):"
# Using curl inside the container to see the actual response code
docker exec projektboard-app curl -i -s -X GET \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "http://kong:8000/rest/v1/system_settings?select=*" | head -n 15

echo ""

# 4. Check App Logs for URL Initialization
echo "[4] Application Startup Log:"
docker logs projektboard-app | grep "SupabaseConfig" | tail -n 5
echo ""

echo "--- DIAGNOSTICS COMPLETE ---"
