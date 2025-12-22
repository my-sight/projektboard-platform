import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import ThemeRegistry from '@/theme/ThemeRegistry';
import SnackbarProviderWrapper from '@/components/SnackbarProviderWrapper';
import { SystemConfigProvider } from '@/contexts/SystemConfigContext';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

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
    <html lang="de" suppressHydrationWarning>
      <body className={inter.className}>
        <AppRouterCacheProvider>
          {/* 1. ThemeRegistry (MUI Cache) */}
          <ThemeRegistry>
            {/* 2. System Config (Farben & Logik) */}
            <SystemConfigProvider>
              {/* 3. Language Provider (i18n) */}
              <LanguageProvider>
                {/* 4. Snackbar (Benachrichtigungen) */}
                <SnackbarProviderWrapper>
                  {/* 5. Auth (User-Status) */}
                  <AuthProvider>
                    <CssBaseline />
                    {/* KEIN HEADER HIER - Nur der Inhalt */}
                    {children}
                  </AuthProvider>
                </SnackbarProviderWrapper>
              </LanguageProvider>
            </SystemConfigProvider>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}