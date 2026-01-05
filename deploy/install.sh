
#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer ===${NC}"

# 1. Berechtigungen sicherstellen (WICHTIG für Kong/Docker)
echo "Sichere Dateiberechtigungen für Volumes..."
# Nur Ordner anfassen, die uns gehören, um Fehler zu vermeiden
find ./volumes -maxdepth 2 -user $(whoami) -exec chmod 755 {} + 2>/dev/null || true
chmod 644 ./volumes/api/kong.yml 2>/dev/null || true

# 2. Bestehende Daten prüfen
echo "Checking requirements..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker Desktop or Docker Engine first."
    exit 1
fi

# 2. Setup Environment
echo "Configuring environment..."

# Cleanup potential conflicting .env.local files
if [ -f .env.local ]; then rm .env.local; fi
if [ -f ../.env.local ]; then rm ../.env.local; fi

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

# Generate consolidated schema
echo "Generating init_schema.sql..."
if [ -f generate_init_sql.sh ]; then
    bash generate_init_sql.sh
else
    echo -e "${RED}Error: generate_init_sql.sh not found.${NC}"
    exit 1
fi

if [ -f init_schema.sql ]; then
    cp init_schema.sql volumes/db/init/00-schema.sql
    echo "Schema and Seed data copied to docker init."
else
    echo -e "${RED}Error: init_schema.sql creation failed.${NC}"
    exit 1
fi

# Superuser is now seeded via init_schema.sql
# if [ -f seed_superuser.sql ]; then ...

# 4. Build and Start
echo "Ensuring volume permissions..."
# Give containers read/write access to volumes. 
# On NUC, rsync might preserve Mac user IDs which don't exist in the Linux container.
chmod -R 777 volumes/
# Check for required source files (since we are building from context ..)
if [ ! -f "../Dockerfile" ] || [ ! -d "../src" ]; then
    echo -e "${RED}Error: Source files missing in parent directory.${NC}"
    echo -e "Make sure you copied the entire 'projektboard-platform' folder to the NUC,"
    echo -e "not just the 'deploy' sub-folder."
    exit 1
fi

# Check for existing DB data that blocks automatic init
DB_DATA_DIR="./volumes/db/data"
if [ -d "$DB_DATA_DIR" ] && [ "$(ls -A $DB_DATA_DIR 2>/dev/null)" ]; then
    echo -e "${YELLOW}Warning: Existing database data found in $DB_DATA_DIR.${NC}"
    echo -e "Docker's automatic initialization (/docker-entrypoint-initdb.d/) only runs on a fresh installation."
    echo -e "If this is a new installation attempt, you may need to clear it first."
fi

echo "Building and starting services..."
# Export variables so docker compose interpolation and build args work correctly
export NEXT_PUBLIC_SUPABASE_URL="http://${NEW_IP}:8000"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export ANON_KEY="$ANON_KEY" # Also export the original name for interpolation
export SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

# Explicitly pass build args to ensure they are available during 'npm run build'
docker compose build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# STEP A: Start DB first to apply permission patches
echo "Starting Database for patching..."
docker compose up -d supabase-db

# Wait for DB to be ready
RETRIES=30
until docker exec supabase-db psql -U postgres -d postgres -c "SELECT 1" &> /dev/null || [ $RETRIES -eq 0 ]; do
  echo "Waiting for DB... ($RETRIES left)"
  sleep 2
  RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}Error: Database failed to start.${NC}"
    exit 1
fi

