#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING FILESYSTEM PERMISSIONS (STORAGE & DB) ===${NC}"

# 1. Fix Storage Directory
# The container user (often uid 1000 or 999) needs to write here.
# 777 is the safest nuclear option for local dev/NUC.
if [ -d "deploy/volumes/storage" ]; then
  echo "Fixing deploy/volumes/storage..."
  sudo chmod -R 777 deploy/volumes/storage
elif [ -d "volumes/storage" ]; then
  echo "Fixing volumes/storage..."
  sudo chmod -R 777 volumes/storage
else
  echo "Creating storage directory..."
  mkdir -p deploy/volumes/storage
  chmod -R 777 deploy/volumes/storage
fi

# 2. Fix DB Data (Prevent Permission Denied on startup/restart)
# Postgres is picky, but for docker volume mounts, 700 or 777 often needed depending on host mapping.
# We'll touch the parent dir, not the data contents (Postgres protects those).
if [ -d "deploy/volumes/db" ]; then
  chmod 777 deploy/volumes/db
fi

echo -e "${GREEN}Filesystem permissions applied.${NC}"
