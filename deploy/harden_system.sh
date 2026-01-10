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

# Allow SSH (CRITICAL)
ufw allow ssh
# Allow Web (HTTP/HTTPS)
ufw allow 80/tcp
ufw allow 443/tcp
# Allow Port 3000 (App Fallback) - Optional, user can disable later
ufw allow 3000/tcp

# Docker Swarm/Network required ports? We use Standalone Compose.
# Docker handles its own iptables, but UFW protects the HOST services.

# Enable
# NON-INTERACTIVE enablement
echo "y" | ufw enable

echo -e "${GREEN}UFW Firewall active.${NC}"
ufw status verbose

echo -e "${GREEN}System Hardening Complete.${NC}"
echo "Note: Docker ports (8000, 3001) are managed by Docker iptables."
echo "To secure them, we must bind them to 127.0.0.1 in docker-compose.yml."

