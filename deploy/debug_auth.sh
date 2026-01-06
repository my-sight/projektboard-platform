#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Debugging Auth & Credentials ===${NC}"

# 1. Check if User exists in DB
echo -e "\n1. Checking Database Records..."
docker exec supabase-db psql -U postgres -d postgres -c "\x" -c "SELECT id, email, role, left(encrypted_password, 10) as pass_hash_start, confirmed_at, last_sign_in_at FROM auth.users WHERE email = 'michael@mysight.net';"

# 2. Check Extension
echo -e "\n2. Checking pgcrypto Extension..."
docker exec supabase-db psql -U postgres -d postgres -c "SELECT * FROM pg_extension WHERE extname = 'pgcrypto';"

# 3. Verbose Login Test
echo -e "\n3. Testing Login via Curl (Verbose)..."
ANON_KEY=$(grep "ANON_KEY=" .env | cut -d= -f2)
[ -z "$ANON_KEY" ] && ANON_KEY=$(grep "ANON_KEY=" deploy/.env 2>/dev/null | cut -d= -f2)

if [ -z "$ANON_KEY" ]; then
    echo "Using default fallback key... (might fail)"
    ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzM1ODE1NjAwLCJleHAiOjE4MDk5MDIwMDB9.EXAMPLE"
fi

curl -v -X POST 'http://127.0.0.1:8000/auth/v1/token?grant_type=password' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "michael@mysight.net",
    "password": "Serum4x!"
  }'
