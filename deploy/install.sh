#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer ===${NC}"

# 0. Pfad-unabhängigkeit sicherstellen (WICHTIG!)
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"
echo "Arbeitsverzeichnis: $DEPLOY_DIR"

# 1. Berechtigungen sicherstellen (WICHTIG für Kong/Docker)
echo "Sichere Dateiberechtigungen für Volumes..."
find ./volumes -maxdepth 2 -user $(whoami) -exec chmod 755 {} + 2>/dev/null || true
chmod 644 ./volumes/api/kong.yml 2>/dev/null || true

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
if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "Secrets missing or incomplete. Generating new secrets..."
    [ -z "$POSTGRES_PASSWORD" ] && POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
    [ -z "$JWT_SECRET" ] && JWT_SECRET=$(openssl rand -hex 32)
    
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

# Write updated .env
cat <<EOF > .env
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NUC_IP=$NEW_IP
NEXT_PUBLIC_SUPABASE_URL=http://${NEW_IP}:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
GOTRUE_SITE_URL=http://${NEW_IP}:3000
EOF

export POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY NEW_IP
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
chmod -R 777 volumes/

docker compose --env-file .env build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="http://${NEW_IP}:8000" \
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
  
  -- Mandatory USAGE on Extensions
  GRANT USAGE ON SCHEMA extensions TO anon, authenticated, authenticator;
  GRANT USAGE ON SCHEMA public, auth TO authenticator;
  
  -- NUCLEAR PATCH for Browser Access
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  
  -- Disable RLS on critical tables for stability
  ALTER TABLE IF EXISTS public.system_settings DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.departments DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.kanban_boards DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.kanban_cards DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.board_members DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.kanban_board_settings DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS public.board_card_statuses DISABLE ROW LEVEL SECURITY;

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

  -- 1. Remove existing to ensure clean state (API will recreate it)
  DELETE FROM auth.users WHERE email = 'michael@mysight.net';
  DELETE FROM public.profiles WHERE email = 'michael@mysight.net';

EOF


# Start services
echo "Starting application services..."
docker compose --env-file .env up -d --force-recreate

# Wait for Auth Service to be ready
echo "Waiting for Auth Service to be accessible..."
sleep 10

# API-Based User Seeding (Definitive Solution for Hash Compatibility)
echo "Creating Superuser via GoTrue API..."
RESPONSE=$(docker exec projektboard-app curl -s -X POST 'http://kong:8000/auth/v1/admin/users' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "michael@mysight.net",
    "password": "Serum4x!",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "Michael",
      "role": "admin",
      "company": "MySight"
    }
  }')

echo "User Creation Response: $RESPONSE"

# Sync Profile Role after API creation
docker exec supabase-db psql -U postgres -d postgres -c "
  INSERT INTO public.profiles (id, email, full_name, role, company, is_active)
  SELECT id, email, 'Michael', 'admin', 'MySight', true
  FROM auth.users WHERE email = 'michael@mysight.net'
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;"

# Final Verification
LICENSE_TOKEN="eyJleHBpcnkiOiIyMDI2LTEyLTMxIiwiY3VzdG9tZXIiOiJGaXJtZW5uYW1lIiwibWF4VXNlcnMiOjUwLCJjcmVhdGVkIjoiMjAyNS0xMi0yOVQxMzozMjozOS42NTNaIn0=.6AIcBmhbL0c+N/Ju4uCXWo4mK4UYIwD9lr3W8BEpp78O7ETlhqSoFoYbPUJklmKSBxSJbBW5Bvdk2BxQn7BACA=="
docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$LICENSE_TOKEN\"}'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"

echo -e "${GREEN}=== Installation Complete ===${NC}"
echo "Check: http://${NEW_IP}:3000"
echo "Login: michael@mysight.net / Serum4x!"
