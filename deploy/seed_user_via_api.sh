#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== USER SEED VIA API (Definitive) ===${NC}"

# 1. Load Secrets
SERVICE_ROLE_KEY=$(grep "SERVICE_ROLE_KEY=" .env | cut -d= -f2)
[ -z "$SERVICE_ROLE_KEY" ] && SERVICE_ROLE_KEY=$(grep "SERVICE_ROLE_KEY=" deploy/.env 2>/dev/null | cut -d= -f2)

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: SERVICE_ROLE_KEY not found in .env${NC}"
    exit 1
fi

echo "Using Service Key: ${SERVICE_ROLE_KEY:0:15}..."

# 2. Cleanup Old User (Clean Slate)
echo "Removing old user via SQL..."
docker exec supabase-db psql -U postgres -d postgres -c "DELETE FROM auth.users WHERE email = 'michael@mysight.net';"

# 3. Create User via Admin API (This guarantees the hash is valid for GoTrue)
echo "Creating User via API..."
RESPONSE=$(curl -s -X POST 'http://localhost:8000/auth/v1/admin/users' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "michael@mysight.net",
    "password": "Serum4x!",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "Michael",
      "role": "admin",
      "company": "MySight"
    }
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "\"id\""; then
    echo -e "${GREEN}API User Creation Successful!${NC}"
    
    # 4. Sync Profile (Force Admin Role in public.profiles)
    echo "Syncing Profile..."
    docker exec supabase-db psql -U postgres -d postgres -c "
      INSERT INTO public.profiles (id, email, full_name, role, company, is_active)
      SELECT id, email, 'Michael', 'admin', 'MySight', true
      FROM auth.users WHERE email = 'michael@mysight.net'
      ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
    "
    echo -e "${GREEN}Setup Complete.${NC}"
else
    echo -e "${RED}Creation Failed!${NC}"
fi
