'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createTheme, ThemeProvider, Theme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { pb } from '@/lib/pocketbase';
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
      const record = await pb.collection('system_settings').getFirstListItem('key="config"');
      if (record) {
        const val = record.value || {};
        const logoUrl = record.logo ? pb.files.getUrl(record, record.logo) : (val.logoUrl || null);
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