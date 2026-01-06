#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING ENVIRONMENT VARIABLES FOR BUILD ===${NC}"

# Define the persistent NUC URL
API_URL="http://kanban.local:8000"

echo "Setting NEXT_PUBLIC_SUPABASE_URL to $API_URL"

# Backup
cp .env .env.bak.buildfix

# Remove existing (if any) and Append correct one
# We use grep -v to filter out the old line, then append the new one.
# This is safer than sed in some minimal busybox environments, though standard sed is likely available.
grep -v "NEXT_PUBLIC_SUPABASE_URL" .env > .env.tmp
mv .env.tmp .env
echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL" >> .env

echo -e "${GREEN}Environment patched. Ready for rebuild.${NC}"
