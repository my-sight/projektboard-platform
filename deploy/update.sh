#!/bin/bash

# update.sh
# SAFE MODE Update Script
# This script does NOT pull code from git. It assumes you have pushed code via rsync.
# It rebuilds the app and runs migrations.

echo "=== Applying Update (Safe Mode) ==="

# 1. Database Migrations
echo "Checking for database updates..."
if [ -f "./migrate.sh" ]; then
    ./migrate.sh
else
    echo "Warning: migrate.sh not found. Skipping migrations."
fi

# 1.5 Fix Permissions (Critical for Kong)
echo "Fixing permissions..."
chmod -R 755 volumes/api
chmod 644 volumes/api/kong.yml


# 2. Rebuild Container
echo "Rebuilding application..."

# Source env vars just in case
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

docker compose build --no-cache \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$ANON_KEY}" \
  app

# 3. Restart
echo "Restarting services..."
docker compose up -d app

# 4. Self-Healing: Ensure License Exists
echo "Verifying License..."

# Read LICENSE_TOKEN from environment. Do not hardcode valid/real-looking JWTs here.
if [ -z "${LICENSE_TOKEN}" ]; then
  echo "❌ ERROR: LICENSE_TOKEN environment variable is not set."
  echo "Please set it before running this script."
  exit 1
fi

# Fallback safely handled here via variables, without hardcoding anything real
SAFE_LICENSE_TOKEN="${LICENSE_TOKEN:-REPLACE_ME_LICENSE_TOKEN}"

docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$SAFE_LICENSE_TOKEN\"}'::jsonb) ON CONFLICT (key) DO NOTHING;" >/dev/null 2>&1

echo "✅ Update Complete!"
