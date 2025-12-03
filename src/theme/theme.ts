'use client';

import { createTheme, alpha } from '@mui/material/styles';

// Modern Dark Palette
const colors = {
  primary: {
    main: '#3b82f6', // Bright Blue
    light: '#60a5fa',
    dark: '#2563eb',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#10b981', // Emerald
    light: '#34d399',
    dark: '#059669',
    contrastText: '#ffffff',
  },
  background: {
    default: '#0f172a', // Slate 900
    paper: '#1e293b',   // Slate 800
    subtle: '#334155',  // Slate 700
  },
  text: {
    primary: '#f8fafc', // Slate 50
    secondary: '#94a3b8', // Slate 400
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },
  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
  },
  info: {
    main: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
  },
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    ...colors,
    divider: 'rgba(148, 163, 184, 0.12)',
  },
  typography: {
    fontFamily: '"Inter", "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, letterSpacing: '-0.025em' },
    h3: { fontWeight: 600, letterSpacing: '-0.025em' },
    h4: { fontWeight: 600, letterSpacing: '-0.025em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#334155 #0f172a',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: 'transparent',
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#334155',
            minHeight: 24,
            border: '2px solid #0f172a',
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: '#475569',
          },
          '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
            backgroundColor: '#475569',
          },
          '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          '&.glass': {
            backgroundColor: alpha(colors.background.paper, 0.7),
            backdropFilter: 'blur(12px)',
            border: `1px solid ${alpha(colors.text.secondary, 0.1)}`,
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(colors.background.paper, 0.6),
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(colors.text.secondary, 0.08)}`,
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          backgroundImage: `linear-gradient(to bottom right, ${colors.primary.main}, ${colors.primary.dark})`,
          '&:hover': {
            backgroundImage: `linear-gradient(to bottom right, ${colors.primary.light}, ${colors.primary.main})`,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        filled: {
          border: '1px solid transparent',
        },
        outlined: {
          borderWidth: 1,
        },
      },
    },
  },
});

export const lightTheme = createTheme({
  ...theme,
  palette: {
    mode: 'light',
    primary: colors.primary,
    secondary: colors.secondary,
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
  },
});

export default theme;
