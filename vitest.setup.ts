process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://user:pass@localhost:3306/db";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "s".repeat(40);
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? "c".repeat(40);
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS ?? "1000";
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? "10";
