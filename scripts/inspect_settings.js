
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

async function inspectSchema() {
    console.log('Querying information_schema...');

    // We can't query information_schema easily with supabase-js client directly without rpc or straight SQL 
    // BUT we can try to insert a dummy row with 'key' and see the logic error, OR just check if we can select 'key'.

    // Let's try to just insert a row and catch the error to see constraints or column errors
    const { error } = await supabase
        .from('system_settings')
        .insert({ key: 'test', value: {} });

    if (error) {
        console.log('Insert Error:', error.message);
        console.log('Full Error:', error);
    } else {
        console.log('Insert successful (test row created)');
        // Cleanup
        await supabase.from('system_settings').delete().eq('key', 'test');
    }
}

inspectSchema();
