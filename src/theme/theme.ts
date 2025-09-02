'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4aa3ff',
      light: '#7bb8ff',
      dark: '#2458ff',
    },
    secondary: {
      main: '#19c37d',
      light: '#4dd396',
      dark: '#0ea667',
    },
    background: {
      default: '#0f1117',
      paper: '#141a22',
    },
    text: {
      primary: '#e6e8ee',
      secondary: '#9aa3b2',
    },
    divider: '#243042',
    error: {
      main: '#ff5a5a',
      light: '#ff8a8a',
      dark: '#d63031',
    },
    warning: {
      main: '#ffa500',
      light: '#ffb733',
      dark: '#ef6c00',
    },
    success: {
      main: '#19c37d',
      light: '#4dd396',
      dark: '#0ea667',
    },
  },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          },
        },
        outlined: {
          borderWidth: '1px',
          '&:hover': {
            borderWidth: '1px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

// Light Theme Variant
export const lightTheme = createTheme({
  ...theme,
  palette: {
    mode: 'light',
    primary: {
      main: '#2458ff',
      light: '#4aa3ff',
      dark: '#1a4bcc',
    },
    secondary: {
      main: '#0ea667',
      light: '#19c37d',
      dark: '#0b8a54',
    },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#0b1220',
      secondary: '#566175',
    },
    divider: '#e6eaf2',
    error: {
      main: '#d63031',
      light: '#ff5a5a',
      dark: '#a02828',
    },
    warning: {
      main: '#ef6c00',
      light: '#ffa500',
      dark: '#c55a00',
    },
    success: {
      main: '#0ea667',
      light: '#19c37d',
      dark: '#0b8a54',
    },
  },
});

export default theme;
