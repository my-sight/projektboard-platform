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
LICENSE_TOKEN="${LICENSE_TOKEN:-eyJleHBpcnkiOiIyMDM1LTEyLTMxIiwiY3VzdG9tZXIiOiJNeVNpZ2h0IFBNTyIsIm1heFVzZXJzIjo1MCwiY3JlYXRlZCI6IjIwMjYtMDEtMTBUMjE6MDM6MzEuMDI1WiJ9.THCYth/brFfD2NJXLHJQZTCe3H00YlZl5KlXYvkzLqk/j8V1Mu0fyzy9IfM1zXpTZELr/WYABjiOYBE2DZJQDg==}"
docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$LICENSE_TOKEN\"}'::jsonb) ON CONFLICT (key) DO NOTHING;" >/dev/null 2>&1

echo "✅ Update Complete!"
