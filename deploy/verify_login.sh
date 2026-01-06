#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Testing Login Credentials Locally (Bypassing Browser) ===${NC}"

# Check which API key to use
ANON_KEY=$(grep "ANON_KEY=" .env | cut -d= -f2)
[ -z "$ANON_KEY" ] && ANON_KEY=$(grep "ANON_KEY=" ../.env | cut -d= -f2)

if [ -z "$ANON_KEY" ]; then
    echo -e "${RED}Error: Could not find ANON_KEY in .env${NC}"
    exit 1
fi

echo "Using ANON_KEY: ${ANON_KEY:0:15}..."
echo "Target: http://localhost:8000/auth/v1/token?grant_type=password"

echo "Attempting Login for michael@mysight.net..."
RESPONSE=$(curl -s -X POST 'http://localhost:8000/auth/v1/token?grant_type=password' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "michael@mysight.net",
    "password": "Serum4x!"
  }')

if echo "$RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}SUCCESS! Credentials are valid.${NC}"
    echo "This proves the user exists and the password is correct."
else
    echo -e "${RED}FAILURE! Credentials rejected.${NC}"
    echo "Response from server:"
    echo "$RESPONSE"
fi
