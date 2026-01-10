import { de } from './locales/de';
import { en } from './locales/en';
import { pl } from './locales/pl';
import { cn } from './locales/cn';

export const translations = {
    de,
    en,
    pl,
    cn
};

export type Language = 'de' | 'en' | 'pl' | 'cn';
export type TranslationKey = string;
