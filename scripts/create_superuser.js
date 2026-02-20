
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createSuperuser() {
    const email = 'michael@mysight.net';
    const password = 'Serum4x!';

    console.log(`Creating user ${email}...`);

    try {
        // 1. Create User in Auth
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Michael Superuser' }
        });

        if (userError) {
            console.error('Error creating user:', userError.message);
            // If user already exists, try to update password
            if (userError.message.includes('already has been registered')) {
                console.log('User exists. Attempting to update password...');
                const { data: users } = await supabase.auth.admin.listUsers();
                const user = users.users.find(u => u.email === email);
                if (user) {
                    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password: password });
                    if (updateError) console.error('Error updating password:', updateError);
                    else console.log('Password updated successfully.');
                }
            }
        } else {
            console.log('User created successfully:', userData.user.id);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

createSuperuser();
