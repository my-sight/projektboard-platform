// src/components/SnackbarProviderWrapper.tsx
'use client';

import { SnackbarProvider } from 'notistack';
import { styled } from '@mui/material/styles';

const StyledSnackbarProvider = styled(SnackbarProvider)(({ theme }) => ({
  '&.notistack-MuiContent': {
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.9rem',
    borderRadius: theme.shape.borderRadius,
  },
  '&.notistack-MuiContent-success': {
    backgroundColor: theme.palette.success.dark,
  },
  '&.notistack-MuiContent-error': {
    backgroundColor: theme.palette.error.dark,
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