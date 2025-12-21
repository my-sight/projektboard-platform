#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== ProjektBoard Appliance Installer (Superuser Fix) ===${NC}"

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

# Smart IP Detection: Use the actual provided IP or fall back to the NUC's known LAN IP
# if 'kanban' is provided, we warn the user.
DEFAULT_IP=${NUC_IP:-"192.168.178.46"}
read -p "Enter NUC IP [${DEFAULT_IP}]: " NEW_IP
NEW_IP=${NEW_IP:-${DEFAULT_IP}}

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NUC_IP=${NEW_IP}
NEXT_PUBLIC_SUPABASE_URL=http://${NEW_IP}:8000
SUPABASE_URL=http://${NEW_IP}:8000
EOF

echo -e "Keys check: \nANON: ${ANON_KEY:0:15}...\nSERVICE: ${SERVICE_ROLE_KEY:0:15}..."

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

echo "Initializing Supabase Roles & Permissions (Robust Mode)..."
docker exec -i supabase-db psql -U postgres -d postgres <<EOF
DO \$\$
BEGIN
    -- 1. Essential Roles
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role nologin; END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator noinherit login password '${POSTGRES_PASSWORD}'; END IF;
END \$\$;
GRANT anon, authenticated, service_role TO authenticator;
-- ELEVATE Service Role to bypass RLS and allow full admin access
ALTER ROLE service_role WITH SUPERUSER BYPASSRLS;
ALTER ROLE postgres WITH SUPERUSER BYPASSRLS;

-- 2. Schema and Extension
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role, authenticated;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
EOF

echo "Reloading PostgREST Schema Cache..."
docker kill -s SIGUSR1 supabase-rest > /dev/null 2>&1

# 5. Post-Initialization Superuser Injector (API Mode)
echo "Cleaning up existing superuser records ('michael@mysight.net')..."
docker exec -i supabase-db psql -U postgres -d postgres <<EOF
  DELETE FROM auth.users WHERE email = 'michael@mysight.net';
  DELETE FROM public.profiles WHERE email = 'michael@mysight.net';
EOF

echo "Waiting for Auth Service to initialize..."
for i in {1..20}; do
    if curl -s "http://${NEW_IP}:8000/auth/v1/health" | grep -q "OK"; then break; fi
    echo -n "."
    sleep 3
done
echo -e "\nAuth Service is UP."

echo "Applying Schema Migrations (Hot-Fix)..."
docker exec -i supabase-db psql -U postgres -d postgres <<EOF
DO \$\$ 
BEGIN 
  -- 1. Profiles Migration
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    BEGIN
      ALTER TABLE public.profiles RENAME COLUMN role TO system_role;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not rename role in profiles: %', SQLERRM;
    END;
  END IF;

  -- 2. Board Members Migration
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'board_members' AND column_name = 'role') THEN
    BEGIN
      ALTER TABLE public.board_members RENAME COLUMN role TO system_role;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not rename role in board_members: %', SQLERRM;
    END;
  END IF;

  -- 3. Departments RLS
  ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Allow authenticated read departments') THEN
    CREATE POLICY "Allow authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Allow admin manage departments') THEN
    CREATE POLICY "Allow admin manage departments" ON public.departments FOR ALL TO authenticated 
    USING (public.is_admin_or_superuser());
  END IF;

  -- Update helper function to ignore visibility (as requested: all users see all boards)
  CREATE OR REPLACE FUNCTION public.list_all_boards() RETURNS SETOF public.kanban_boards AS \$\$
    SELECT * FROM public.kanban_boards ORDER BY coalesce(updated_at, created_at) DESC;
  \$\$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

  -- 4. Storage Schema and Buckets
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL,
      owner uuid,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      public boolean DEFAULT false,
      file_size_limit bigint,
      allowed_mime_types text[]
  );
  -- Use gen_random_uuid from pgcrypto instead of uuid_generate_v4
  CREATE TABLE IF NOT EXISTS storage.objects (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      bucket_id text REFERENCES storage.buckets(id),
      name text,
      owner uuid,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      last_accessed_at timestamp with time zone DEFAULT now(),
      metadata jsonb,
      path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
  );
  GRANT ALL ON SCHEMA storage TO postgres, service_role, authenticated, anon;
  GRANT ALL ON TABLE storage.buckets TO postgres, service_role, authenticated, anon;
  GRANT ALL ON TABLE storage.objects TO postgres, service_role, authenticated, anon;

  -- Enable RLS
  ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
