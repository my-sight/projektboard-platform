'use client';

import { useEffect, useState } from 'react';
import { 
  Box, 
  Container, 
  CircularProgress, 
  Typography, 
  Divider,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import { Build, SettingsSuggest } from '@mui/icons-material';
import UserManagement from '@/components/admin/UserManagement';
import MigrationTool from '@/components/admin/MigrationTool';
import SystemBranding from '@/components/admin/SystemBranding'; // Branding importieren
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { isSuperuserEmail } from '@/constants/superuser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';

export default function AdminPage() {
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email && isSuperuserEmail(data.user.email)) {
        setIsSuperUser(true);
      }
      setLoading(false);
    });
  }, [supabase]);

  if (!supabase) return <SupabaseConfigNotice />;
  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      
      {/* 1. Benutzer & Abteilungen (Für alle Admins) */}
      <UserManagement isSuperUser={isSuperUser} />

      {/* 2. System-Bereich (Nur für Superuser) */}
      {isSuperUser && (
        <Box sx={{ mt: 8 }}>
          <Divider sx={{ my: 4 }}>
              <Chip label="SUPERUSER ZONE" color="error" variant="outlined" />
          </Divider>
          
          <Typography variant="h4" gutterBottom sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
             <SettingsSuggest fontSize="large" color="primary" /> System-Steuerung
          </Typography>

          <Stack spacing={6}>
              {/* Branding Panel */}
              <Box>
                  <SystemBranding />
              </Box>

              {/* Datenbank Tools */}
              <Box>
                  <Typography variant="h5" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Build color="warning" /> Datenbank-Wartung
                  </Typography>
                  <MigrationTool />
              </Box>
          </Stack>
        </Box>
      )}

    </Container>
  );
}

// Hilfskomponente für den Divider Chip, falls oben nicht importiert
import { Chip } from '@mui/material';