import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
    try {
        console.log('Authenticating as Admin...');
        await pb.admins.authWithPassword('admin@kanban.local', 'kanban123456');

        console.log('Fetching all attendance records...');
        const records = await pb.collection('board_attendance').getFullList();
        console.log(`Found ${records.length} records.`);

        let deleted = 0;
        for (const r of records) {
            let shouldDelete = false;
            // 1. Missing user_id
            if (!r.user_id) {
                console.log(`Deleting record ${r.id} (Missing user_id)`);
                shouldDelete = true;
            }
            // 2. Not a Monday (optional, but good for cleanup)
            const date = new Date(r.week_start);
            if (date.getDay() !== 1 && date.getDay() !== 0) { // 0 is Sunday. 1 is Monday.
                // Wait, depending on timezone 00:00Z might be Sunday night in local.
                // But selectedWeek is usually local YYYY-MM-DD.
                // PB stores as UTC date (00:00:00.000Z).
                // If I send 2025-12-10, it stores 2025-12-10 00:00:00.000Z.
                // Let's just convert to ISO string YYYY-MM-DD
                const iso = r.week_start.split('T')[0];
                const d = new Date(iso);
                // Verify if it's Monday.
                // Actually this test is risky due to TZ. I'll skip deleting based on day for now.
            }

            if (shouldDelete) {
                await pb.collection('board_attendance').delete(r.id);
                deleted++;
            }
        }
        console.log(`Cleanup complete. Deleted ${deleted} records.`);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
