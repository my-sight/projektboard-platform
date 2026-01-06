#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== FIXING KONG PERMISSIONS (ROBUST) ===${NC}"

# 1. Broaden Directory Permissions (Traversal)
echo "Fixing directory permissions..."
chmod 777 volumes/api
chmod 777 volumes/api/kong.yml

# 2. Touch the file to ensure ownership is current (helps sometimes)
touch volumes/api/kong.yml

# 3. List permissions for verification
echo -e "\nPermissions:"
ls -ld volumes/api
ls -l volumes/api/kong.yml

# 4. Restart Kong
echo -e "\nRestarting Kong..."
docker restart supabase-kong

# 5. Wait again
sleep 5
echo -e "\nKong Logs (5s):"
timeout 5s docker logs -f supabase-kong
