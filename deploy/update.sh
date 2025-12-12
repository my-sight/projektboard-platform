
#!/bin/bash

echo "=== 更新 ProjektBoard Appliance ==="

# 1. Update Code
echo "Pulling latest code..."
git pull origin main

# 2. Apply Database Migrations
echo "Checking for database updates..."
./migrate.sh

# 3. Rebuild Container
echo "Rebuilding application..."
docker compose build app

# 4. Restart
echo "Restarting services..."
docker compose up -d

echo "Update Complete!"
