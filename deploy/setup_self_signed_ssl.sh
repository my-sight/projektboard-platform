#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Self-Signed SSL Generator ===${NC}"

# Check for root/sudo
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (sudo).${NC}"
  exit 1
fi

SSL_DIR="/etc/nginx/ssl"
mkdir -p "$SSL_DIR"

echo "Generating self-signed certificate in $SSL_DIR..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/server.key" \
  -out "$SSL_DIR/server.crt" \
  -subj "/C=DE/ST=Production/L=NUC/O=MySight/CN=kanban.local"

if [ -f "$SSL_DIR/server.crt" ]; then
    chmod 600 "$SSL_DIR/server.key"
    chmod 644 "$SSL_DIR/server.crt"
    echo -e "${GREEN}Success! Certificates installed.${NC}"
    echo "You can now run: ./install.sh --prod"
else
    echo -e "${RED}Error generating certificates.${NC}"
    exit 1
fi
