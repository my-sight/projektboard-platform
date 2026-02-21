#!/bin/bash

# setup_usb_backup.sh
# Interactive wizard to mount an external USB drive as the permanent backup target.

set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== External Backup Setup Wizard ===${NC}"
echo "This script will help you mount a USB drive to store backups off-disk."

# 1. Detect Drives
echo -e "\n${YELLOW}Detecting connected drives...${NC}"
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,MODEL | grep -v "loop"

echo -e "\n${YELLOW}Identify your USB Drive partition (e.g., sdb1).${NC}"
echo "WARNING: Ensure it is the correct drive!"
read -p "Enter Partition Name (e.g. sdb1): " PART_NAME

DEVICE="/dev/$PART_NAME"

if [ ! -b "$DEVICE" ]; then
    echo -e "${RED}Error: Device $DEVICE not found.${NC}"
    exit 1
fi

# 2. Mount Point
MOUNT_POINT="/var/lib/projektboard-backups"
echo -e "${YELLOW}Creating mount point: $MOUNT_POINT${NC}"
mkdir -p "$MOUNT_POINT"

# 3. Mount (Test)
echo "Attempting to mount..."
mount "$DEVICE" "$MOUNT_POINT" || {
    echo -e "${RED}Mount failed. Is the drive formatted? (FAT32/ExFAT/EXT4 supported)${NC}"
    exit 1
}

echo -e "${GREEN}Mount successful!${NC}"

# 4. Persistence (fstab)
UUID=$(blkid -s UUID -o value "$DEVICE")
if [ -z "$UUID" ]; then
    echo -e "${RED}Could not determine UUID. Manual fstab setup required.${NC}"
else
    echo "Determined UUID: $UUID"
    if grep -q "$UUID" /etc/fstab; then
        echo "Entry already exists in /etc/fstab."
    else
        echo "Adding to /etc/fstab for auto-mount..."
        echo "UUID=$UUID $MOUNT_POINT auto defaults,nofail 0 2" >> /etc/fstab
    fi
fi

# 5. Connect to App (.env)
echo -e "${YELLOW}Updating .env configuration...${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
touch "$ENV_FILE"
grep -v "PROJECT_BACKUP_PATH" "$ENV_FILE" > "$ENV_FILE.tmp" || true
echo "PROJECT_BACKUP_PATH=$MOUNT_POINT" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

echo -e "${GREEN}Success! Backups will now be written to: $MOUNT_POINT${NC}"
echo "You can test it by running: sudo ./backup-appliance.sh"
