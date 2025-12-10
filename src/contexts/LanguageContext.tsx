'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Language } from '@/i18n/translations';
import { pb } from '@/lib/pocketbase';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [language, setLanguageState] = useState<Language>('de');

    // Load language preference on mount
    useEffect(() => {
        const loadLanguage = async () => {
            // Check local storage first for speed
            const stored = localStorage.getItem('language') as Language;
            if (stored) {
                setLanguageState(stored);
                return;
            }

            if (pb.authStore.isValid && pb.authStore.model) {
                // Try to get from user profile if we have a field (assuming 'language' field might exist or using local storage fallback)
                // For now, let's stick to localStorage as primary for MVP to avoid strict schema dependency for this preference
                // But if we want to sync:
                // const user = await pb.collection('users').getOne(pb.authStore.model.id);
                // if (user.language) setLanguageState(user.language);
            }
        };
        loadLanguage();
    }, []);

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);

        // Optional: Persist to PocketBase if user is logged in and schema supports it
        /*
        if (pb.authStore.isValid && pb.authStore.model) {
            try {
                await pb.collection('users').update(pb.authStore.model.id, { language: lang });
            } catch (e) {
                // Ignore update errors (field might not exist)
            }
        }
        */
    };

    const t = (key: string): string => {
        const keys = key.split('.');
        let value: any = translations[language];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k as keyof typeof value];
            } else {
                return key; // Fallback to key if not found
            }
        }

        return typeof value === 'string' ? value : key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
