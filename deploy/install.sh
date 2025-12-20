#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer (Hyper-Robust Mode) ===${NC}"

# 1. Cleanup
rm -rf ../node_modules ../.next

# 2. Env
if [ -f .env ]; then source .env; fi
read -p "Enter NUC IP [${NUC_IP:-localhost}]: " NEW_IP
NEW_IP=${NEW_IP:-${NUC_IP:-localhost}}

# Write .env
cat <<EOF > .env
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9')}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NUC_IP=$NEW_IP
NEXT_PUBLIC_SUPABASE_URL=http://${NEW_IP}:8000
EOF

# Load keys if they were generated in a previous run but not in current shell
source .env

# 3. Startup
echo "Force refreshing containers..."
docker compose down --remove-orphans
docker compose up -d --build

echo "Waiting for stabilization (30s)..."
sleep 30

echo "--- Diagnostics ---"
docker ps

echo "Checking Rest Service Logs (if it crashed):"
docker logs supabase-rest | tail -n 5

echo "Checking Kong Connectivity (Internal):"
docker exec projektboard-app curl -s http://kong:8000/rest/v1/system_settings?select=key&key=eq.license_key || echo "❌ Kong failed"

echo -e "${GREEN}=== Done ===${NC}"
