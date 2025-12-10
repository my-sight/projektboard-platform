'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  CircularProgress,
  Typography,
  Divider,
  Stack,
  Chip
} from '@mui/material';
import { SettingsSuggest } from '@mui/icons-material';
import UserManagement from '@/components/admin/UserManagement';
import SystemBranding from '@/components/admin/SystemBranding';
import { isSuperuserEmail } from '@/constants/superuser';
import { pb } from '@/lib/pocketbase';

export default function AdminPage() {
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth state from PocketBase
    if (pb.authStore.isValid && pb.authStore.model) {
      const email = pb.authStore.model.email;
      // We can also check role if available
      const role = (pb.authStore.model as any)?.role;

      if (email && isSuperuserEmail(email)) {
        setIsSuperUser(true);
      } else if (role === 'admin' && email && isSuperuserEmail(email)) {
        // Double check supersu email logic
        setIsSuperUser(true);
      }
    }
    setLoading(false);
  }, []);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  // Optionally redirect if not logged in? UserManagement handles its own checks?
  // UserManagement likely just shows list if valid.

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

            {/* Datenbank Tools removed as we are now on PocketBase (managed via PB Admin UI) */}
          </Stack>
        </Box>
      )}

    </Container>
  );
}