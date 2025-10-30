#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/srv/mysight/app"

cd "$APP_DIR"
echo "==> Pull latest"
git pull

echo "==> Rebuild"
export NODE_OPTIONS="--max-old-space-size=512"
npm ci
npm run build

echo "==> Zero-downtime Reload"
pm2 reload mysight-weber
pm2 reload mysight-test
pm2 save

echo "==> Done."
