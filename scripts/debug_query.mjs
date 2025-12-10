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

        // Test 2: Attendance Sort by -week_start
        try {
            console.log('\n--- Test 2: Attendance Sort by "-week_start"');
            const att = await pb.collection('board_attendance').getFullList({ sort: '-week_start' });
            console.log(`✅ Success! Fetched ${att.length} records.`);
        } catch (err) {
            console.error('❌ Test 2 Failed:', err.status, err.message);
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
