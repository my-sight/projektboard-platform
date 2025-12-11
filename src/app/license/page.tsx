
'use client';

import { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, useTheme } from '@mui/material';
import { VpnKey, CheckCircle } from '@mui/icons-material';
import { saveLicenseToken, getLicenseStatus } from '@/lib/license';
import { useRouter } from 'next/navigation';

export default function LicensePage() {
    const theme = useTheme();
    const router = useRouter();
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');

    const handleSubmit = async () => {
        setStatus('loading');
        try {
            // Clean the token: remove headers, whitespace, and take only the base64 part
            let cleanToken = token.trim();
            // Remove common copy-paste artifacts
            cleanToken = cleanToken.replace(/---.*?---/g, '').trim();
            // If user pasted the whole output, try to find the actual token (looks like eyJ...)
            const match = cleanToken.match(/eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_+/=]+/);
            if (match) {
                cleanToken = match[0];
            }

            await saveLicenseToken(cleanToken);
            setStatus('success');
            setMsg('License verified successfully! Redirecting...');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } catch (e: any) {
            setStatus('error');
            setMsg(e.message || 'Invalid License Key');
        }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: 'background.default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
        }}>
            <Paper elevation={0} sx={{
                p: 4,
                maxWidth: 400,
                width: '100%',
                textAlign: 'center',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'rgba(25, 25, 25, 0.4)',
                backdropFilter: 'blur(20px)'
            }}>
                <VpnKey sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />

                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Software License Required
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Please enter your license key to continue using this software.
                    This system operates offline and requires a valid subscription token.
                </Typography>

                {status === 'error' && (
                    <Alert severity="error" sx={{ mb: 2 }}>{msg}</Alert>
                )}

                {status === 'success' && (
                    <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
                        {msg}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    label="License Token"
                    multiline
                    rows={4}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    sx={{ mb: 3 }}
                    placeholder="eyJ..."
                    disabled={status === 'success'}
                />

                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleSubmit}
                    disabled={status === 'loading' || status === 'success' || !token}
                >
                    {status === 'loading' ? 'Verifying...' : 'Activate License'}
                </Button>
            </Paper>
        </Box>
    );
}
