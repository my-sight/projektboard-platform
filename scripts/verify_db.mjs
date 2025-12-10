import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function verify() {
    try {
        console.log('Connecting to PocketBase...');
        // Try to auth as admin (superuser)
        try {
            await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');
            console.log('✅ System Admin Authentication successful.');
        } catch (e) {
            console.log('⚠️ System Admin Auth failed (might use different credentials or not set yet). checking public access...');
        }

        const collections = await pb.collections.getFullList();
        console.log(`\nFound ${collections.length} collections:`);
        collections.forEach(c => console.log(` - ${c.name} (${c.type})`));

        // specific checks
        const users = await pb.collection('users').getFullList();
        console.log(`\nFound ${users.length} users in 'users' collection:`);
        users.forEach(u => console.log(` - ${u.email} (${u.id})`));

        const collection = await pb.collections.getOne('board_attendance');
        console.log('\nAttendance Collection Schema:');
        console.log(JSON.stringify(collection, null, 2));

        const boards = await pb.collection('kanban_boards').getFullList();
        console.log(`\nFound ${boards.length} boards.`);
        if (boards.length > 0) {
            console.log('First board data:', boards[0]);
        }

    } catch (e) {
        console.error('❌ Verification failed:', e.message);
    }
}

verify();
