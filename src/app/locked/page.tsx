'use client';

import { Box, Button, Container, Typography } from '@mui/material';
import { Lock } from '@mui/icons-material';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LockedPage() {
    const { t } = useLanguage();

    return (
        <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <Lock sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h4" gutterBottom fontWeight="bold">
                {t('system.lockedTitle') || 'System Locked'}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                {t('system.lockedMessage') || 'The system is currently locked for maintenance. Please contact your administrator.'}
            </Typography>
            <Box sx={{ mt: 4 }}>
                <Button variant="outlined" onClick={() => window.location.href = '/login'}>
                    {t('auth.login') || 'Login'}
                </Button>
            </Box>
        </Container>
    );
}
