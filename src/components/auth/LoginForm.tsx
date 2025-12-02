'use client';

import { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Alert, 
  CircularProgress 
} from '@mui/material';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Erfolgreicher Login -> Weiterleitung passiert oft automatisch durch Auth-Listener
      // oder wir machen es manuell:
      window.location.href = '/';
      
    } catch (err: any) {
      setError(err.message || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Optional: Magic Link Login
  const handleMagicLink = async () => {
      if (!email) {
          setError('Bitte E-Mail eingeben für Magic Link');
          return;
      }
      if (!supabase) return;
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ email });
      setLoading(false);
      if (error) setError(error.message);
      else setMessage('Magic Link gesendet! Bitte Postfach prüfen.');
  };

  return (
    <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label="E-Mail Adresse"
        name="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="Passwort"
        type="password"
        id="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2 }}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} /> : 'Anmelden'}
      </Button>
      
      <Button
        fullWidth
        variant="text"
        onClick={handleMagicLink}
        disabled={loading || !email}
      >
        Login mit Magic Link
      </Button>
    </Box>
  );
}