import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
    try {
        console.log('Authenticating as Admin...');
        await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');

        console.log('Fetching users collection...');
        const collection = await pb.collections.getOne('users'); // 'users' or ID

        console.log('Current Rules:', {
            listRule: collection.listRule,
            viewRule: collection.viewRule
        });

        console.log('Updating users collection rules...');
        // Allow any authenticated user to list and view users
        const updated = await pb.collections.update(collection.id, {
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""'
        });

        console.log('✅ Users collection updated successfully.');
        console.log('New Rules:', {
            listRule: updated.listRule,
            viewRule: updated.viewRule
        });

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

main();
