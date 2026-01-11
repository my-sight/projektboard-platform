#!/bin/bash

# usb_update.sh
# Safely updates the ProjektBoard Appliance from a USB stick.
# 
# Security:
# - Run manually by admin (sudo).
# - Resides on trusted NUC storage.
# - Only reads from USB (no execution).

set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Ensure we are in the deploy directory
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$DEPLOY_DIR")"

echo -e "${GREEN}=== Offline USB Update Wizard ===${NC}"

# 1. auto-detect USB mount or device
MOUNT_POINT="/media/usb-update"
mkdir -p "$MOUNT_POINT"

# Try to find a device that looks like a USB stick (removable, not the system drive)
# We look for partitions that are NOT currently mounted as root or boot
CANDIDATE=$(lsblk -rn -o NAME,TRAN,MOUNTPOINT | grep 'usb' | grep -v 'boot' | grep -v ' /$' | head -n 1 | awk '{print $1}')

if [ -z "$CANDIDATE" ]; then
    echo -e "${YELLOW}No automatically detected USB drives via 'usb' transport.${NC}"
    echo "Listing all available partitions:"
    lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,MODEL
    echo "------------------------------------------------"
    read -p "Please enter the partition name of your USB stick (e.g. sdb1): " PART_NAME
    DEVICE="/dev/$PART_NAME"
else
    DEVICE="/dev/$CANDIDATE"
    echo -e "${GREEN}Detected USB Device: $DEVICE${NC}"
fi

# Check Device
if [ ! -b "$DEVICE" ]; then
    echo -e "${RED}Error: Device $DEVICE not found.${NC}"
    exit 1
fi

# 2. Mount
echo "Mounting $DEVICE to $MOUNT_POINT..."
# Unmount first just in case
umount "$DEVICE" 2>/dev/null || true
mount "$DEVICE" "$MOUNT_POINT" || {
    echo -e "${RED}Mount failed. Check filesystem (FAT32/ExFAT recommended).${NC}"
    exit 1
}

# 3. Validate Content
SOURCE_DIR="$MOUNT_POINT/projektboard-platform"

if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: Directory 'projektboard-platform' not found on USB stick.${NC}"
    echo "Expected path: $SOURCE_DIR"
    echo "Please copy the entire project folder to the root of the stick."
    umount "$MOUNT_POINT"
    exit 1
fi

echo -e "${GREEN}Update source found!${NC}"
echo "Source: $SOURCE_DIR"
echo "Target: $PROJECT_ROOT"

# 4. Safe Sync (The Core Logic)
echo -e "\n${YELLOW}Syncing files (Safe Mode)...${NC}"
echo "Using rsync to update code while preserving .env and secrets."

# We assume standard rsync availability.
# Note: --delete ensures files deleted in dev are removed in prod, BUT we must be careful.
# For safety, we usually DO NOT use --delete for automated updates to avoid accidental data loss of unexpected files.
# We Stick to overwriting/adding.

rsync -av \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude 'volumes' \
    --exclude 'deploy/volumes' \
    "$SOURCE_DIR/" "$PROJECT_ROOT/"

echo -e "${GREEN}File sync complete.${NC}"

# 5. Cleanup
echo "Unmounting USB..."
umount "$MOUNT_POINT"
echo -e "${GREEN}USB stick can be removed now.${NC}"

# 6. Rebuild
echo -e "\n${YELLOW}Rebuilding Application...${NC}"
cd "$DEPLOY_DIR"
docker compose build --no-cache app
docker compose up -d app

echo -e "${GREEN}=== Update Complete! ===${NC}"
echo "Please verify the application in the browser."
