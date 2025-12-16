-- 99-seed-superuser.sql
-- Creates the default superuser michael@mysight.net

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    -- Fixed UUID for the superuser
    user_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    user_email TEXT := 'michael@mysight.net';
    -- The password provided by the user
    user_password TEXT := '1fFdw3gM.3fgfksnfG!';
    encrypted_pw TEXT;
BEGIN
    -- Generate hashed password
    encrypted_pw := crypt(user_password, gen_salt('bf'));

    -- 1. Insert into auth.users
    -- We use ON CONFLICT to ensure we don't fail if run multiple times, 
    -- but we update the password to ensure it matches the requirement.
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        user_id,
        'authenticated',
        'authenticated',
        user_email,
        encrypted_pw,
        now(),
        now(),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Michael (Superuser)", "role": "superuser", "company": "MySight"}',
        false
    )
    ON CONFLICT (email) DO UPDATE SET
        encrypted_password = excluded.encrypted_password,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();

    -- 2. Insert into public.profiles
    -- Ensure the profile exists and has the correct role
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        company,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        user_id,
        user_email,
        'Michael (Superuser)',
        'superuser',
        'MySight',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'superuser',
        is_active = true,
        company = 'MySight',
        updated_at = now();
        
    RAISE NOTICE 'Superuser % created/updated successfully.', user_email;
END $$;
