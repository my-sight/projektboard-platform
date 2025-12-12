
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

# 2. Setup Environment
echo "Configuring environment..."
if [ ! -f .env ]; then
    echo "Generating secure secrets..."
    
    # Prompt for IP Address
    echo "----------------------------------------------------------------"
    echo "IMPORTANT: For the app to work from other computers (e.g. your Mac),"
    echo "you must provide the IP address of this NUC."
    echo "If you only use it locally on the NUC, keep 'localhost'."
    echo "----------------------------------------------------------------"
    read -p "Enter NUC IP Address [localhost]: " NUC_IP
    NUC_IP=${NUC_IP:-localhost}
    echo "Configuring for IP: $NUC_IP"
    
    # Generate random secrets
    DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
    JWT_SECRET=$(openssl rand -hex 32)
    ANON_KEY=$(openssl rand -hex 32) # In a real scenario, this should be a signed JWT. For now, we simulate.
    # actually, ANON_KEY and SERVICE_ROLE_KEY must be valid JWTs signed with JWT_SECRET.
    # This is tricky in bash without dependencies. 
    # Option: Use a pre-generated pair or use a simple node script to generate them if node is available?
    # Or, rely on Supabase to generate them on first run? 
    # Supabase self-hosting usually requires us to provide them.
    
    # Simpler approach: Use a fixed known secret for the "Appliance" or use a python/node one-liner if available.
    # Since we have the `scripts/generate_keys.js`, we assume Node is on the machine?
    # WAIT. The Dockerfile builds the app. The host might NOT have Node.
    # The Host only has Docker.
    
    # We will use a simplified approach: The user (Michael) runs this script to PREPARE the deployment folder?
    # Or this script runs ON the target machine?
    # "plug-and-play" implies the target machine runs this.
    
    # To properly generate valid JWTs (Anon/Service) signed with the JWT_SECRET, we need a tool.
    # docker-compose can use an init container?
    # Or we just generate them once NOW and hardcode them into the install script?
    # NO, that's insecure if we distribute it.
    
    # BETTER: We include a tiny helpers script or use a docker container to generate them.
    # OR: We just assume the user updates them, or we provide a node script in the repo.
    
    # Let's try to generate them using a temporary docker container with node?
    # That is robust.
    
    echo "Using Docker to generate JWTs..."
    # We'll use the node alpine image to run a quick script
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
    
    echo "POSTGRES_PASSWORD=$DB_PASS" > .env
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo "$KEYS" >> .env
    echo "NEXT_PUBLIC_SUPABASE_URL=http://${NUC_IP}:8000" >> .env
    
    echo "Secrets generated in .env"
else
    echo ".env already exists. Skipping generation."
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

# 4. Build and Start
echo "Building and starting services..."
docker compose build
docker compose up -d

echo -e "${GREEN}=== Installation Complete ===${NC}"
echo "App should be running at: http://localhost:3000"
echo "Supabase Studio: http://localhost:3001"
