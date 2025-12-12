
#!/bin/bash

# Configuration
DB_CONTAINER="supabase-db"
DB_USER="postgres"
DB_NAME="postgres"
MIGRATIONS_DIR="../supabase/migrations"

echo "Checking for database migrations..."

# 1. Ensure Migration Tracking Table Exists
docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
CREATE TABLE IF NOT EXISTS _deployment_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);" > /dev/null 2>&1

# 2. Iterate and Apply
# Using sort to ensure order (timestamps in filenames)
for file in $(ls $MIGRATIONS_DIR/*.sql | sort); do
    BASENAME=$(basename "$file")
    
    # Check if applied
    IS_APPLIED=$(docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAc "SELECT 1 FROM _deployment_migrations WHERE filename = '$BASENAME';")
    
    if [ "$IS_APPLIED" != "1" ]; then
        echo "Applying: $BASENAME"
        
        # Run SQL file
        # We cat the file and pipe it into the docker container psql command
        if cat "$file" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -q; then
             # Mark as applied
             docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "INSERT INTO _deployment_migrations (filename) VALUES ('$BASENAME');" > /dev/null
             echo "✅ Success"
        else
             echo "❌ Failed to apply $BASENAME. Stopping updates."
             exit 1
        fi
    else
        echo "Skipping: $BASENAME (Already applied)"
    fi
done

echo "Database is up to date."
