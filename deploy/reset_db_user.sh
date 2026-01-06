#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== USER RESET TOOL ===${NC}"
echo "Forcing a clean reset of the admin user..."

# 1. Delete existing user (CASCADE to clear profiles/identities)
echo "Deleting old user..."
docker exec supabase-db psql -U postgres -d postgres -c "DELETE FROM auth.users WHERE email = 'michael@mysight.net';"

# 2. Insert FRESH User with Hardcoded Valid Hash (Cost 10)
# 'Serum4x!' hashed with bcrypt (cost 10): $2a$10$abcdefghijklmnopqrstuu (Simulated valid hash by PG)
# using pgcrypto gen_salt('bf', 10) explicitly.
echo "Creating new user..."
docker exec supabase-db psql -U postgres -d postgres <<EOF
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000001', 
  '00000000-0000-0000-0000-000000000000', 
  'authenticated', 
  'authenticated', 
  'michael@mysight.net', 
  extensions.crypt('Serum4x!', extensions.gen_salt('bf', 10)), 
  NOW(), 
  '{"provider":"email","providers":["email"]}', 
  '{"full_name":"Michael","role":"admin","company":"MySight"}', 
  NOW(), 
  NOW(),
  ''
)
ON CONFLICT (id) DO UPDATE SET 
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at;

-- Force Profile Sync
INSERT INTO public.profiles (id, email, full_name, role, company, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'michael@mysight.net', 'Michael', 'admin', 'MySight', true)
ON CONFLICT (id) DO UPDATE SET 
  role = 'admin',
  is_active = true;
EOF

echo -e "${GREEN}User Reset Complete.${NC}"
