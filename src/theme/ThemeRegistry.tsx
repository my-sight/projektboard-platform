'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import theme, { lightTheme } from './theme';

// Set global locale
dayjs.locale('de');

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme-mode');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else {
      setIsDark(prefersDarkMode);
    }
    setMounted(true);
  }, [prefersDarkMode]);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('theme-mode', newMode ? 'dark' : 'light');
  };

  // While not mounted, we render nothing to avoid hydration mismatch
  // OR we render the default server theme (dark) and accept a potential flash if client wants light.
  // BUT the className mismatch implies the generated CSS differs.
  // The safest way to avoid mismatch errors is to render the SAME theme initially.
  // If we render `theme` (dark) on server, we must render `theme` (dark) on client first render.

  const currentTheme = mounted ? (isDark ? theme : lightTheme) : theme;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <ThemeProvider theme={currentTheme}>
          {children}
        </ThemeProvider>
      </LocalizationProvider>
    </ThemeContext.Provider>
  );
}
