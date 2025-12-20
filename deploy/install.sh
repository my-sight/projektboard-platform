#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer (Stabilization Fix) ===${NC}"

# 1. Cleanup
rm -rf ../node_modules ../.next

# 2. Env Handling
EXISTING_PASS=""
if [ -f .env ]; then
    # Preserve existing password if present
    EXISTING_PASS=$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2)
    source .env
fi

# Check if keys are malformed
if [[ "$ANON_KEY" == *" "* ]] || [[ "$ANON_KEY" == *"Pulling"* ]] || [ -z "$ANON_KEY" ]; then
    echo -e "${RED}Detected malformed or missing keys. Regenerating...${NC}"
    unset JWT_SECRET
fi

# Ensure IP is set
read -p "Enter NUC IP [${NUC_IP:-kanban}]: " NEW_IP
NEW_IP=${NEW_IP:-${NUC_IP:-kanban}}

# Keys Generation (Safe Mode)
if [ -z "$JWT_SECRET" ]; then
    echo "Generating Secure Keys..."
    # Preserve old password if we have it, otherwise generate new
    POSTGRES_PASSWORD=${EXISTING_PASS:-$(openssl rand -base64 15 | tr -dc 'a-zA-Z0-9' | head -c 12)}
    JWT_SECRET=$(openssl rand -hex 32)
    
    docker pull node:20-slim > /dev/null 2>&1
    
    ANON_KEY=$(docker run --rm node:20-slim node -e "
        const crypto = require('crypto');
        const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const p = Buffer.from(JSON.stringify({role:'anon', iss:'supabase', iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
        const s = crypto.createHmac('sha256', '$JWT_SECRET').update(h+'.'+p).digest('base64url');
        process.stdout.write(h+'.'+p+'.'+s);
    ")
    
    SERVICE_ROLE_KEY=$(docker run --rm node:20-slim node -e "
        const crypto = require('crypto');
        const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const p = Buffer.from(JSON.stringify({role:'service_role', iss:'supabase', iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
        const s = crypto.createHmac('sha256', '$JWT_SECRET').update(h+'.'+p).digest('base64url');
        process.stdout.write(h+'.'+p+'.'+s);
    ")
fi

# Final Password check
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$EXISTING_PASS}

# Write .env (overwrites/creates)
cat <<EOF > .env
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NUC_IP=${NEW_IP}
NEXT_PUBLIC_SUPABASE_URL=http://${NEW_IP}:8000
EOF

# Load keys for this session
export $(grep -v '^#' .env | xargs)

# 3. Startup
echo "Force refreshing containers..."
docker compose down --remove-orphans
docker compose up -d --build

echo "Waiting for stabilization (30s)..."
sleep 30

echo "--- Diagnostics ---"
docker ps

echo "Checking Auth Service Logs (if restarting):"
docker logs supabase-auth | tail -n 5

echo "Connectivity Check (Internal):"
docker exec projektboard-app curl -s -f http://kong:8000/rest/v1/system_settings?select=key&key=eq.license_key || echo "❌ Kong failed"

echo -e "${GREEN}=== Done ===${NC}"
