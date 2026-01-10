#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/enc_backup_$TIMESTAMP.sql.gz.enc"
CONTAINER_NAME="supabase-db"
DB_USER="postgres"
ENV_FILE="$SCRIPT_DIR/.env"

# Load Secrets
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
else
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

ENCRYPTION_KEY="$JWT_SECRET" # Use JWT_SECRET as backup key

# Ensure backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
fi

# Check if container is running
if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "Error: Container $CONTAINER_NAME is not running."
    exit 1
fi

echo "[$(date)] Starting ENCRYPTED backup to $FILENAME..."

# Pipeline: Dump -> Gzip -> OpenSSL Encrypt
if docker exec -i $CONTAINER_NAME pg_dump -U $DB_USER postgres \
    | gzip \
    | openssl enc -aes-256-cbc -salt -pbkdf2 -k "$ENCRYPTION_KEY" -out "$FILENAME"; then
    
    echo "[$(date)] Encrypted Backup successful."
    
    # Retention Policy: Delete backups older than 7 days
    find "$BACKUP_DIR" -name "enc_backup_*.sql.gz.enc" -mtime +7 -print -delete
    
    chmod 600 "$FILENAME" # Restrictive permissions for encrypted file
else
    echo "[$(date)] Backup failed!"
    rm -f "$FILENAME"
    exit 2
fi
