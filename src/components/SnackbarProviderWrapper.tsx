'use client';

import { SnackbarProvider } from 'notistack';
import { styled } from '@mui/material/styles';

// Optional: Styling anpassen, damit es zum Theme passt
const StyledSnackbarProvider = styled(SnackbarProvider)(({ theme }) => ({
  '&.notistack-MuiContent': {
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
  },
  '&.notistack-MuiContent-success': {
    backgroundColor: '#2e7d32', // Dunkles Grün
  },
  '&.notistack-MuiContent-error': {
    backgroundColor: '#d32f2f', // Dunkles Rot
  },
}));

export default function SnackbarProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StyledSnackbarProvider 
      maxSnack={3} 
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      autoHideDuration={3000}
    >
      {children}
    </StyledSnackbarProvider>
  );
}