-- 01-seed.sql
-- Force Michael as Superuser for every installation
-- Hardened for extreme schema/type sensitivity and GoTrue compatibility

SET search_path TO public, auth, extensions;

DO $$
DECLARE
    michael_id uuid := '33333333-3333-3333-3333-333333333333';
    michael_email text := 'michael@mysight.net';
    michael_pwd text := 'Serum4x!';
    pwd_hash text;
BEGIN
    RAISE NOTICE 'Starting superuser synchronization for %', michael_email;

    -- 1. Locate and use gen_salt/crypt with extreme type safety
    -- We try to find the functions in the search_path
    BEGIN
        pwd_hash := crypt(michael_pwd::text, gen_salt('bf', 10));
        RAISE NOTICE 'Password hashed successfully using current search_path.';
    EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
        BEGIN
            pwd_hash := extensions.crypt(michael_pwd::text, extensions.gen_salt('bf', 10));
            RAISE NOTICE 'Password hashed successfully using extensions schema prefix.';
        EXCEPTION WHEN undefined_function THEN
            RAISE EXCEPTION 'CRITICAL: pgcrypto functions (gen_salt/crypt) not found! Ensure 00-schema.sql ran successfully.';
        END;
    END;

    -- 2. Inject into auth.users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, role, raw_app_meta_data, raw_user_meta_data,
            is_super_admin, confirmation_token, aud, confirmed_at
        ) VALUES (
            michael_id, '00000000-0000-0000-0000-000000000000', michael_email,
            pwd_hash, now(), now(), now(), 'authenticated',
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Michael Admin","role":"admin"}',
            false, '', 'authenticated', now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password,
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            aud = EXCLUDED.aud,
            confirmed_at = EXCLUDED.confirmed_at,
            updated_at = now();
        RAISE NOTICE 'Auth user % synchronized.', michael_email;
    ELSE
        RAISE EXCEPTION 'CRITICAL: Table auth.users missing!';
    END IF;

    -- 3. Force profile role in public.profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        INSERT INTO public.profiles (id, email, full_name, system_role, is_active)
        VALUES (michael_id, michael_email, 'Michael Admin', 'admin', true)
        ON CONFLICT (id) DO UPDATE 
        SET system_role = 'admin', is_active = true, email = EXCLUDED.email;
        RAISE NOTICE 'Public profile for % synchronized.', michael_email;
    END IF;

END $$;
