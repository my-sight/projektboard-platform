#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== INJECTING DUMMY AWS CREDENTIALS FOR STORAGE ===${NC}"

# Define the file
COMPOSE_FILE="docker-compose.yml"

# Check if keys are already there
if grep -q "AWS_ACCESS_KEY_ID" "$COMPOSE_FILE"; then
  echo "AWS credentials already present."
else
  # Use sed to check explicitly after the 'storage:' block environment variables
  # It's tricky with simple sed. We will just append them after 'REGION: stub' which is unique enough.
  sed -i '' '/REGION: stub/a\
      AWS_ACCESS_KEY_ID: dummy\
      AWS_SECRET_ACCESS_KEY: dummy\
      AWS_DEFAULT_REGION: dummy
' "$COMPOSE_FILE"
  echo "Injected dummy AWS credentials."
fi

echo -e "${GREEN}Storage config patched.${NC}"
