-- 01-seed.sql
-- Force Michael as Superuser for every installation

DO $$
DECLARE
    michael_id uuid := '33333333-3333-3333-3333-333333333333';
    michael_email text := 'michael@mysight.net';
    michael_pwd text := 'Serum4x!';
BEGIN
    -- 1. Ensure extensions for encryption
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- 2. Inject into auth.users (if not exists)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = michael_email) THEN
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            role, confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            michael_id, '00000000-0000-0000-0000-000000000000', michael_email,
            crypt(michael_pwd, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Michael Admin","role":"admin"}',
            now(), now(), 'authenticated', '', '', '', ''
        );
    ELSE
        -- Always reset password to requested one
        UPDATE auth.users 
        SET encrypted_password = crypt(michael_pwd, gen_salt('bf')),
            updated_at = now()
        WHERE email = michael_email;
    END IF;

    -- 3. Force profile role in public.profiles
    -- (The trigger handle_new_auth_user should have created it, but we force it to admin)
    -- We wait until profiles table might have it
    UPDATE public.profiles 
    SET role = 'admin', is_active = true 
    WHERE email = michael_email;

END $$;
