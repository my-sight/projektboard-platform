import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const schema = [
    {
        name: 'kanban_boards',
        type: 'base',
        fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'description', type: 'text' },
            { name: 'settings', type: 'json' },
            { name: 'owner_id', type: 'relation', collectionId: 'users', maxSelect: 1 },
            { name: 'board_admin_id', type: 'relation', collectionId: 'users', maxSelect: 1 }
        ]
    },
    {
        name: 'kanban_cards',
        type: 'base',
        fields: [
            { name: 'card_data', type: 'json' },
            { name: 'column_id', type: 'text' },
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 }
        ]
    },
    {
        name: 'board_members',
        type: 'base',
        fields: [
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 },
            { name: 'profile_id', type: 'relation', collectionId: 'users', maxSelect: 1 },
            { name: 'role', type: 'text' }
        ]
    },
    {
        name: 'board_top_topics',
        type: 'base',
        fields: [
            { name: 'title', type: 'text' },
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 },
            { name: 'position', type: 'number' },
            { name: 'due_date', type: 'date' },
            { name: 'calendar_week', type: 'number' }
        ]
    },
    {
        name: 'board_attendance',
        type: 'base',
        fields: [
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 },
            { name: 'user_id', type: 'relation', collectionId: 'users', maxSelect: 1 },
            { name: 'status', type: 'text' },
            { name: 'date', type: 'date' }
        ]
    },
    {
        name: 'personal_notes',
        type: 'base',
        fields: [
            { name: 'content', type: 'text' },
            { name: 'user_id', type: 'relation', collectionId: 'users', maxSelect: 1 },
            { name: 'is_done', type: 'bool' },
            { name: 'due_date', type: 'date' }
        ]
    },
    {
        name: 'departments',
        type: 'base',
        fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'color', type: 'text' }
        ]
    },
    {
        name: 'system_settings',
        type: 'base',
        fields: [
            { name: 'key', type: 'text', required: true },
            { name: 'value', type: 'json' },
            { name: 'logo', type: 'file', maxSelect: 1 }
        ]
    },
    {
        name: 'board_escalations',
        type: 'base',
        fields: [
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 },
            { name: 'card_id', type: 'text' }, // or relation if card_id is known to be from kanban_cards, but often it was just string in supabase? Code uses card_id string.
            { name: 'category', type: 'text' },
            { name: 'project_code', type: 'text' },
            { name: 'project_name', type: 'text' },
            { name: 'reason', type: 'text' },
            { name: 'measure', type: 'text' },
            { name: 'department_id', type: 'relation', collectionId: 'departments', maxSelect: 1 },
            { name: 'responsible_id', type: 'relation', collectionId: 'users', maxSelect: 1 },
            { name: 'target_date', type: 'date' },
            { name: 'completion_steps', type: 'number' }
        ]
    },
    {
        name: 'board_escalation_history',
        type: 'base',
        fields: [
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 },
            { name: 'card_id', type: 'text' },
            { name: 'escalation_id', type: 'relation', collectionId: 'board_escalations', maxSelect: 1 },
            { name: 'changed_at', type: 'date' },
            { name: 'changed_by', type: 'text' }, // or relation to users
            { name: 'changes', type: 'json' }
        ]
    },
    {
        name: 'board_favorites',
        type: 'base',
        fields: [
            { name: 'user_id', type: 'relation', collectionId: 'users', maxSelect: 1 },
            { name: 'board_id', type: 'relation', collectionId: 'kanban_boards', maxSelect: 1 }
        ]
    }
];

async function main() {
    try {
        console.log('Authenticating...');
        await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');
        // 4. Create/Update Collections with proper ID resolution

        console.log('Fetching base data...');
        const usersCol = await pb.collections.getOne('users');
        const idMap = {
            users: usersCol.id
        };
        console.log(`Base 'users' collection ID: ${usersCol.id}`);

        for (const col of schema) {
            try {
                console.log(`Processing ${col.name}...`);

                // Prepare fields with resolved IDs
                const resolvedFields = col.fields.map(field => {
                    if (field.type === 'relation' && field.collectionId) {
                        // Resolve collectionId from map
                        const targetId = idMap[field.collectionId];
                        if (!targetId) {
                            console.warn(`⚠️ Warning: Could not resolve collectionId for '${field.collectionId}' in field '${field.name}'. Keeping original (might fail).`);
                            return field;
                        }
                        return { ...field, collectionId: targetId };
                    }
                    return field;
                });

                const payload = {
                    ...col,
                    fields: resolvedFields,
                    // Add default rules
                    listRule: '@request.auth.id != ""',
                    viewRule: '@request.auth.id != ""',
                    createRule: '@request.auth.id != ""',
                    updateRule: '@request.auth.id != ""',
                    deleteRule: '@request.auth.id != ""',
                };

                // Specific overrides
                if (col.name === 'users') {
                    payload.listRule = '@request.auth.id != ""';
                    payload.viewRule = '@request.auth.id != ""';
                }

                // Check if exists
                try {
                    // Try to find by name to delete
                    const existing = await pb.collections.getOne(col.name);
                    console.log(`Collection ${col.name} exists (${existing.id}). Deleting...`);
                    await pb.collections.delete(existing.id);
                    console.log(`Deleted ${col.name}`);
                } catch (err) {
                    // Ignore 404
                }

                const created = await pb.collections.create(payload);
                console.log(`✅ Created ${col.name} (ID: ${created.id})`);

                // Store in map for future references
                idMap[col.name] = created.id;

            } catch (e) {
                console.error(`❌ Error creating ${col.name}:`, e.message);
                if (e.originalError && e.originalError.data) {
                    console.error('Validation errors:', JSON.stringify(e.originalError.data, null, 2));
                } else if (e.response && e.response.data) {
                    console.error('Validation errors:', JSON.stringify(e.response.data, null, 2));
                }
            }
        }

        // Create default admin user in 'users' collection so they can login to the frontend
        try {
            const adminEmail = 'admin@kanban.local';
            try {
                // Check if user exists
                await pb.collection('users').getFirstListItem(`email="${adminEmail}"`);
                console.log('Default user already exists.');
            } catch {
                console.log('Creating default user...');
                await pb.collection('users').create({
                    email: adminEmail,
                    password: 'kanban123456',
                    passwordConfirm: 'kanban123456',
                    name: 'Admin',
                    role: 'admin'
                });
                console.log('Default user created (admin@kanban.local / kanban123456).');
            }
        } catch (e) {
            console.error('Error creating default user:', e.message);
        }

        // Create specific superuser michael@mysight.net
        try {
            const superEmail = 'michael@mysight.net';
            try {
                await pb.collection('users').getFirstListItem(`email="${superEmail}"`);
                console.log('Superuser michael@mysight.net already exists.');
            } catch {
                console.log('Creating superuser michael@mysight.net...');
                await pb.collection('users').create({
                    email: superEmail,
                    password: 'Serum4x!',
                    passwordConfirm: 'Serum4x!',
                    name: 'Michael',
                    role: 'admin' // Assuming superuser gets admin role or handled via isSuperuserEmail check
                });
                console.log('Superuser michael@mysight.net created.');
            }
        } catch (e) {
            console.error('Error creating superuser:', e.message);
        }
        // Update rules to be public for now (dev mode) or authenticated
        // For now, let's make them public read/write to test, or auth required.
        // We'll stick to default (admin only) and maybe enable auth rules later.

    } catch (e) {
        console.error('Fatal error:', e);
    }
}

main();
