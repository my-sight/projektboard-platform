'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createTheme, ThemeProvider, Theme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { supabase } from '@/lib/supabaseClient';
import { Inter, Roboto, Open_Sans, Montserrat } from 'next/font/google';

// --- FONTS VORLADEN ---
const fontInter = Inter({ subsets: ['latin'], display: 'swap' });
const fontRoboto = Roboto({ weight: ['300', '400', '500', '700'], subsets: ['latin'], display: 'swap' });
const fontOpenSans = Open_Sans({ subsets: ['latin'], display: 'swap' });
const fontMontserrat = Montserrat({ subsets: ['latin'], display: 'swap' });

const fonts: Record<string, any> = {
  'Inter': fontInter,
  'Roboto': fontRoboto,
  'Open Sans': fontOpenSans,
  'Montserrat': fontMontserrat
};

// --- TYPEN ---
interface SystemConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl: string | null;
  appName: string;
}

interface SystemConfigContextType {
  config: SystemConfig;
  refreshConfig: () => Promise<void>;
  isLoading: boolean;
  theme: Theme;
  mode: 'light' | 'dark';
  toggleMode: () => void;
}

export const defaultSettings: SystemConfig = {
  primaryColor: '#4aa3ff',
  secondaryColor: '#19c37d',
  fontFamily: 'Inter',
  logoUrl: null,
  appName: 'Projektboard Platform'
};

// --- CONTEXT ---
const SystemConfigContext = createContext<SystemConfigContextType>({
  config: defaultSettings,
  refreshConfig: async () => { },
  isLoading: true,
  theme: createTheme(),
  mode: 'light',
  toggleMode: () => { }
});

export const useSystemConfig = () => useContext(SystemConfigContext);

// --- PROVIDER ---
export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  // Load mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('theme-mode');
    if (savedMode === 'dark' || savedMode === 'light') {
      setMode(savedMode);
    } else {
      // System preference fallback could go here
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('theme-mode', newMode);
  };

  const refreshConfig = async () => {
    try {
      const { data: record, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'config')
        .maybeSingle();

      if (record) {
        // Supabase returns the JSON column as object automatically if defined as such, 
        // but looking at schema it might be stored differently. 
        // Schema check: "value" type is json. Correct.
        // "logo" column name in PB was 'logo', here it is 'logo_url' (text) based on schema (line 183): "logo_url" text
        // Wait, line 183 says "logo_url". Line 80 of previous PB schema said "logo" (file).
        // My pulled schema line 183: "logo_url" text.
        // It seems `setup_pocketbase` used `logo` file field, but valid schema might use URL string? 
        // Or maybe I am looking at Supabase schema which has logo_url?
        // Let's assume `logo_url` holds the public URL or partial path.

        const val = record.value || {};
        // If logo_url is stored, use it. If not, check val.logoUrl
        const logoUrl = record.logo_url || val.logoUrl || null;

        setConfig({
          primaryColor: val.primaryColor || defaultSettings.primaryColor,
          secondaryColor: val.secondaryColor || defaultSettings.secondaryColor,
          fontFamily: val.fontFamily || defaultSettings.fontFamily,
          logoUrl: logoUrl,
          appName: val.appName || defaultSettings.appName
        });
      }
    } catch (e) {
      // 404 is expected if config doesn't exist yet
      console.log('Using default config (server config not found or error)');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  // --- THEME GENERIEREN ---
  const theme = createTheme({
    palette: {
      mode,
      primary: { main: config.primaryColor },
      secondary: { main: config.secondaryColor },
      background: mode === 'dark'
        ? {
          default: '#09090b', // Zinc 950 (Neutral Black)
          paper: '#18181b',   // Zinc 900 (Dark Gray)
        }
        : {
          default: '#f4f6f8',
          paper: '#ffffff',
        },
      text: mode === 'dark'
        ? {
          primary: '#fafafa', // Zinc 50
          secondary: '#a1a1aa', // Zinc 400
        }
        : {
          primary: '#1c2434', // Darker text for light mode
          secondary: '#64748b',
        },
      divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontFamily: fonts[config.fontFamily]?.style.fontFamily || 'sans-serif',
      h1: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    // ✅ HIER GEÄNDERT: Kantigeres Design (4px statt 12px)
    shape: { borderRadius: 4 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.15)'
            }
          },
          contained: { borderRadius: 4 }
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 4, // Kantig
            boxShadow: mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
            border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            backgroundImage: 'none'
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'dark' ? '0 1px 0 rgba(255,255,255,0.05)' : '0 1px 0 rgba(0,0,0,0.05)',
            backgroundColor: mode === 'dark' ? '#18181b' : '#ffffff',
            color: mode === 'dark' ? '#f8fafc' : '#333'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 6,
            backgroundImage: 'none',
            border: mode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : 'none'
          }
        }
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: mode === 'dark' ? '#334155 #0f172a' : undefined,
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              backgroundColor: 'transparent',
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: mode === 'dark' ? '#334155' : '#cbd5e1',
              minHeight: 24,
              border: mode === 'dark' ? '2px solid #0f172a' : '2px solid transparent',
              backgroundClip: 'content-box'
            },
            '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
              backgroundColor: mode === 'dark' ? '#475569' : '#94a3b8',
            },
          }
        }
      }
    },
  });

  return (
    <SystemConfigContext.Provider value={{ config, refreshConfig, isLoading, theme, mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SystemConfigContext.Provider>
  );
}