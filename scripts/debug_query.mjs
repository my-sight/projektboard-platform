import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function debug() {
    try {
        console.log('Authenticating as michael@mysight.net...');
        await pb.collection('users').authWithPassword('michael@mysight.net', 'Serum4x!');
        console.log('✅ Authenticated.');

        // Test 1: Attendance No Sort
        try {
            console.log('\n--- Test 1: Attendance No Sort');
            const att = await pb.collection('board_attendance').getFullList();
            console.log(`✅ Success! Fetched ${att.length} records.`);
        } catch (err) {
            console.error('❌ Test 1 Failed:', err.status, err.message);
        }

        // Test 2: Attendance Inspect
        try {
            console.log('\n--- Test 2: Attendance Inspect');
            const att = await pb.collection('board_attendance').getFullList();
            // Client side sort for debug
            att.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
            console.log(`Found ${att.length} attendance records.`);
            att.forEach(r => {
                console.log(` - ID: ${r.id}, User: ${r.profile_id}, Week: ${r.week_start}, Status: ${r.status}, Created: ${r.created}`);
            });
        } catch (err) {
            console.error('❌ Test 2 Failed:', err.status, err.message);
        }

        // Test 3: Users Sort by -created
        try {
            console.log('\n--- Test 3: Users Sort by "-created"');
            const users = await pb.collection('users').getFullList({ sort: '-created' });
            console.log(`✅ Success! Fetched ${users.length} users.`);
        } catch (err) {
            console.error('❌ Test 3 Failed:', err.status, err.message);
        }

        // Test 1: Cards No Sort
        try {
            console.log('\n--- Test 1: Cards No Sort');
            const cards = await pb.collection('kanban_cards').getFullList();
            console.log(`✅ Success! Fetched ${cards.length} cards.`);
        } catch (err) {
            console.error('❌ Test 1 Failed:', err.status, err.message);
        }

        // Test 2: Cards Sort by -updated
        try {
            console.log('\n--- Test 2: Cards Sort by "-updated"');
            const cards = await pb.collection('kanban_cards').getFullList({ sort: '-updated' });
            console.log(`✅ Success! Fetched ${cards.length} cards.`);
        } catch (err) {
            console.error('❌ Test 2 Failed:', err.status, err.message);
        }

    } catch (e) {
        console.error('Script Error:', e.message);
    }
}

debug();
