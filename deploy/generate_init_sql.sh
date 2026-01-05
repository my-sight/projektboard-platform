#!/bin/bash

# Configuration
[ -f .env ] && source .env
MIGRATIONS_DIR="../supabase/migrations"
OUTPUT_FILE="init_schema.sql"

# License: 50 Users, Expires 2026, Firmenname
LICENSE_TOKEN="eyJleHBpcnkiOiIyMDI2LTEyLTMxIiwiY3VzdG9tZXIiOiJGaXJtZW5uYW1lIiwibWF4VXNlcnMiOjUwLCJjcmVhdGVkIjoiMjAyNS0xMi0yOVQxMzozMjozOS42NTNaIn0=.6AIcBmhbL0c+N/Ju4uCXWo4mK4UYIwD9lr3W8BEpp78O7ETlhqSoFoYbPUJklmKSBxSJbBW5Bvdk2BxQn7BACA=="

echo "Generating $OUTPUT_FILE from migrations..."

# 1. Header
echo "-- Auto-generated init script for ProjektBoard" > $OUTPUT_FILE
echo "-- Generated at $(date)" >> $OUTPUT_FILE
echo "SET search_path TO public, extensions, auth, storage;" >> $OUTPUT_FILE
echo "BEGIN;" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "-- 1.0 Pre-provision Roles and Schemas" >> $OUTPUT_FILE
cat << EOF >> $OUTPUT_FILE
DO \$\$
BEGIN
    -- Create schemas
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS extensions;

    -- Create auth functions stubs
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$func\$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid; \$func\$;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS \$func\$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '')::text; \$func\$;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$func\$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb; \$func\$;

    -- Create roles if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon nologin; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated nologin; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role nologin; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator noinherit login password '${POSTGRES_PASSWORD:-postgres}'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin WITH SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin WITH CREATEROLE login password '${POSTGRES_PASSWORD:-postgres}'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin WITH CREATEROLE login password '${POSTGRES_PASSWORD:-postgres}'; END IF;
    
    -- Grant memberships
    GRANT anon, authenticated, service_role TO authenticator;
    GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
    GRANT ALL ON SCHEMA public TO supabase_auth_admin; -- Fix for migration table creation
    GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
    GRANT ALL ON SCHEMA extensions TO supabase_admin;
    
    -- Ensure search path
    ALTER ROLE supabase_auth_admin SET search_path TO auth, public;
END \$\$;
EOF

echo "" >> $OUTPUT_FILE
echo "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA extensions;" >> $OUTPUT_FILE
echo "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\" WITH SCHEMA extensions;" >> $OUTPUT_FILE
echo "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\" WITH SCHEMA extensions;" >> $OUTPUT_FILE
echo "CREATE EXTENSION IF NOT EXISTS \"vector\" WITH SCHEMA extensions;" >> $OUTPUT_FILE

cat << EOF >> $OUTPUT_FILE

-- 1.1 Tables for Auth and Storage (Required for foreign keys and policies)
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY,
    aud character varying(255),
    role character varying(255),
    email character varying(255) UNIQUE,
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone character varying(255) DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change character varying(255) DEFAULT NULL::character varying,
    phone_change_token character varying(255) DEFAULT NULL::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    email_change_token_current character varying(255) DEFAULT NULL::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT NULL::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid REFERENCES auth.users,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets,
    name text,
    owner uuid REFERENCES auth.users,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
);

-- Indexes for auth.users
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);

-- Transfer ownership for Auth and Storage (Critical for Supabase GoTrue/Storage-API)
ALTER TABLE auth.users OWNER TO supabase_auth_admin;
ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

-- Grant permissions to PostgREST and Auth
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
EOF
echo "" >> $OUTPUT_FILE

# 2. Migrations
for file in $(ls $MIGRATIONS_DIR/*.sql | sort); do
    echo "" >> $OUTPUT_FILE
    echo "-- Migration: $(basename "$file")" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
done

# 3. Seed License
echo "" >> $OUTPUT_FILE
echo "-- Seed License" >> $OUTPUT_FILE
# Use standard quotes and ensure valid JSON format
echo "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$LICENSE_TOKEN\"}'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;" >> $OUTPUT_FILE

# 4. Seed Superuser (michael@mysight.net / mysight123)
echo "" >> $OUTPUT_FILE
echo "-- Seed Superuser (michael@mysight.net)" >> $OUTPUT_FILE
echo "DO \$\$" >> $OUTPUT_FILE
echo "BEGIN" >> $OUTPUT_FILE
echo "  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'michael@mysight.net') THEN" >> $OUTPUT_FILE
echo "    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)" >> $OUTPUT_FILE
echo "    VALUES ('00000000-0000-0000-0000-000000000000', extensions.gen_random_uuid(), 'authenticated', 'authenticated', 'michael@mysight.net', extensions.crypt('Serum4x!', extensions.gen_salt('bf')), NOW(), NOW(), NOW(), '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{\"full_name\":\"Michael\",\"role\":\"admin\",\"company\":\"MySight\"}', NOW(), NOW(), '', '', '', '');" >> $OUTPUT_FILE
echo "  END IF;" >> $OUTPUT_FILE
echo "END" >> $OUTPUT_FILE
echo "\$\$;" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "-- Ensure Profile Role is Admin" >> $OUTPUT_FILE
echo "UPDATE public.profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'michael@mysight.net');" >> $OUTPUT_FILE

echo "COMMIT;" >> $OUTPUT_FILE

echo "Done. $OUTPUT_FILE created."
