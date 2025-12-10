import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
    try {
        console.log('Authenticating...');
        await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');

        const collectionName = 'system_settings';

        try {
            await pb.collections.getOne(collectionName);
            console.log(`Collection '${collectionName}' already exists.`);
        } catch (e) {
            console.log(`Creating collection '${collectionName}'...`);
            await pb.collections.create({
                name: collectionName,
                type: 'base',
                fields: [
                    { name: 'key', type: 'text', required: true, unique: true },
                    { name: 'value', type: 'json' },
                    { name: 'logo', type: 'file', maxSelect: 1 }
                ],
                listRule: '', // Public for now, or auth only: '@request.auth.id != ""'
                viewRule: '',
                createRule: '@request.auth.id != ""',
                updateRule: '@request.auth.id != ""',
                deleteRule: '@request.auth.id != ""',
            });
            console.log(`✅ Collection '${collectionName}' created.`);

            // Create default lockout record
            try {
                await pb.collection(collectionName).create({
                    key: 'lockout',
                    value: {
                        enabled: false,
                        lockoutTime: null,
                        message: 'System initialization'
                    }
                });
                console.log('Default lockout record created.');
            } catch (err) {
                console.log('Lockout record might already exist or error:', err.message);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
