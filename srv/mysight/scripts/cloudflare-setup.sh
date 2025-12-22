#!/usr/bin/env bash
set -euo pipefail

# === Voraussetzung: Cloudflare Account vorhanden; Domain mysight.net liegt dort. ===
# Dieses Script:
#  - installiert cloudflared
#  - loggt dich ein (Browser-Flow)
#  - erstellt Tunnel "mysight-pi"
#  - setzt Routes/DNS für mysight.net, weber.mysight.net, test.mysight.net
#  - schreibt /etc/cloudflared/config.yml (Ingress)
#  - installiert systemd-Service und startet Tunnel

TUNNEL_NAME="mysight-pi"
CLOUDFLARE_BIN="/usr/local/bin/cloudflared"

echo "==> Install cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
  # ARM (Raspberry Pi) Installation
  ARCH=$(uname -m)
  if [[ "$ARCH" == "aarch64" ]]; then
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
  else
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm.deb -o /tmp/cloudflared.deb
  fi
  sudo dpkg -i /tmp/cloudflared.deb || sudo apt-get -f install -y
fi

echo "==> cloudflared login (öffne den Link im Browser und wähle mysight.net)"
cloudflared tunnel login

echo "==> Tunnel create"
cloudflared tunnel list | grep -q "$TUNNEL_NAME" || cloudflared tunnel create "$TUNNEL_NAME"

TUNNEL_ID=$(cloudflared tunnel list | awk -v name="$TUNNEL_NAME" '$0 ~ name {print $1}' | head -n1)
echo "Tunnel ID: $TUNNEL_ID"
[ -n "$TUNNEL_ID" ] || (echo "Tunnel ID nicht gefunden" && exit 1)

sudo mkdir -p /etc/cloudflared

echo "==> config.yml schreiben"
sudo tee /etc/cloudflared/config.yml >/dev/null <<EOF_INNER
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json
ingress:
  - hostname: mysight.net
    service: http://127.0.0.1:8080
  - hostname: weber.mysight.net
    service: http://127.0.0.1:3001
  - hostname: test.mysight.net
    service: http://127.0.0.1:3002
  - service: http_status:404
EOF_INNER

echo "==> DNS Routes anlegen"
cloudflared tunnel route dns "$TUNNEL_NAME" mysight.net
cloudflared tunnel route dns "$TUNNEL_NAME" weber.mysight.net
cloudflared tunnel route dns "$TUNNEL_NAME" test.mysight.net

echo "==> Systemd Service installieren"
sudo cloudflared service install

echo "==> Tunnel starten"
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
sleep 2
sudo systemctl status cloudflared --no-pager

echo "==> Fertig: https://mysight.net | https://weber.mysight.net | https://test.mysight.net sollten über den Tunnel erreichbar sein."
