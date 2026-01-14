'use client';

import { Box, Card, CardContent, Typography, Grid, Paper } from '@mui/material';
import LoginForm from '@/components/auth/LoginForm';
import { useSystemConfig } from '@/contexts/SystemConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
  const { config } = useSystemConfig();
  const { t } = useLanguage();

  return (
    <Grid container sx={{ height: '100vh' }}>

      {/* Linke Seite: Bild */}
      <Grid item xs={false} sm={4} md={7}
        sx={{
          backgroundImage: 'url(https://source.unsplash.com/random?office)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {config.logoUrl && (
          <Box
            component="img"
            src={config.logoUrl}
            alt={config.appName}
            sx={{
              maxWidth: '60%',
              maxHeight: '40%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.8))',
              zIndex: 1
            }}
          />
        )}
        <Box sx={{ position: 'absolute', bottom: 40, left: 40, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)', zIndex: 1 }}>
          <Typography variant="h3" fontWeight="bold">{config.appName}</Typography>
        </Box>
        {/* Overlay for better readability */}
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)' }} />
      </Grid>

      {/* Rechte Seite: Login */}
      <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ my: 8, mx: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 450 }}>



          <Card variant="outlined" sx={{ width: '100%', borderRadius: 3, p: 2 }}>
            <CardContent>
              <Typography component="h1" variant="h5" sx={{ mb: 3, textAlign: 'center', fontWeight: 600 }}>
                {t('auth.loginTitle')}
              </Typography>
              <LoginForm />
            </CardContent>
          </Card>
        </Box>
      </Grid>
    </Grid>
  );
}