
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProfile() {
    const email = 'michael@mysight.net';
    console.log(`Checking profile for ${email}...`);

    // Get User ID
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
        console.error('Error listing users:', userError);
        return;
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        console.error('User not found in Auth.');
        return;
    }
    console.log('User ID:', user.id);

    // Get Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('Error fetching profile:', profileError);
    } else {
        console.log('Profile found:', profile);
    }
}

checkProfile();
