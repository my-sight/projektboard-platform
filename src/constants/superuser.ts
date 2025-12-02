// src/constants/superuser.ts

// Liste der Superuser (E-Mails)
export const SUPERUSER_EMAILS = [
    'admin@example.com', 
    'michael@mysight.net' 
];

export const isSuperuserEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    
    // 1. Prüfe Hardcoded Liste
    if (SUPERUSER_EMAILS.map(e => e.toLowerCase()).includes(lowerEmail)) {
        return true;
    }
    
    // 2. Prüfe Environment Variable (optional)
    const envEmails = process.env.NEXT_PUBLIC_SUPERUSER_EMAILS?.split(',') || [];
    return envEmails.map(e => e.toLowerCase().trim()).includes(lowerEmail);
};