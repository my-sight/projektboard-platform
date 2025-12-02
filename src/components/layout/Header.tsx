'use client';

import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useSystemConfig } from '@/contexts/SystemConfigContext';
import Link from 'next/link';

export default function Header() {
  const { config } = useSystemConfig(); 

  return (
    <AppBar position="static" color="inherit" elevation={1}>
      <Toolbar>
        {/* Logo Bereich */}
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {config.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                    src={config.logoUrl} 
                    alt={config.appName} 
                    style={{ height: 40, objectFit: 'contain' }} 
                />
            ) : null}
            
            <Typography variant="h6" component="div" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {config.appName}
            </Typography>
        </Link>

        <Box sx={{ flexGrow: 1 }} />
        
        <Button color="inherit" href="/login">Login</Button>
      </Toolbar>
    </AppBar>
  );
}