import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
    try {
        console.log('Authenticating as michael@mysight.net...');
        await pb.collection('users').authWithPassword('michael@mysight.net', 'Serum4x!');
        console.log('✅ Authenticated.');

        // 1. Get a board
        const boards = await pb.collection('kanban_boards').getFullList();
        if (boards.length === 0) { console.log('No boards found.'); return; }
        const boardId = boards[0].id;
        console.log(`Using Board: ${boardId} (${boards[0].name})`);

        // 2. Get Members
        const members = await pb.collection('board_members').getFullList({ filter: `board_id="${boardId}"` });
        console.log(`Found ${members.length} members.`);
        if (members.length === 0) {
            // Add self as member
            console.log('Adding self as member for test...');
            const me = pb.authStore.model.id;
            await pb.collection('board_members').create({ board_id: boardId, profile_id: me });
            console.log('Added self.');
        } else {
            members.forEach(m => console.log(` - Member: ${m.id}, Profile: ${m.profile_id}`));
        }

        const member = (await pb.collection('board_members').getFullList({ filter: `board_id="${boardId}"` }))[0];
        const userId = member.profile_id;
        console.log(`Testing with User ID: ${userId}`);

        // 3. Create Attendance
        const today = new Date().toISOString().split('T')[0];
        const weekStart = today; // Simplified
        console.log(`Creating/Updating attendance for week: ${weekStart}`);

        // Check existing
        const existingList = await pb.collection('board_attendance').getList(1, 1, {
            filter: `board_id="${boardId}" && user_id="${userId}" && week_start ~ "${weekStart}"`
            // Note: date filtering in PB might be tricky with strings vs dates. Frontend filters in memory.
        });

        // Let's rely on create for now to test saving
        try {
            const payload = {
                board_id: boardId,
                user_id: userId,
                week_start: weekStart,
                status: 'present'
            };
            console.log('Payload:', payload);
            const created = await pb.collection('board_attendance').create(payload);
            console.log('✅ Created Record:', created);
        } catch (e) {
            console.log('Create failed (might replicate duplicate logic error):', e.response?.message || e.message);
        }

        // 4. Load Attendance (Simulate Frontend Load)
        console.log('Loading all attendance for board...');
        const allAtt = await pb.collection('board_attendance').getFullList({
            filter: `board_id="${boardId}"`
        });
        console.log(`Fetched ${allAtt.length} records.`);

        // Simulate Frontend Parsing
        const map = {};
        allAtt.forEach(entry => {
            const ws = entry.week_start || entry.date || 'NODATE';
            const weekKey = ws.split('T')[0];

            console.log(`Entry: ${entry.id}, user_id: ${entry.user_id}, week_start: ${entry.week_start} -> key: ${weekKey}`);

            if (!entry.user_id) {
                console.error('❌ entry.user_id is missing!');
            } else if (entry.user_id === userId) {
                console.log('✅ Found match for our user!');
            }
        });

    } catch (e) {
        console.error('Fatal:', e);
    }
}

main();
