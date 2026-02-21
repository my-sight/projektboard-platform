#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer ===${NC}"

# Parse Arguments
MODE="dev"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --prod) MODE="prod" ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

echo -e "Installation Mode: ${YELLOW}$MODE${NC}"

# Pre-flight Check (Prod Only)
if [ "$MODE" == "prod" ]; then
    echo "Running Production Pre-flight Checks..."
    if [ ! -f "/etc/nginx/ssl/server.crt" ] || [ ! -f "/etc/nginx/ssl/server.key" ]; then
        echo -e "${RED}CRITICAL ERROR: SSL Certificates missing in /etc/nginx/ssl/${NC}"
        echo "Production mode requires valid certificates."
        exit 1
    fi
    echo -e "${GREEN}SSL Certificates found.${NC}"
fi

# 0. Pfad-unabhängigkeit sicherstellen (WICHTIG!)
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"
echo "Arbeitsverzeichnis: $DEPLOY_DIR"


# 1. Persistence & Permissions
# Check for RAID Mount (Prod Only)
if [ "$MODE" == "prod" ] && [ -d "/mnt/raid/data" ]; then
    echo "RAID array detected at /mnt/raid/data"
    if [ ! -L "./volumes" ]; then
        if [ -d "./volumes" ]; then
            echo "WARNING: Local ./volumes exists. Moving to ./volumes.bak..."
            mv ./volumes ./volumes.bak
        fi
        echo "Symlinking volumes -> /mnt/raid/data"
        ln -s /mnt/raid/data ./volumes
    fi
fi

# 1. Berechtigungen sicherstellen (WICHTIG für Kong/Docker/Storage)
echo "Sichere Dateiberechtigungen für Volumes..."
# Explicitly create deep storage structure to prevent 500 Errors
mkdir -p ./volumes/storage/stub/branding
mkdir -p ./volumes/storage/stub/avatars
mkdir -p ./volumes/storage/stub/kanban-thumbnails
mkdir -p ./volumes/storage/stub/kanban-thumbnails

# Restrictive Permissions for Storage (avoid "Operation not permitted" securely)
# We map the ownership to UID 1000 (often used by node/app containers)
sudo chown -R 1000:1000 ./volumes/storage
sudo chmod -R 755 ./volumes/storage
# General permissions
sudo find ./volumes -maxdepth 2 -user $(whoami) -exec chmod 755 {} + 2>/dev/null || true
sudo chmod 644 ./volumes/api/kong.yml 2>/dev/null || true

# 2. Setup Environment
echo "Configuring environment..."

# Cleanup "Ghost" env files that interfere with build/docker
echo "Cleaning up conflicting environment files..."
[ -f "../.env" ] && rm "../.env" && echo "Removed ../.env"
[ -f "../.env.local" ] && rm "../.env.local" && echo "Removed ../.env.local"
[ -f ".env.local" ] && rm ".env.local" && echo "Removed .env.local"

# Load existing values if they exist
if [ -f .env ]; then
    echo "Existing configuration found."
    sed -i 's/\r//' .env || true
    source .env
fi

# Always prompt for IP Address/Hostname
echo "----------------------------------------------------------------"
echo "IMPORTANT: For the app to work from other computers (e.g. your Mac),"
echo "you must provide the IP address or Hostname of this NUC."
echo "Pro-Tip: Use hostnames (e.g. 'kanban.local') for easiest access."
echo "----------------------------------------------------------------"
read -p "Enter NUC IP or Hostname [${NUC_IP:-localhost}]: " NEW_IP
NEW_IP=${NEW_IP:-${NUC_IP:-localhost}}
echo "Configuring for: $NEW_IP"

# Force secret generation if critical keys are missing
if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ] || [ -z "$ENCRYPTION_KEY" ]; then
    echo "Secrets missing or incomplete. Generating new secrets..."
    [ -z "$POSTGRES_PASSWORD" ] && POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
    [ -z "$JWT_SECRET" ] && JWT_SECRET=$(openssl rand -hex 32)
    # Generate Encryption Key for Backups (32 bytes hex)
    [ -z "$ENCRYPTION_KEY" ] && ENCRYPTION_KEY=$(openssl rand -hex 32)
    
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
fi

# Determine Protocols based on Mode
if [ "$MODE" == "prod" ]; then
    PROTOCOL="https"
    SITE_URL_BASE="https://${NEW_IP}"
    
    # ----------------------------------------------------
    # PROD MODE: FORCE HTTPS (Unified Proxy on Port 443)
    # ----------------------------------------------------
    echo -e "${GREEN}Detecting PROD Mode: Enforcing HTTPS...${NC}"
    SUPABASE_URL_VAL="https://${NEW_IP}"
    SITE_URL_VAL="https://${NEW_IP}"
    
