#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FORCING STORAGE DIRECTORY STRUCTURE ===${NC}"

# Define the base storage path
BASE_PATH="volumes/storage"
TENANT_PATH="$BASE_PATH/stub"
BRANDING_PATH="$TENANT_PATH/branding"
AVATARS_PATH="$TENANT_PATH/avatars"

# Ensure we are in deploy dir
if [ -d "deploy" ]; then
    cd deploy
fi

# Create directories explicitly
echo "Creating directory structure..."
sudo mkdir -p "$BRANDING_PATH"
sudo mkdir -p "$AVATARS_PATH"

# Set permissions (Nuclear Option for Dev/NUC)
echo "Setting permissions..."
sudo chown -R 1000:1000 "$BASE_PATH" 2>/dev/null || sudo chown -R 999:999 "$BASE_PATH" 2>/dev/null || echo "Warning: chown failed, relying on chmod"
sudo chmod -R 777 "$BASE_PATH"

echo -e "${GREEN}Structure created and permissions unleashed.${NC}"
echo "Restarting storage service to pick it up..."
docker compose restart storage
