#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/my-sight/projektboard-platform.git"
BRANCH="codex/refactor-originalkanbanboard.tsx-for-maintainability"

APP_DIR="/srv/mysight/app"
ECOSYSTEM="/srv/mysight/configs/ecosystem.multi.js"
LANDING_CONF="/srv/mysight/configs/nginx/landing.local.conf"

echo "==> Verzeichnisse"
sudo mkdir -p /srv/mysight/app /srv/mysight/scripts /srv/mysight/configs/nginx /var/www/mysight
sudo chown -R $USER:$USER /srv/mysight /var/www/mysight

if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> Clone Repository"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
echo "==> Checkout Branch: $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Build"
export NODE_OPTIONS="--max-old-space-size=512"
npm ci
npm run build

echo "==> PM2 starten/aktualisieren"
pm2 start "$ECOSYSTEM" || pm2 restart "$ECOSYSTEM"
pm2 save

echo "==> Nginx Landing (nur lokal auf 127.0.0.1:8080) aktivieren"
sudo ln -sf "$LANDING_CONF" /etc/nginx/sites-available/mysight-landing.conf
sudo ln -sf /etc/nginx/sites-available/mysight-landing.conf /etc/nginx/sites-enabled/mysight-landing.conf
sudo nginx -t
sudo systemctl reload nginx

echo "==> Fertig (App läuft lokal auf 3001/3002, Landing auf 127.0.0.1:8080). Cloudflare-Tunnel übernimmt die Öffentlichkeit."
