'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, Container, Paper, Button } from '@mui/material';
import { SupervisorAccount, Build } from '@mui/icons-material';
import UserManagement from '@/components/admin/UserManagement';
import MigrationTool from '@/components/admin/MigrationTool';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { isSuperuserEmail } from '@/constants/superuser';

export default function AdminPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const checkAuth = async () => {
      // ✅ FIX: Prüfen, ob der Client existiert, bevor wir ihn nutzen
      if (!supabase) {
        router.push('/');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isSuperuserEmail(user.email || '')) {
        router.push('/');
        return;
      }
      setIsAuthorized(true);
    };
    checkAuth();
  }, [supabase, router]);

  if (!isAuthorized) return null;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Admin Bereich
        </Typography>
        <Button variant="outlined" onClick={() => router.push('/')}>Zurück zum Board</Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(e, v) => setTabIndex(v)}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab icon={<SupervisorAccount />} label="Benutzerverwaltung" />
          <Tab icon={<Build />} label="Daten-Migration" /> 
        </Tabs>
      </Paper>

      {tabIndex === 0 && <UserManagement />}
      
      {tabIndex === 1 && (
          <Box>
              <MigrationTool />
          </Box>
      )}

    </Container>
  );
}