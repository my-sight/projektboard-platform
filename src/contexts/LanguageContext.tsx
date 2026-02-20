'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Language } from '@/i18n/translations';
import { useAuth } from './AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/en';
import 'dayjs/locale/pl';
import 'dayjs/locale/zh-cn';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const { profile, updateProfile } = useAuth();
    const [language, setLanguageState] = useState<Language>('de');

    // Load language preference on mount and when profile changes
    useEffect(() => {
        const loadLanguage = async () => {
            // Priority: URL (if implemented) > Profile > LocalStorage > Default (de)
            if (profile?.preferred_language) {
                setLanguageState(profile.preferred_language);
                dayjs.locale(profile.preferred_language === 'cn' ? 'zh-cn' : profile.preferred_language);
                return;
            }

            const stored = localStorage.getItem('language');
            if (stored && (stored === 'de' || stored === 'en' || stored === 'pl' || stored === 'cn')) {
                setLanguageState(stored as Language);
                dayjs.locale(stored === 'cn' ? 'zh-cn' : stored);
                return;
            }
        };
        loadLanguage();
    }, [profile]);

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
        dayjs.locale(lang === 'cn' ? 'zh-cn' : lang);

        if (profile) {
            updateProfile({ preferred_language: lang });
        }
    };

    const t = (key: string, variables?: Record<string, string | number>): string => {
        const keys = key.split('.');
        let value: any = translations[language];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k as keyof typeof value];
            } else {
                return key; // Fallback to key if not found
            }
        }

        let text = typeof value === 'string' ? value : key;

        if (variables) {
            Object.entries(variables).forEach(([k, v]) => {
                text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
            });
        }

        return text;
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