END \$\$;

-- 5. Force Update Highlander Functions
CREATE OR REPLACE FUNCTION public.is_michael() RETURNS boolean AS \$func\$
  SELECT (
    coalesce(auth.jwt() ->> 'email', nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email') = 'michael@mysight.net'
    OR auth.uid() = '33333333-3333-3333-3333-333333333333'
  );
\$func\$ LANGUAGE sql SECURITY DEFINER SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS \$func\$
  SELECT public.is_michael() OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND system_role = 'admin'
  );
\$func\$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Checks if user is admin or board-admin
CREATE OR REPLACE FUNCTION public.can_admin_board(target_board_id uuid) RETURNS boolean AS \$func\$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.board_members 
    WHERE board_id = target_board_id 
    AND profile_id = auth.uid() 
    AND system_role = 'admin'
  );
\$func\$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Checks if user can edit content (Member or Admin)
CREATE OR REPLACE FUNCTION public.can_edit_board_content(target_board_id uuid) RETURNS boolean AS \$func\$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.board_members 
    WHERE board_id = target_board_id 
    AND profile_id = auth.uid()
  );
\$func\$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- 6. AUTHORITATIVE RLS & TRIGGER RESET
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_escalations ENABLE ROW LEVEL SECURITY;

-- Board Visibility: ALL can see all (per request)
DROP POLICY IF EXISTS "rbac_read_boards" ON public.kanban_boards;
CREATE POLICY "rbac_read_boards" ON public.kanban_boards FOR SELECT TO authenticated USING (true);

-- Board Management: Michael or Admin or Board-Admin
DROP POLICY IF EXISTS "rbac_manage_boards" ON public.kanban_boards;
CREATE POLICY "rbac_manage_boards" ON public.kanban_boards FOR ALL TO authenticated USING (public.can_admin_board(id));

-- Card Visibility: ALL can see all
DROP POLICY IF EXISTS "rbac_read_cards" ON public.kanban_cards;
CREATE POLICY "rbac_read_cards" ON public.kanban_cards FOR SELECT TO authenticated USING (true);

-- Card Content: Member or Admin
DROP POLICY IF EXISTS "rbac_manage_cards" ON public.kanban_cards;
CREATE POLICY "rbac_manage_cards" ON public.kanban_cards FOR ALL TO authenticated USING (public.can_edit_board_content(board_id));

-- Escalations: EVERYONE can edit (per request)
DROP POLICY IF EXISTS "rbac_manage_escalations" ON public.board_escalations;
CREATE POLICY "rbac_manage_escalations" ON public.board_escalations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles: Michael or Admin manage all; User can read all, update self
DROP POLICY IF EXISTS "rbac_read_profiles" ON public.profiles;
CREATE POLICY "rbac_read_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rbac_admin_manage_profiles" ON public.profiles;
CREATE POLICY "rbac_admin_manage_profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "rbac_update_own_profile" ON public.profiles;
CREATE POLICY "rbac_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Notes: Self management only
DROP POLICY IF EXISTS "Users can manage their own notes" ON public.personal_notes;
CREATE POLICY "Users can manage their own notes" ON public.personal_notes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- System Settings: MICHAEL ONLY (Highlander)
DROP POLICY IF EXISTS "Allow public read access to system_settings" ON public.system_settings;
CREATE POLICY "Allow public read access to system_settings" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Michael manage settings" ON public.system_settings;
CREATE POLICY "Allow Michael manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.is_michael());

-- Departments: Michael or Admin
DROP POLICY IF EXISTS "Allow admin manage departments" ON public.departments;
CREATE POLICY "Allow admin manage departments" ON public.departments FOR ALL TO authenticated USING (public.is_admin());

