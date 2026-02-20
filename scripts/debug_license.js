const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const anonKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; // From your .env.local output

const supabase = createClient(supabaseUrl, anonKey);

async function check() {
    console.log('Checking system_settings for license_key...');
    const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'license_key');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Found rows:', data.length);
        if (data.length > 0) {
            console.log('Value:', JSON.stringify(data[0].value, null, 2));
        }
    }
}

check();