else
    # ----------------------------------------------------
    # DEV MODE: DIRECT HTTP (Ports 8000/3000)
    # ----------------------------------------------------
    # DEV MODE: DIRECT HTTP (Ports 8000/3000) -> NOW PROXIED via 8080
    echo -e "${YELLOW}Detecting DEV Mode: Using Proxy Port 8080...${NC}"
    PROTOCOL="http"
    SUPABASE_URL_VAL="http://${NEW_IP}:8080"
    SITE_URL_VAL="http://${NEW_IP}:8080"
fi

echo "----------------------------------------------------"
echo "DEBUG: BUILD ARGUMENTS"
echo "MODE: $MODE"
echo "NEW_IP: $NEW_IP"
echo "SUPABASE_URL_VAL: $SUPABASE_URL_VAL"
echo "SITE_URL_VAL: $SITE_URL_VAL"
echo "----------------------------------------------------"
read -p "Press Enter if these match your expectation..."


# Write updated .env
cat <<EOF > .env
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NUC_IP=$NEW_IP
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_VAL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
GOTRUE_SITE_URL=$SITE_URL_VAL
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF

export POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY NEW_IP ENCRYPTION_KEY
echo "Configuration updated in .env"

# 3. Build Check
if [ ! -f "../Dockerfile" ] || [ ! -d "../src" ] || [ ! -d "../supabase" ]; then
    echo -e "${RED}Error: Source files missing in parent directory.${NC}"
    exit 1
fi

# Safety Check: Ensure docker-compose.yml has the Realtime Fix
if ! grep -q "APP_NAME" docker-compose.yml; then
    echo -e "${RED}Error: Your docker-compose.yml is outdated!${NC}"
    echo "It is missing 'APP_NAME' for the Realtime service."
    echo "Please run the rsync command from your Mac again to update the files on the NUC."
    exit 1
fi

# 4. Setup Database Schema
echo "Preparing database initialization..."
mkdir -p volumes/db/init
bash generate_init_sql.sh
cp init_schema.sql volumes/db/init/00-schema.sql

# 5. Build and Start
echo "Building and starting services..."
echo "Building and starting services..."
sudo chmod -R 777 volumes/

docker compose --env-file .env build --no-cache \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL_VAL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"

# Start DB for patching (Service name is 'db')
echo "Starting Database for patching..."
docker compose --env-file .env up -d db
RETRIES=30
until docker exec supabase-db psql -U postgres -d postgres -c "SELECT 1" &> /dev/null || [ $RETRIES -eq 0 ]; do
  echo "Waiting for DB... ($RETRIES left)"
  sleep 2
  RETRIES=$((RETRIES-1))
done

# Nuclear Permission Patch & Absolute Superuser Reset
docker exec -i supabase-db psql -U postgres -d postgres <<EOF
  ALTER ROLE supabase_auth_admin WITH SUPERUSER;
  ALTER ROLE supabase_storage_admin WITH SUPERUSER;
  GRANT postgres TO supabase_auth_admin, supabase_storage_admin;
  ALTER ROLE service_role BYPASSRLS; -- FIX: Ensure Service Key bypasses RLS
  
  -- Mandatory USAGE on Extensions
  GRANT USAGE ON SCHEMA extensions TO anon, authenticated, authenticator;
  GRANT USAGE ON SCHEMA public, auth TO authenticator;
  
  -- SANE PATCH for Browser Access with RLS intact
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
  
  -- Grant minimal selection/modification rights to authenticated users, but DO NOT bypass RLS
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
  
  -- Create Storage Buckets
  INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (name) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (name) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('kanban-thumbnails', 'kanban-thumbnails', true) ON CONFLICT (name) DO NOTHING;

  -- Grant Storage Policies
  CREATE POLICY "Allow All Storage Access" ON storage.objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Allow Public Read" ON storage.objects FOR SELECT TO anon USING (true);

  -- Restore Auth Functions
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid; \$\$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '')::text; \$\$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb; \$\$;

  -- 1. DO NOT DELETE admin if exists (preserve Audit Logs integrity)
  -- Instead, we will update the password later via SQL if the user exists.

EOF


# Start services
echo "Starting application services..."
docker compose --env-file .env up -d --force-recreate

# Wait for Auth Service to be ready
echo "Waiting for Auth Service to be accessible..."
sleep 10

# API-Based User Seeding (Definitive Solution for Hash Compatibility)
# 5b. Generate/Set Admin Password
# If ADMIN_PASSWORD env is set (e.g. from CI), use it. Otherwise generate one.
if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9')
fi

echo "Ensuring Superuser exists or updating password..."

# SQL-Based Update (Most reliable way to force password update without knowing previous state)
# We generate the bcrypt hash via pgcrypto (must be enabled) or we rely on the API for creation only.
# Since we cannot easily hash in bash, we use a hybrid approach:
# 1. Try to Create (API) -> fails 422 if exists
# 2. Force Update (SQL) -> sets password directly using Supabase internal auth schema functions or pgcrypto

