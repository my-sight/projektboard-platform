#!/bin/bash

# Security Hardening Script for ProjektBoard Appliance
# Installs UFW, Fail2Ban, and secures Docker bindings.

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Starting System Hardening ===${NC}"

# 1. Update & Install Tools
echo "Installing Security Tools..."
apt update
apt install -y ufw fail2ban

# 2. Configure Fail2Ban (SSH Protection)
echo "Configuring Fail2Ban for SSH..."
# Create a local config to avoid overwriting defaults on updates
cat <<EOF > /etc/fail2ban/jail.local
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF

systemctl restart fail2ban
echo -e "${GREEN}Fail2Ban active.${NC}"

# 3. Configure UFW (Firewall)
echo "Configuring UFW Firewall..."

# Default Policy
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (CRITICAL) - Do this FIRST
ufw allow ssh
ufw allow 22/tcp

# Allow Web (HTTP/HTTPS) - Managed by Nginx
ufw allow 80/tcp
ufw allow 443/tcp

# Ports 3000, 3001, 8000, 8443 are now bound to 127.0.0.1 in Docker.
# We DO NOT allow them externally in UFW anymore.
# Access only via Nginx (443).

# Enable
# NON-INTERACTIVE enablement
echo "y" | ufw enable

echo -e "${GREEN}UFW Firewall active.${NC}"
ufw status verbose

echo -e "${GREEN}System Hardening Complete.${NC}"
echo "Firewall is active. Only SSH (22), HTTP (80) and HTTPS (443) are OPEN."

