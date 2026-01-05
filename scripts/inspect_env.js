const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Simulate Next.js env loading
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- Env Inspection ---');
console.log('URL:', url);
console.log('Anon Key (start):', anon ? anon.substring(0, 15) + '...' : 'MISSING');
console.log('Service Key (start):', service ? service.substring(0, 15) + '...' : 'MISSING');

async function testConnection() {
    if (!url || !service) {
        console.log('Cannot test connection: Missing URL or Service Key');
        return;
    }

    const supabase = createClient(url, service);
    const { data: keys, error: keyError } = await supabase.from('system_settings').select('key');
    const { data: license, error: licenseError } = await supabase.from('system_settings').select('value').eq('key', 'license_key').maybeSingle();

    if (keyError) {
        console.log('❌ Connection Error (Key Fetch):', keyError.message);
        if (keyError.message.includes('JWT')) {
            console.log('   TIP: This often means your SERVICE_ROLE_KEY is wrong for this URL.');
        }
    } else {
        console.log('✅ Connection OK. Found settings keys:', keys?.map(d => d.key));
    }

    if (licenseError) {
        console.log('❌ License Fetch Error:', licenseError.message);
    } else {
        console.log('License Key Value Structure:', license?.value ? 'OK (found)' : 'MISSING (returned null)');
        if (license?.value) {
            console.log('Token starts with:', license.value.token?.substring(0, 10) + '...');
        }
    }
}

testConnection();