# STEP B: Apply Mandatory Permissions & Role Patch (Fixes Auth crashing and PostgREST 401s)
echo "Ensuring critical database role permissions (The Hammer)..."
docker exec -i supabase-db psql -U postgres -d postgres <<EOF
  -- ESCALATED PERMISSIONS ("THE HAMMER")
  -- Granting superuser rights to service admins to ensure they can manage their own schema
  ALTER ROLE supabase_auth_admin WITH SUPERUSER;
  ALTER ROLE supabase_storage_admin WITH SUPERUSER;
  GRANT postgres TO supabase_auth_admin;
  GRANT postgres TO supabase_storage_admin;

  -- Auth Admin needs to manage migrations in public schema
  GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
  GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
  ALTER ROLE supabase_auth_admin SET search_path TO auth, public;

  -- Ensure authenticator role can see schemas
  GRANT USAGE ON SCHEMA public TO authenticator;
  GRANT USAGE ON SCHEMA auth TO authenticator;
  GRANT USAGE ON SCHEMA extensions TO authenticator;
  
  -- Ensure anon and authenticated can see public
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

  -- FUNCTION RESTORATION (Critical after CASCADE drop)
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid; \$\$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '')::text; \$\$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb; \$\$;

  -- ROBUST OWNERSHIP FIX
  DO \$\$
  DECLARE
      item record;
      r record;
      v_admin text;
  BEGIN
      FOR item IN (SELECT nspname FROM pg_namespace WHERE nspname IN ('auth', 'storage')) LOOP
          v_admin := CASE WHEN item.nspname = 'auth' THEN 'supabase_auth_admin' ELSE 'supabase_storage_admin' END;
          -- Tables
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = item.nspname) LOOP
              EXECUTE 'ALTER TABLE ' || item.nspname || '.' || quote_ident(r.tablename) || ' OWNER TO ' || v_admin;
          END LOOP;
          -- Views
          FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = item.nspname) LOOP
              EXECUTE 'ALTER VIEW ' || item.nspname || '.' || quote_ident(r.viewname) || ' OWNER TO ' || v_admin;
          END LOOP;
          -- Sequences
          FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND n.nspname = item.nspname) LOOP
              EXECUTE 'ALTER SEQUENCE ' || item.nspname || '.' || quote_ident(r.relname) || ' OWNER TO ' || v_admin;
          END LOOP;
          -- Functions/Routines
          FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = item.nspname) LOOP
              EXECUTE 'ALTER FUNCTION ' || item.nspname || '.' || quote_ident(r.proname) || '(' || r.args || ') OWNER TO ' || v_admin;
          END LOOP;
          -- Schema itself
          EXECUTE 'ALTER SCHEMA ' || item.nspname || ' OWNER TO ' || v_admin;
      END LOOP;
  END \$\$;
EOF

# STEP C: Restore RLS Policies (Recover from previous CASCADE drop)
echo "Restoring RLS Policies from migrations..."
# Robust extraction of multi-line CREATE POLICY statements (case-insensitive)
cat ../supabase/migrations/*.sql | awk '
  tolower($0) ~ /create policy/ {in_block=1}
  in_block {print}
  in_block && /;/ {in_block=0}
' | docker exec -i supabase-db psql -U postgres -d postgres

# STEP D: Start the rest of the services
echo "Starting application services..."
docker compose up -d

echo "Checking Schema Status..."
if ! docker exec supabase-db psql -U postgres -d postgres -c "SELECT 1 FROM public.system_settings LIMIT 1;" &> /dev/null; then
    echo "Schema missing or incomplete. Attempting to apply init_schema.sql..."
    cat volumes/db/init/00-schema.sql | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1
else
    echo "Schema appears valid."
fi

# Ensure License Key is active...
echo "Ensuring License Key is active..."
LICENSE_TOKEN="eyJleHBpcnkiOiIyMDI2LTEyLTMxIiwiY3VzdG9tZXIiOiJGaXJtZW5uYW1lIiwibWF4VXNlcnMiOjUwLCJjcmVhdGVkIjoiMjAyNS0xMi0yOVQxMzozMjozOS42NTNaIn0=.6AIcBmhbL0c+N/Ju4uCXWo4mK4UYIwD9lr3W8BEpp78O7ETlhqSoFoYbPUJklmKSBxSJbBW5Bvdk2BxQn7BACA=="
docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$LICENSE_TOKEN\"}'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"

echo "Verifying users..."
docker exec supabase-db psql -U postgres -d postgres -c "SELECT count(*) FROM auth.users;"

echo -e "${GREEN}=== Installation Complete ===${NC}"
echo "App should be running at: http://localhost:3000"
echo "Supabase Studio: http://localhost:3001"
