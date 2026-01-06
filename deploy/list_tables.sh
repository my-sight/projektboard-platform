#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== LISTING ALL TABLES ===${NC}"
docker exec supabase-db psql -U postgres -d postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
