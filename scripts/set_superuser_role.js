
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setSuperuserRole() {
    const email = 'michael@mysight.net';
    console.log(`Updating role for ${email}...`);

    // Get User ID (efficiently via single query if possible, or list)
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    const user = users.find(u => u.email === email);
    if (!user) {
        console.error('User not found.');
        return;
    }

    // Update Profile
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'superuser' })
        .eq('id', user.id);

    if (updateError) {
        console.error('Error updating profile:', updateError);
    } else {
        console.log('Success! Role updated to superuser.');
    }
}

setSuperuserRole();
