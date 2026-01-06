#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${GREEN}${BOLD}=== DEEP DIAGNOSTIC TOOL v2 (Inspecting Specs) ===${NC}"

# 1. Inspect JWT Secrets (Using docker inspect to identify Env vars reliably)
echo -e "\n${BOLD}1. Checking JWT Secrets${NC}"
echo "---------------------------------------------------------"

HOST_JWT=$(grep "^JWT_SECRET=" .env 2>/dev/null | cut -d= -f2)
[ -z "$HOST_JWT" ] && HOST_JWT=$(grep "^JWT_SECRET=" deploy/.env 2>/dev/null | cut -d= -f2)

# Function to get env var from container inspect
get_docker_env() {
    local container=$1
    local var_name=$2
    docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $container 2>/dev/null | grep "^$var_name=" | cut -d= -f2
}

AUTH_JWT=$(get_docker_env supabase-auth GOTRUE_JWT_SECRET)
REST_JWT=$(get_docker_env supabase-rest PGRST_JWT_SECRET)
REALTIME_JWT=$(get_docker_env supabase-realtime JWT_SECRET)
APP_JWT=$(get_docker_env projektboard-app JWT_SECRET)

echo "Host (.env):       $HOST_JWT"
echo "Auth (GOTRUE_...): $AUTH_JWT"
echo "Rest (PGRST_...):  $REST_JWT"
echo "Realtime (JWT...): $REALTIME_JWT"
echo "App (JWT...):      $APP_JWT"

if [ "$HOST_JWT" == "$AUTH_JWT" ] && [ "$HOST_JWT" == "$REST_JWT" ] && [ "$HOST_JWT" == "$REALTIME_JWT" ]; then
    echo -e "${GREEN}✅ All Service JWTs match Host.${NC}"
else
    echo -e "${RED}❌ JWT MISMATCH DETECTED!${NC}"
    echo "This usually means 'docker compose' didn't pick up the new .env file."
    echo "Try: docker compose down && bash install.sh"
    exit 1
fi

# 2. Check APP_NAME in Realtime (Critical for crash)
echo -e "\n${BOLD}2. Checking Realtime Config${NC}"
REALTIME_APP_NAME=$(get_docker_env supabase-realtime APP_NAME)
if [ "$REALTIME_APP_NAME" == "realtime" ]; then
    echo -e "${GREEN}✅ APP_NAME found in Realtime container.${NC}"
else
    echo -e "${RED}❌ APP_NAME MISSING in Realtime container! ($REALTIME_APP_NAME)${NC}"
    echo "Container is running old config. Run 'docker compose down' first."
fi

# 3. Check App Client URL
echo -e "\n${BOLD}3. Checking Next.js Client Environment${NC}"
APP_NEXT_URL=$(get_docker_env projektboard-app NEXT_PUBLIC_SUPABASE_URL)
echo "Next.js Target URL: $APP_NEXT_URL"

# 4. Logs Snapshot
echo -e "\n${BOLD}4. Realtime Crash Check (Last 5 lines)${NC}"
docker logs supabase-realtime --tail 5 2>&1

echo -e "\n${GREEN}Diagnostic Complete.${NC}"
