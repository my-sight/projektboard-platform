import PocketBase from 'pocketbase';

// Use environment variable or default to localhost
const url = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(url);

// Optional: specific auth store handling if needed for SSR
pb.autoCancellation(false);
