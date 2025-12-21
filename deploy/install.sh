#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer (Final Routing Fix) ===${NC}"

# 1. Aggressive Cleanup
rm -rf ../node_modules ../.next 
rm -f ../.env

# 2. Env Handling
if [ -f .env ]; then
    AK=$(grep ANON_KEY .env | cut -d '=' -f2)
    if [[ "$AK" == *" "* ]] || [[ "$AK" != *"."*"."* ]] || [[ "$AK" == *"Pulling"* ]]; then
        echo -e "${RED}Clearing corrupted keys...${NC}"
        P_PASS=$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2)
        P_IP=$(grep NUC_IP .env | cut -d '=' -f2)
        rm .env
        echo "POSTGRES_PASSWORD=$P_PASS" > .env
        echo "NUC_IP=$P_IP" >> .env
    fi
fi
[ -f .env ] && source .env

read -p "Enter NUC IP [${NUC_IP:-kanban}]: " NEW_IP
NEW_IP=${NEW_IP:-${NUC_IP:-kanban}}

if [ -z "$JWT_SECRET" ]; then
    echo "Generating Security Keys..."
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 15 | tr -dc 'a-zA-Z0-9' | head -c 12)}
    JWT_SECRET=$(openssl rand -hex 32)
    docker pull node:20-slim > /dev/null 2>&1
    ANON_KEY=$(docker run --rm node:20-slim node -e "
        const crypto = require('crypto');
        const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const p = Buffer.from(JSON.stringify({role:'anon', iss:'supabase', iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
        const s = crypto.createHmac('sha256', '$JWT_SECRET').update(h+'.'+p).digest('base64url');
        process.stdout.write(h+'.'+p+'.'+s);
    " 2>/dev/null | tr -d '\r\n ')
    SERVICE_ROLE_KEY=$(docker run --rm node:20-slim node -e "
        const crypto = require('crypto');
        const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const p = Buffer.from(JSON.stringify({role:'service_role', iss:'supabase', iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
        const s = crypto.createHmac('sha256', '$JWT_SECRET').update(h+'.'+p).digest('base64url');
        process.stdout.write(h+'.'+p+'.'+s);
    " 2>/dev/null | tr -d '\r\n ')
fi

cat <<EOF > .env
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NUC_IP=${NEW_IP}
NEXT_PUBLIC_SUPABASE_URL=http://${NEW_IP}:8000
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
EOF
export $(grep -v '^#' .env | xargs)

# 3. Startup
echo "Starting services..."
docker compose down --remove-orphans
docker compose up -d --build --force-recreate

# 4. Deep DB Repair
echo "Waiting for Database..."
for i in {1..10}; do
    if docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 2
done

echo "Initializing Supabase Roles & Permissions..."
docker exec -i supabase-db psql -U postgres -d postgres -c "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator noinherit login password '${POSTGRES_PASSWORD}'; END IF;
END \$\$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.system_settings TO service_role, postgres, anon, authenticated;
" > /dev/null 2>&1

echo "Verification: Detected Tables in Schema 'public':"
docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"

echo "Reloading PostgREST Schema Cache..."
docker kill -s SIGUSR1 supabase-rest

echo "Waiting for Services to settle (20s)..."
sleep 20

echo "Final Network Check: App -> Gateway (via 127.0.0.1)..."
docker exec projektboard-app curl -v -s -o /dev/null http://127.0.0.1:8000/rest/v1/ 2>&1 | grep -E "Connected|Host|trying" || {
    echo -e "${RED}❌ App still cannot reach Kong!${NC}"
}

echo "--------------------------------------------------------"
echo "LIVE-DIAGNOSE: Bitte versuche JETZT die Lizenz zu speichern."
echo "--------------------------------------------------------"

# Tail logs
docker logs -f projektboard-app | grep --line-buffered -E "Save License Action|DETAILED ERROR|ENV_SOURCE|RAW_PROBE"
