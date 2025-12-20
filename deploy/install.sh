
#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer ===${NC}"

# 1. Check Requirements
echo "Checking requirements..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker Desktop or Docker Engine first."
    exit 1
fi

# Check for Buildx (required for modern Docker Compose Bake)
if ! docker buildx version &> /dev/null; then
    echo "Docker Buildx not found. Attempting to install plugin..."
    sudo apt update && sudo apt install docker-buildx-plugin -y
fi

# 2. Cleanup Host Artifacts (Prevents Mac Symlink Errors)
echo "Cleaning up host artifacts (node_modules, .next)..."
rm -rf ../node_modules ../.next

# 2. Setup Environment
echo "Configuring environment..."

# Load existing values if they exist
if [ -f .env ]; then
    echo "Existing configuration found."
    source .env
fi

# Always prompt for IP Address/Hostname
echo "----------------------------------------------------------------"
echo "IMPORTANT: For the app to work from other computers (e.g. your Mac),"
echo "you must provide the IP address or Hostname of this NUC."
echo "Pro-Tip: Use the hostname (e.g. 'projektboard.local') for portability!"
echo "----------------------------------------------------------------"
read -p "Enter NUC IP or Hostname [${NUC_IP:-localhost}]: " NEW_IP
NEW_IP=${NEW_IP:-${NUC_IP:-localhost}}
echo "Configuring for: $NEW_IP"

if [ ! -f .env ] || [ "$NEW_IP" != "$NUC_IP" ]; then
    echo "Updating configuration..."
    
    # Generate random secrets if not present
    if [ -z "$POSTGRES_PASSWORD" ]; then
        DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
        JWT_SECRET=$(openssl rand -hex 32)
        
        echo "Using Docker to generate JWTs..."
        JWT_GEN_SCRIPT="
        const crypto = require('crypto');
        const secret = '$JWT_SECRET';
        const sign = (role) => {
            const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            const payload = Buffer.from(JSON.stringify({role: role, iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+315360000})).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            const signature = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            return header + '.' + payload + '.' + signature;
        };
        console.log('ANON_KEY=' + sign('anon'));
        console.log('SERVICE_ROLE_KEY=' + sign('service_role'));
        "
        KEYS=$(docker run --rm node:18-alpine node -e "$JWT_GEN_SCRIPT")
        ANON_KEY=$(echo "$KEYS" | grep ANON_KEY | cut -d= -f2)
        SERVICE_ROLE_KEY=$(echo "$KEYS" | grep SERVICE_ROLE_KEY | cut -d= -f2)
    else
        DB_PASS=$POSTGRES_PASSWORD
        # JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY are already loaded via source
    fi
    
    # Write to .env
    cat <<EOF > .env
POSTGRES_PASSWORD=$DB_PASS
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NUC_IP=$NEW_IP
NEXT_PUBLIC_SUPABASE_URL=http://${NEW_IP}:8000
EOF
    
    echo "Configuration updated in .env"
else
    echo "No changes needed."
fi

# 3. Setup Database Schema
echo "Preparing database initialization..."
mkdir -p volumes/db/init
if [ -f init_schema.sql ]; then
    cp init_schema.sql volumes/db/init/00-schema.sql
    echo "Schema copied."
else
    echo -e "${RED}Warning: init_schema.sql not found. Database will be empty.${NC}"
fi

if [ -f seed_superuser.sql ]; then
    cp seed_superuser.sql volumes/db/init/99-seed-superuser.sql
    echo "Superuser seed copied."
fi

# 4. Build and Start
echo "Building and starting services (Force Refresh)..."

# Export variables for docker compose
set -a
source .env
set +a

# Use --no-cache to ENSURE the new code (with Networking fixes) is compiled!
docker compose build --no-cache
docker compose up -d


echo "Waiting for services to stabilize (Postgres, Kong, App)..."
sleep 10

# Final check: Internal connectivity
if curl -s http://localhost:8000/rest/v1/ > /dev/null; then
    echo -e "${GREEN}Database API (Kong/PostgREST) is reachable.${NC}"
else
    echo -e "${RED}Warning: Database API is not responding (503?). It might still be starting up.${NC}"
fi

echo -e "${GREEN}=== Installation Complete ===${NC}"

echo "----------------------------------------------------------------"
echo "App should be running at: http://${NEW_IP}:3000"
echo "License activation should work now via Server Actions."
echo "If you see 'Name Resolution Failed', please use the IP address"
echo "instead of a hostname during installation."
echo "----------------------------------------------------------------"
