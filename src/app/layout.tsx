import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import ThemeRegistry from '@/theme/ThemeRegistry'; 
import SnackbarProviderWrapper from '@/components/SnackbarProviderWrapper';
import { SystemConfigProvider } from '@/contexts/SystemConfigContext'; 
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Projektboard Platform',
  description: 'Managed Kanban System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <AppRouterCacheProvider>
            {/* 1. ThemeRegistry (MUI Cache) */}
            <ThemeRegistry>
                {/* 2. System Config (Farben & Logik) */}
                <SystemConfigProvider>
                    {/* 3. Snackbar (Benachrichtigungen) */}
                    <SnackbarProviderWrapper>
                        {/* 4. Auth (User-Status) */}
                        <AuthProvider>
                            <CssBaseline />
                            {/* KEIN HEADER HIER - Nur der Inhalt */}
                            {children}
                        </AuthProvider>
                    </SnackbarProviderWrapper>
                </SystemConfigProvider>
            </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}