-- Storage Policies
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage buckets" ON storage.buckets;
CREATE POLICY "Admins can manage buckets" ON storage.buckets FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read buckets" ON storage.buckets;
CREATE POLICY "Anyone can read buckets" ON storage.buckets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage objects" ON storage.objects;
CREATE POLICY "Admins can manage objects" ON storage.objects FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read objects" ON storage.objects;
CREATE POLICY "Anyone can read objects" ON storage.objects FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = storage.objects.bucket_id AND public = true)
);

-- Seed buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('system', 'system', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT DO NOTHING;

-- Trigger logic for Highlander Protection
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger AS \$func\$
declare
  existing_role text;
begin
  select system_role into existing_role from public.profiles where id = new.id;
  
  insert into public.profiles (id, email, full_name, system_role, company, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'user'),
    nullif(new.raw_user_meta_data->>'company', ''),
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        system_role = case 
            when public.is_michael() then 'admin' -- Michael is always admin (tier 1)
            when excluded.system_role = 'admin' then 'admin' -- Promotion
            when coalesce(existing_role, 'user') = 'admin' then 'admin' -- Preserve Admin
            else 'user' -- Default
        end,
        company = coalesce(excluded.company, public.profiles.company),
        is_active = true;
  return new;
exception 
  when others then return new;
end;
\$func\$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 7. Grant Permissions & Reload
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

GRANT ALL ON TABLE public.profiles TO authenticated, anon, service_role;
GRANT ALL ON TABLE public.departments TO authenticated, anon, service_role;
UPDATE public.profiles SET system_role = 'admin', is_active = true WHERE email = 'michael@mysight.net';
NOTIFY pgrst, 'reload_schema';
EOF

echo "Checking columns..."
docker exec -i supabase-db psql -U postgres -d postgres -c "\d public.profiles"

echo "Creating Superuser via Admin API..."
curl -s -X POST "http://${NEW_IP}:8000/auth/v1/admin/users" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -H "apikey: ${SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "id": "33333333-3333-3333-3333-333333333333",
       "email": "michael@mysight.net",
       "password": "Serum4x!",
       "email_confirm": true,
       "role": "authenticated",
       "user_metadata": {"full_name": "Michael Admin", "role": "admin"},
       "app_metadata": {"provider": "email"}
     }'

echo -e "\nFinal Sync Michael via SQL..."
docker exec -i supabase-db psql -U postgres -d postgres <<EOF
-- 1. Ensure the profile exists and matches the Auth ID
INSERT INTO public.profiles (id, email, full_name, system_role, is_active)
VALUES ('33333333-3333-3333-3333-333333333333', 'michael@mysight.net', 'Michael Admin', 'admin', true)
ON CONFLICT (id) DO UPDATE 
SET system_role = 'admin', is_active = true, email = 'michael@mysight.net';

-- 2. FORCE ROLE IN auth.users metadata (the source of truth for the trigger)
UPDATE auth.users 
SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin", "full_name": "Michael Admin"}'::jsonb,
    email_confirmed_at = now()
WHERE email = 'michael@mysight.net';

-- 3. Final Permissions
GRANT ALL ON TABLE public.profiles TO authenticated, anon;
GRANT ALL ON TABLE public.departments TO authenticated, anon;
NOTIFY pgrst, 'reload_schema';
EOF

docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users WHERE email = 'michael@mysight.net';" | xargs echo "Auth User Count:"
docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM public.profiles WHERE email = 'michael@mysight.net';" | xargs echo "Profile Count:"
docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users WHERE email = 'michael@mysight.net' AND email_confirmed_at IS NOT NULL;" | xargs echo "Auth User (Confirmed) Count:"
docker exec -i supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM public.profiles WHERE email = 'michael@mysight.net' AND system_role = 'admin';" | xargs echo "Admin Profile Count:"

echo "--------------------------------------------------------"
echo "Benutzer: michael@mysight.net / Passwort: Serum4x!"
echo "--------------------------------------------------------"

docker logs -f projektboard-app | grep --line-buffered -E "AuthContext|SignIn|signOut|Home Page|checkLicenseServer|DETAILED ERROR|AuthServer"
