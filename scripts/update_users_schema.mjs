import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
    try {
        console.log('Authenticating as Admin...');
        await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');

        console.log('Fetching "users" collection...');
        const collection = await pb.collections.getOne('users');

        // Add missing fields if they don't exist
        const fields = collection.fields;
        let changed = false;

        if (!fields.find(f => f.name === 'role')) {
            console.log('Adding "role" field...');
            fields.push({
                name: 'role',
                type: 'text', // Simple text for now, could be select
                required: false
            });
            changed = true;
        }

        if (!fields.find(f => f.name === 'company')) {
            console.log('Adding "company" field...');
            fields.push({
                name: 'company',
                type: 'text',
                required: false
            });
            changed = true;
        }

        if (!fields.find(f => f.name === 'is_active')) {
            console.log('Adding "is_active" field...');
            fields.push({
                name: 'is_active',
                type: 'bool',
                required: false
            });
            changed = true;
        }

        // Update Rules to allow Admins to manage users
        // Allow list/view if user is admin OR if user is self
        // Note: rule syntax: "@request.auth.role = 'admin'"
        const adminOrSelf = "id = @request.auth.id || @request.auth.role = 'admin'";

        if (collection.listRule !== adminOrSelf) {
            console.log('Updating listRule...');
            collection.listRule = adminOrSelf;
            changed = true;
        }
        if (collection.viewRule !== adminOrSelf) {
            console.log('Updating viewRule...');
            collection.viewRule = adminOrSelf;
            changed = true;
        }
        // Create: Allow admins to create users. Public registration is usually empty string.
        // If we want ONLY admins to create users, we set it to admin check.
        // However, standard behavior for this app seems to imply Admin creates users.
        if (collection.createRule !== "@request.auth.role = 'admin'") {
            console.log('Updating createRule...');
            collection.createRule = "@request.auth.role = 'admin'";
            changed = true;
        }
        if (collection.updateRule !== adminOrSelf) {
            console.log('Updating updateRule...');
            collection.updateRule = adminOrSelf;
            changed = true;
        }
        if (collection.deleteRule !== adminOrSelf) {
            console.log('Updating deleteRule...');
            collection.deleteRule = adminOrSelf;
            changed = true;
        }

        if (changed) {
            await pb.collections.update('users', collection);
            console.log('✅ Users collection schema and rules updated successfully.');
        } else {
            console.log('No changes needed.');
        }

        // Now, we must ensure the EXISTING users have the 'admin' role if they are supposed to.
        // The previous create calls in setup might have failed to set 'role' because the field didn't exist.
        // We should retrospectively update them.
        console.log('Updating existing users roles...');

        // Update admin@kanban.local
        try {
            const adminUser = await pb.collection('users').getFirstListItem('email="admin@kanban.local"');
            if (adminUser) {
                await pb.collection('users').update(adminUser.id, { role: 'admin' });
                console.log('Updated admin@kanban.local role to admin.');
            }
        } catch (e) {
            console.log('admin@kanban.local not found or error:', e.message);
        }

        // Update michael@mysight.net
        try {
            const michael = await pb.collection('users').getFirstListItem('email="michael@mysight.net"');
            if (michael) {
                await pb.collection('users').update(michael.id, { role: 'admin' });
                console.log('Updated michael@mysight.net role to admin.');
            }
        } catch (e) {
            console.log('michael@mysight.net not found or error:', e.message);
        }


    } catch (e) {
        console.error('Error updating users schema:', e);
    }
}

main();