# Try Create (API) - Handles "New Install" case
docker exec projektboard-app wget -qO- \
  --header="Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header="Content-Type: application/json" \
  --post-data="{\"email\": \"michael@mysight.net\", \"password\": \"$ADMIN_PASSWORD\", \"email_confirm\": true, \"user_metadata\": {\"full_name\": \"Michael\", \"role\": \"admin\", \"company\": \"MySight\"}}" \
  http://kong:8000/auth/v1/admin/users >/dev/null 2>&1

# Force Update Password (SQL) - Handles "Existing Install" case
# Note: GoTrue uses bcrypt. We need pgcrypto extension.
docker exec supabase-db psql -U postgres -d postgres -c "
  CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
  UPDATE auth.users 
  SET encrypted_password = extensions.crypt('$ADMIN_PASSWORD', extensions.gen_salt('bf')) 
  WHERE email = 'michael@mysight.net';
"

# Sync Profile Role after creation/update
docker exec supabase-db psql -U postgres -d postgres -c "
  INSERT INTO public.profiles (id, email, full_name, role, company, is_active)
  SELECT id, email, 'Michael', 'admin', 'MySight', true
  FROM auth.users WHERE email = 'michael@mysight.net'
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;"

# Final Verification
# Use LICENSE_TOKEN from env or fallback safely handled here via variables
if [ -z "${LICENSE_TOKEN}" ]; then
  echo "⚠️ WARNING: LICENSE_TOKEN environment variable is not set."
  echo "The system will be installed with a placeholder license token."
fi
SAFE_LICENSE_TOKEN="${LICENSE_TOKEN:-REPLACE_ME_LICENSE_TOKEN}"

docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$SAFE_LICENSE_TOKEN\"}'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"

echo -e "${GREEN}=== Installation Complete ===${NC}"
echo "Check: ${SITE_URL_VAL}"
echo "Login: michael@mysight.net / $ADMIN_PASSWORD"

# 6. Appliance Configuration (Nginx)
echo "----------------------------------------------------------------"
echo "Configuring Nginx Host Proxy..."

NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/projektboard"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/projektboard"

# Helper to link config
setup_nginx() {
    local CONFIG_FILE=$1
    echo "Linking Nginx Config: $CONFIG_FILE"
    
    # Check if we have sudo/root access to modify Nginx
    if [ -w "/etc/nginx/sites-enabled" ] || sudo -n true 2>/dev/null; then
        
        # Auto-Install Nginx if missing (Prod Only)
        if ! command -v nginx &> /dev/null; then
             echo "Nginx not found. Installing..."
             sudo apt-get update && sudo apt-get install -y nginx
        fi

        # Remove old link & default site
        sudo rm -f "$NGINX_SITE_ENABLED" || true
        sudo rm -f "/etc/nginx/sites-enabled/default" || true

        
        # Link new config (Use absolute path to deploy/nginx)
        ABS_CONFIG_PATH="$DEPLOY_DIR/nginx/$CONFIG_FILE"
        sudo ln -s "$ABS_CONFIG_PATH" "$NGINX_SITE_ENABLED"
        
        # Test and Reload
        if sudo nginx -t; then
            sudo systemctl reload nginx
            echo -e "${GREEN}Nginx reloaded successfully.${NC}"
            
            if [ "$MODE" == "prod" ]; then
                echo -e "${GREEN}Appliance is live at https://${NEW_IP}${NC}"
            else
                echo -e "${GREEN}Dev Interface at http://${NEW_IP}:8080${NC}"
            fi
        else
            echo -e "${RED}Nginx configuration failed! Check logs.${NC}"
        fi
    else
        echo -e "${YELLOW}WARNING: No root access to configure Nginx automatically.${NC}"
        echo "Please manually link $DEPLOY_DIR/nginx/$CONFIG_FILE to /etc/nginx/sites-enabled/projektboard"
    fi
}

if [ "$MODE" == "prod" ]; then
    setup_nginx "landing.prod.conf"
else
    setup_nginx "landing.local.conf"
fi

# 7. Automatisierung (Cron Backup - Prod Only)
if [ "$MODE" == "prod" ]; then
    echo "Configuring Backup Cronjob..."
    CRON_CMD="0 3 * * * $DEPLOY_DIR/backup-appliance.sh >> $DEPLOY_DIR/backups/backup.log 2>&1"
    
    # Check if job already exists
    (crontab -l 2>/dev/null | grep -F "backup-appliance.sh") && echo "Cronjob already exists." || {
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo -e "${GREEN}Cronjob added: $CRON_CMD${NC}"
    }
else
    echo "Skipping Cronjob (Dev Mode)"
fi

# 8. System Hardening (One-Time)
echo "----------------------------------------------------------------"
echo "Applying System Hardening (Firewall)..."
if [ -f "./harden_system.sh" ]; then
    sudo bash ./harden_system.sh
else
    echo "Warning: harden_system.sh not found."
fi
