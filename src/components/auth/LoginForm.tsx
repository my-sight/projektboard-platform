'use client';

import { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper, Tabs, Tab } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

export const LoginForm = () => {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = tab === 0 
      ? await signIn(email, password)
      : await signUp(email, password);

    if (error) {
      setError(error.message);
    } else if (tab === 1) {
      setError('Registrierung erfolgreich! Bitte E-Mail bestätigen.');
    }

    setLoading(false);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Paper sx={{ width: 400, p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, textAlign: 'center' }}>
          🔐 Kanban Board
        </Typography>
        
        <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} centered sx={{ mb: 3 }}>
          <Tab label="Anmelden" />
          <Tab label="Registrieren" />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <TextField
            fullWidth
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ backgroundColor: '#14c38e', '&:hover': { backgroundColor: '#0ea770' } }}
          >
            {loading ? '⏳ Wird verarbeitet...' : (tab === 0 ? '🔓 Anmelden' : '🆕 Registrieren')}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};
