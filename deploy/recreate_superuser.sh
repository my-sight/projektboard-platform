#!/bin/bash

# Ensure we are in the deploy directory
cd "$(dirname "$0")"

# Load environment variables (Service Key)
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found in $(pwd)"
    exit 1
fi

echo "----------------------------------------------------------------"
echo "Re-Creating Superuser: michael@mysight.net"
echo "----------------------------------------------------------------"

# 1. Create User in Auth Service (GoTrue) via API (Internal Docker Network)
# We use wget because curl might not be installed in the app container
echo "1. Creating Auth User..."
RESPONSE=$(docker exec projektboard-app wget -qO- \
  --header="Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header="Content-Type: application/json" \
  --post-data='{"email": "michael@mysight.net", "password": "Serum4x!", "email_confirm": true, "user_metadata": {"full_name": "Michael", "role": "admin", "company": "MySight"}}' \
  http://kong:8000/auth/v1/admin/users)

echo -e "\nResponse: $RESPONSE"

# 2. Sync User to Profiles Table (Database)
echo -e "\n2. Syncing Profile to Database..."
docker exec supabase-db psql -U postgres -d postgres -c "
  INSERT INTO public.profiles (id, email, full_name, role, company, is_active)
  SELECT id, email, 'Michael', 'admin', 'MySight', true
  FROM auth.users WHERE email = 'michael@mysight.net'
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;"

echo "----------------------------------------------------------------"
echo "Done. Try logging in now."
