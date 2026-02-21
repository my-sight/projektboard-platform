#!/bin/bash
set -euo pipefail
# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
CONTAINER_NAME="supabase-db"
DB_USER="postgres"

# Ensure backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

# Check if container is running
if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "Error: Container $CONTAINER_NAME is not running."
    exit 1
fi

echo "[$(date)] Starting backup to $FILENAME..."

# Perform Backup
# We use pipe to compress directly
if docker exec -i $CONTAINER_NAME pg_dump -U $DB_USER postgres | gzip > "$FILENAME"; then
    echo "[$(date)] Backup successful."
    
    # Retention Policy: Delete backups older than 7 days
    echo "[$(date)] Cleaning up old backups (older than 7 days)..."
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -print -delete
    
    # Set permissions so App container can read it (if running with different user)
    chmod 644 "$FILENAME"
else
    echo "[$(date)] Backup failed!"
    rm -f "$FILENAME" # Remove incomplete file
    exit 2
fi
