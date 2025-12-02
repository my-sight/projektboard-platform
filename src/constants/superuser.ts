// src/constants/superuser.ts

// Diese Liste enthält alle E-Mail-Adressen, die immer als Superuser gelten sollen.
// Dies ist relevant für die Verwaltung der höchsten Rechte (z.B. Migrationstools).

export const SUPERUSER_EMAILS = [
    'admin@example.com', // Standard-Fallback
    'michael@mysight.net' // ✅ Dein Superuser-Account
];

// Funktion, die an vielen Stellen im Code verwendet wird, um den Status zu prüfen.
export const isSuperuserEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    
    // 1. Prüfe die Hardcoded-Liste
    if (SUPERUSER_EMAILS.map(e => e.toLowerCase()).includes(lowerEmail)) {
        return true;
    }
    
    // 2. Prüfe Environment Variable (für CI/Production Secrets)
    // Wenn NEXT_PUBLIC_SUPERUSER_EMAILS gesetzt ist (Komma-separiert), nutze diese Liste
    const envEmails = process.env.NEXT_PUBLIC_SUPERUSER_EMAILS?.split(',') || [];
    
    return envEmails.map(e => e.toLowerCase().trim()).includes(lowerEmail);
};