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

import SystemLicensePanel from '@/components/admin/SystemLicensePanel';
import { isSuperuserEmail } from '@/constants/superuser';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPage() {
  const { user, isSuperuser, loading: authLoading } = useAuth();

  if (authLoading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>

      {/* 1. Benutzer & Abteilungen (Für alle Admins) */}
      <UserManagement isSuperUser={isSuperuser} />

      {/* 2. System-Bereich (Nur für Superuser) */}
      {isSuperuser && (
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



            {/* License Panel */}
            <Box>
              <SystemLicensePanel />
            </Box>
          </Stack>
        </Box>
      )}

    </Container>
  );
}