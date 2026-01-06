#!/bin/bash
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Real-Time Service Monitor ===${NC}"
echo "This script will stream logs from critical services."
echo "Keep this window open while you try to login in the browser."
echo "Press Ctrl+C to stop."
echo "---------------------------------------------------------"

trap "kill 0" EXIT

# Function to tail logs with a prefix
tail_logs() {
    local service=$1
    local color=$2
    docker logs -f $service 2>&1 | while read line; do
        echo -e "${color}[$service] $line${NC}"
    done
}

tail_logs supabase-realtime "$RED" &
tail_logs supabase-kong "$YELLOW" &
tail_logs supabase-auth "$GREEN" &

wait
