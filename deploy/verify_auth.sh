#!/bin/bash
# JWT & Secret Deep Verification Script v1.1

echo "--- AUTH SECRET DEEP VERIFICATION ---"
echo ""

# 0. Path Awareness
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

# 1. Load Local Env
if [ -f .env ]; then
    source .env
    echo "[Local] JWT_SECRET found in .env: ${JWT_SECRET:0:8}..."
else
    echo "[!] .env missing on host"
fi

# 2. Check Secrets in Containers (via Environment)
echo ""
echo "[Container: Environment List]"

check_env() {
    container=$1
    var=$2
    echo "Checking $var in '$container':"
    # Try both 'env' (runtime) and 'docker inspect' (config)
    VAL_RUNTIME=$(docker exec $container env | grep $var | cut -d= -f2 | tr -d '\r')
    VAL_CONFIG=$(docker inspect $container --format '{{range .Config.Env}}{{println .}}{{end}}' | grep $var | cut -d= -f2)
    
    if [ -z "$VAL_RUNTIME" ] && [ -z "$VAL_CONFIG" ]; then
        echo "  >> EMPTY! Not found in environment or inspect."
    elif [ "$VAL_RUNTIME" == "$JWT_SECRET" ] || [ "$VAL_CONFIG" == "$JWT_SECRET" ]; then
        echo "  >> MATCH: Variable found and matches .env"
    else
        echo "  >> MISMATCH / PARTIAL!"
        echo "     Runtime: ${VAL_RUNTIME:0:8}..."
        echo "     Inspect: ${VAL_CONFIG:0:8}..."
    fi
}

check_env "supabase-auth" "GOTRUE_JWT_SECRET"
check_env "supabase-rest" "PGRST_JWT_SECRET"
check_env "supabase-storage" "PGRST_JWT_SECRET"
check_env "supabase-realtime" "JWT_SECRET"

# 3. Verify Key Signatures
echo ""
echo "[Knotenpunkt] Validating ANON_KEY signature against local secret:"
VERIFY_SCRIPT="
const crypto = require('crypto');
const secret = '$JWT_SECRET';
const key = '$ANON_KEY';
const [header, payload, signature] = key.split('.');
const expected = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
if (signature === expected) {
    console.log('SUCCESS: ANON_KEY is valid for the secret in .env');
} else {
    console.log('FAILURE: ANON_KEY does NOT match the secret in .env!');
}
"
docker run --rm node:18-alpine node -e "$VERIFY_SCRIPT"

# 4. Check for multiple .env files
echo ""
echo "[System] Searching for conflicting .env files:"
find .. -name ".env*" -maxdepth 2

# 5. Check Docker Compose Interpolation
echo ""
echo "[Docker] Testing Compose variable interpolation:"
docker compose config | grep -i JWT_SECRET

echo ""
echo "--- VERIFICATION COMPLETE ---"
