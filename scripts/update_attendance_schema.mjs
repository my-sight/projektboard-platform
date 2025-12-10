import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

function getStartOfWeek(dateString) {
    const d = new Date(dateString);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

async function main() {
    try {
        console.log('Authenticating as Admin...');
        await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');

        console.log('Fetching "board_attendance" collection...');
        const collection = await pb.collections.getOne('board_attendance');

        // Add missing fields if they don't exist
        const fields = collection.fields;
        let changed = false;

        if (!fields.find(f => f.name === 'week_start')) {
            console.log('Adding "week_start" field...');
            fields.push({
                name: 'week_start',
                type: 'date',
                required: false
            });
            changed = true;
        }

        if (changed) {
            await pb.collections.update('board_attendance', collection);
            console.log('✅ Collection schema updated.');
        } else {
            console.log('Schema already has week_start.');
        }

        console.log('Migrating existing records...');
        const records = await pb.collection('board_attendance').getFullList();

        for (const record of records) {
            if (!record.week_start && record.date) {
                const ws = getStartOfWeek(record.date);
                console.log(`Updating record ${record.id}: date=${record.date} -> week_start=${ws}`);
                await pb.collection('board_attendance').update(record.id, { week_start: ws });
            }
        }
        console.log('✅ Migration complete.');

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
