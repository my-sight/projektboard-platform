#!/bin/bash

# Configuration
MIGRATIONS_DIR="../supabase/migrations"
OUTPUT_FILE="init_schema.sql"
# License: 2 Users, Expires 2030, Default Install
LICENSE_TOKEN="eyJleHBpcnkiOiIyMDMwLTEyLTMxIiwiY3VzdG9tZXIiOiJEZWZhdWx0IEluc3RhbGwiLCJtYXhVc2VycyI6MiwiY3JlYXRlZCI6IjIwMjUtMTItMjlUMDg6Mzk6NTQuNDY0WiJ9.+T3gqn8IBUkFTLbfI+nNSipA2FPfSd5umVgHDqZV78YQU7GgRrY4gy8M3Sczm2IAhYGMjzzPnbQRlgwh/Ka6DA=="

echo "Generating $OUTPUT_FILE from migrations..."

# 1. Header
echo "-- Auto-generated init script for ProjektBoard" > $OUTPUT_FILE
echo "-- Generated at $(date)" >> $OUTPUT_FILE
echo "BEGIN;" >> $OUTPUT_FILE

# 2. Migrations
for file in $(ls $MIGRATIONS_DIR/*.sql | sort); do
    echo "" >> $OUTPUT_FILE
    echo "-- Migration: $(basename "$file")" >> $OUTPUT_FILE
    cat "$file" >> $OUTPUT_FILE
done

# 3. Seed License
echo "" >> $OUTPUT_FILE
echo "-- Seed License" >> $OUTPUT_FILE
echo "INSERT INTO public.system_settings (key, value) VALUES ('license_key', '{\"token\": \"$LICENSE_TOKEN\"}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;" >> $OUTPUT_FILE

# 4. Seed Superuser (michael@mysight.net / mysight123)
echo "" >> $OUTPUT_FILE
echo "-- Seed Superuser (michael@mysight.net)" >> $OUTPUT_FILE
echo "DO \$\$" >> $OUTPUT_FILE
echo "BEGIN" >> $OUTPUT_FILE
echo "  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'michael@mysight.net') THEN" >> $OUTPUT_FILE
echo "    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)" >> $OUTPUT_FILE
echo "    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'michael@mysight.net', crypt('Serum4x!', gen_salt('bf')), NOW(), NOW(), NOW(), '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{\"full_name\":\"Michael\",\"role\":\"admin\",\"company\":\"MySight\"}', NOW(), NOW(), '', '', '', '');" >> $OUTPUT_FILE
echo "  END IF;" >> $OUTPUT_FILE
echo "END" >> $OUTPUT_FILE
echo "\$\$;" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "-- Ensure Profile Role is Admin" >> $OUTPUT_FILE
echo "UPDATE public.profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'michael@mysight.net');" >> $OUTPUT_FILE

echo "COMMIT;" >> $OUTPUT_FILE

echo "Done. $OUTPUT_FILE created."
