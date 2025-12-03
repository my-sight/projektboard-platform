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
    setMounted(true);
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme-mode');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else {
      setIsDark(prefersDarkMode);
    }
  }, [prefersDarkMode]);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('theme-mode', newMode ? 'dark' : 'light');
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </LocalizationProvider>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <ThemeProvider theme={isDark ? theme : lightTheme}>
          {children}
        </ThemeProvider>
      </LocalizationProvider>
    </ThemeContext.Provider>
  );
}
