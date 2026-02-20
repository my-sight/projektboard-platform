
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const email = 'michael@mysight.net';
    const boardId = process.argv[2];

    if (!boardId) {
        console.error('Usage: node scripts/fix_board_permissions.js <BOARD_ID>');
        process.exit(1);
    }

    console.log(`Fixing permissions for ${email} on board ${boardId}...`);

    // 1. Get User ID
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    // Simple filter since listUsers doesn't support complex filtering in all versions
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
        console.error(`User ${email} not found!`);
        process.exit(1);
    }

    const userId = user.id;
    console.log(`Found User ID: ${userId}`);

    // 2. Make User the Owner of the Board
    const { data: board, error: boardError } = await supabase
        .from('kanban_boards')
        .update({ owner_id: userId })
        .eq('id', boardId)
        .select();

    if (boardError) {
        console.error('Error updating board owner:', boardError);
    } else {
        console.log('✅ Successfully set as Board Owner:', board);
    }

    // 3. Ensure User is Board Member with Admin Role
    // Check if member exists
    const { data: member } = await supabase
        .from('board_members')
        .select('*')
        .eq('board_id', boardId)
        .eq('profile_id', userId)
        .single();

    if (member) {
        // Update existing member
        const { error: updateError } = await supabase
            .from('board_members')
            .update({ role: 'admin' })
            .eq('id', member.id);

        if (updateError) console.error('Error updating member role:', updateError);
        else console.log('✅ Updated existing member role to admin');
    } else {
        // Insert new member
        const { error: insertError } = await supabase
            .from('board_members')
            .insert({
                board_id: boardId,
                profile_id: userId,
                role: 'admin',
                joined_at: new Date().toISOString()
            });

        if (insertError) console.error('Error adding member:', insertError);
        else console.log('✅ Added user as Admin Member/Admin');
    }

    console.log('Done.');
}

main();
