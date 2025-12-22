const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(supabaseUrl, serviceRoleKey);

const token = process.argv[2];

if (!token) {
    console.error('Please provide a token string as argument');
    process.exit(1);
}

async function inject() {
    console.log('Injecting token...');
    // We decode the token payload just to print info (not verifying signature here, DB just stores it)
    try {
        const parts = token.split('.');
        const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        console.log('Token Payload:', payload);
    } catch (e) {
        console.log('Could not parse payload (invalid format?), proceeding anyway...');
    }

    const { error } = await supabase.from('system_settings').upsert({
        key: 'license_key',
        value: { token }
    });

    if (error) {
        console.error('Error injecting token:', error);
        process.exit(1);
    }
    console.log('Token injected successfully.');
}

inject();
