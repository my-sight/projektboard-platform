
'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Alert,
    Chip,
    Grid
} from '@mui/material';
import { VpnKey, CheckCircle, Warning, Cached } from '@mui/icons-material';
import { saveLicenseToken, getLicenseStatus, LicenseStatus } from '@/lib/license';

export default function SystemLicensePanel() {
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        const s = await getLicenseStatus();
        setStatus(s);
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            await saveLicenseToken(token.trim());
            await loadStatus();
            setMsg('License updated successfully!');
            setToken('');
        } catch (e: any) {
            setMsg('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const getDaysRemaining = () => {
        if (!status?.expiry) return 0;
        const diff = new Date(status.expiry).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    if (!status) return null;

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VpnKey sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">System License</Typography>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Current Status</Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ mr: 1, fontWeight: 'bold' }}>Customer:</Typography>
                            <Typography>{status.customer || 'Unknown'}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ mr: 1, fontWeight: 'bold' }}>Expires:</Typography>
                            <Typography>{status.expiry || 'Never'}</Typography>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            {status.valid ? (
                                <Chip
                                    icon={<CheckCircle />}
                                    label={`Valid (${getDaysRemaining()} days left)`}
                                    color="success"
                                    variant="outlined"
                                />
                            ) : (
                                <Chip
                                    icon={<Warning />}
                                    label="Invalid / Expired"
                                    color="error"
                                    variant="filled"
                                />
                            )}
                        </Box>
                    </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Update License</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Paste new license token here..."
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        multiline
                        rows={3}
                        sx={{ mb: 1 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleUpdate}
                        disabled={loading || !token}
                        startIcon={<Cached />}
                    >
                        Update License
                    </Button>
                    {msg && (
                        <Alert severity={msg.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 1 }}>
                            {msg}
                        </Alert>
                    )}
                </Grid>
            </Grid>
        </Paper>
    );
}
