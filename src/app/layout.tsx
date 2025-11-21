import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { ThemeRegistry } from './ThemeRegistry';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '../contexts/AuthContext';
import SnackbarProviderWrapper from '@/components/SnackbarProviderWrapper'; // ✅ NEU: Import für Toasts

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Kanban Board System',
  description: 'Modernes Kanban Board System für Projektmanagement',
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
          <ThemeRegistry>
            {/* ✅ Wrapper um AuthProvider und Content legen */}
            <SnackbarProviderWrapper>
              <AuthProvider>
                <CssBaseline />
                {children}
              </AuthProvider>
            </SnackbarProviderWrapper>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}