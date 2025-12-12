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
  theme: createTheme()
});

export const useSystemConfig = () => useContext(SystemConfigContext);

// --- PROVIDER ---
export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

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
      mode: 'light',
      primary: { main: config.primaryColor },
      secondary: { main: config.secondaryColor },
      background: { default: '#f4f6f8', paper: '#ffffff' },
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
          root: { boxShadow: 'none', '&:hover': { boxShadow: '0 2px 4px rgba(0,0,0,0.15)' } },
          contained: { borderRadius: 4 }
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 4, // Kantig
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.08)'
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
            backgroundColor: '#ffffff',
            color: '#333'
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
          paper: { borderRadius: 6 }
        }
      }
    },
  });

  return (
    <SystemConfigContext.Provider value={{ config, refreshConfig, isLoading, theme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SystemConfigContext.Provider>
  );
}