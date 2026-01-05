#!/bin/bash

# ProjektBoard Full-Stack Diagnostic Tool
# Version 2.0 - Deep Network Deep Dive

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== ProjektBoard Deep Diagnostics [v2.0] ===${NC}\n"

# 1. Container Status Overview
echo -e "${BLUE}[1/6] Container Overview${NC}"
CONTAINERS=("supabase-db" "supabase-kong" "projektboard-app" "supabase-auth")
for c in "${CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^$c$"; then
        STATE=$(docker inspect -f '{{.State.Status}}' "$c")
        HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "N/A")
        COLOR=$GREEN
        [ "$STATE" != "running" ] && COLOR=$RED
        echo -e "  Container $c: ${COLOR}$STATE${NC} (Health: $HEALTH)"
    else
        echo -e "  Container $c: ${RED}MISSING${NC}"
    fi
done

# 2. Network Layout & Permissions
echo -e "\n${BLUE}[2/6] Network & Permissions Inspection${NC}"
ls -l ./volumes/api/kong.yml | sed 's/^/    /'
APP_NETS=$(docker container inspect projektboard-app -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
KONG_NETS=$(docker container inspect supabase-kong -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
echo -e "  App is on: ${YELLOW}$APP_NETS${NC}"
echo -e "  Kong is on: ${YELLOW}$KONG_NETS${NC}"

if [ "$APP_NETS" != "$KONG_NETS" ]; then
    echo -e "  ${RED}FATAL: Containers are on DIFFERENT networks!${NC}"
fi

# 3. DNS Configuration (Inside App)
echo -e "\n${BLUE}[3/6] Container DNS Inspection (App)${NC}"
echo -e "  /etc/hosts:"
docker exec projektboard-app cat /etc/hosts | grep -v '::1' | sed 's/^/    /'
echo -e "  /etc/resolv.conf:"
docker exec projektboard-app cat /etc/resolv.conf | sed 's/^/    /'

# 4. Low-Level Connectivity (App -> Kong)
echo -e "\n${BLUE}[4/6] Connectivity Probing${NC}"
echo -e "  A) Name Resolution (nslookup kong):"
docker exec projektboard-app nslookup kong 2>&1 | sed 's/^/    /'

echo -e "  B) Ping Test (Service Name):"
docker exec projektboard-app ping -c 1 kong 2>&1 | sed 's/^/    /'

# Try to discover IP manually
KONG_IP=$(docker container inspect supabase-kong -f "{{with index .NetworkSettings.Networks \"$APP_NETS\"}}{{.IPAddress}}{{end}}" 2>/dev/null)
if [ ! -z "$KONG_IP" ]; then
    echo -e "  C) Ping Test (IP $KONG_IP):"
    docker exec projektboard-app ping -c 1 "$KONG_IP" 2>&1 | sed 's/^/    /'
    
    echo -e "  D) Raw TCP connection ($KONG_IP:8000):"
    docker exec projektboard-app sh -c "timeout 2 cat < /dev/tcp/$KONG_IP/8000" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "    ${GREEN}TCP Port 8000 is REACHABLE via IP!${NC}"
    else
        echo -e "    ${RED}TCP Port 8000 is CLOSED via IP.${NC}"
    fi
fi

# 5. Upstream Log Audit
echo -e "\n${BLUE}[5/6] Upstream Log Audit (Last 15 lines)${NC}"

check_logs() {
    local name=$1
    local container=$2
    echo -e "  --- $name ($container) ---"
    if docker ps -a --format '{{.Names}}' | grep -q "^$container$"; then
        docker logs "$container" 2>&1 | tail -n 15 | sed 's/^/    /'
    else
        echo -e "    ${RED}Container Not Found${NC}"
    fi
}

check_logs "KONG" "supabase-kong"
check_logs "AUTH" "supabase-auth"
check_logs "REST" "supabase-rest"

# 6. Database & Service Check
echo -e "\n${BLUE}[6/6] Database Service Check${NC}"
if docker exec supabase-db psql -U postgres -t -c "SELECT 1" >/dev/null 2>&1; then
    echo -e "  PostgreSQL: ${GREEN}OK${NC}"
    
    # Check roles
    check_role() {
        echo -n "    Role '$1': "
        if docker exec supabase-db psql -U postgres -t -c "SELECT 1 FROM pg_roles WHERE rolname = '$1';" | grep -q 1; then echo -e "${GREEN}PRESENT${NC}"; else echo -e "${RED}MISSING${NC}"; fi
    }
    check_role "authenticator"
    check_role "supabase_auth_admin"
    check_role "anon"

    # Check schemas
    check_schema() {
        echo -n "    Schema '$1': "
        if docker exec supabase-db psql -U postgres -t -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = '$1';" | grep -q 1; then echo -e "${GREEN}PRESENT${NC}"; else echo -e "${RED}MISSING${NC}"; fi
    }
    check_schema "auth"
    check_schema "public"

    # Check for Superuser status (The Hammer)
    echo -n "    Role 'supabase_auth_admin' Superuser: "
    IS_SUPER=$(docker exec supabase-db psql -U postgres -t -c "SELECT rolsuper FROM pg_roles WHERE rolname = 'supabase_auth_admin';" | xargs)
    if [ "$IS_SUPER" == "t" ]; then echo -e "${GREEN}YES${NC}"; else echo -e "${RED}NO${NC}"; fi

    # Check ownership (Critical for migrations)
    echo -n "    Ownership of auth.users: "
    OWNER=$(docker exec supabase-db psql -U postgres -t -c "SELECT tableowner FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users';" | xargs)
    if [ "$OWNER" == "supabase_auth_admin" ]; then
        echo -e "${GREEN}$OWNER${NC}"
    else
        echo -e "${RED}$OWNER${NC} (Falscher Besitzer!)"
    fi

    echo -n "    Ownership of auth.uid(): "
    F_OWNER=$(docker exec supabase-db psql -U postgres -t -c "SELECT rolname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_roles r ON r.oid = p.proowner WHERE n.nspname = 'auth' AND p.proname = 'uid' LIMIT 1;" | xargs)
    if [ ! -z "$F_OWNER" ]; then
        if [ "$F_OWNER" == "supabase_auth_admin" ]; then
            echo -e "${GREEN}$F_OWNER${NC}"
        else
            echo -e "${RED}$F_OWNER${NC} (Falscher Besitzer!)"
        fi
    else
        echo -e "${RED}MISSING${NC} (Funktion nicht gefunden!)"
    fi

    # Check PostgREST reachability FROM Kong
    echo -n "  Kong -> Rest Internal Reachability: "
    if docker exec supabase-kong nc -zv rest 3000 2>&1 | grep -E "open|succeeded" > /dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi

    echo -n "  App -> Kong Internal Reachability: "
    # Try to fetch headers from Kong. If we get a 401, it means we reached the Rest service through Kong.
    WGET_OUT=$(docker exec projektboard-app wget -qSO- http://kong:8000/rest/v1/ 2>&1)
    if echo "$WGET_OUT" | grep -q "401"; then
        echo -e "${GREEN}OK (401 Unauthorized - Reachable!)${NC}"
    elif echo "$WGET_OUT" | grep -q "200"; then
        echo -e "${GREEN}OK (200 OK - Reachable!)${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo "$WGET_OUT" | sed 's/^/      /'
    fi
else
    echo -e "  PostgreSQL: ${RED}FAILED${NC}"
fi

echo -e "\n${BLUE}=== Diagnostics Complete ===${NC}"
