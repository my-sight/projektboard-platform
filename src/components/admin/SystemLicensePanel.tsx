
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
import { LicenseStatus } from '@/lib/license';
import { checkLicenseServerAction, saveLicenseTokenAction } from '@/app/actions/license';
import { supabase } from '@/lib/supabaseClient';

export default function SystemLicensePanel() {
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [userCount, setUserCount] = useState<number | null>(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        const s = await checkLicenseServerAction();
        setStatus(s as LicenseStatus);
        if (s.valid && s.maxUsers) {
            const { data: profiles } = await supabase.from('profiles').select('email');
            if (profiles) {
                const { isSuperuserEmail } = await import('@/constants/superuser');
                const currentCount = profiles.filter(p => !isSuperuserEmail(p.email)).length;
                setUserCount(currentCount);
            }
        }
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            const result = await saveLicenseTokenAction(token.trim());
            if (!result.success) throw new Error(result.error);
            await loadStatus();
            setMsg('Lizenz erfolgreich aktualisiert!');
            setToken('');
        } catch (e: any) {
            setMsg('Fehler: ' + e.message);
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
                <Typography variant="h6">System-Lizenz</Typography>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Aktueller Status</Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ mr: 1, fontWeight: 'bold' }}>Kunde:</Typography>
                            <Typography>{status.customer || 'Unbekannt'}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ mr: 1, fontWeight: 'bold' }}>Gültig bis:</Typography>
                            <Typography>{status.expiry || 'Nie'}</Typography>
                        </Box>

                        {status.maxUsers && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Typography sx={{ mr: 1, fontWeight: 'bold' }}>Benutzer:</Typography>
                                <Typography>
                                    {userCount !== null ? `${userCount} / ` : ''}{status.maxUsers}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ mt: 2 }}>
                            {status.valid ? (
                                <Chip
                                    icon={<CheckCircle />}
                                    label={`Gültig (${getDaysRemaining()} Tage verbleibend)`}
                                    color="success"
                                    variant="outlined"
                                />
                            ) : (
                                <Chip
                                    icon={<Warning />}
                                    label="Ungültig / Abgelaufen"
                                    color="error"
                                    variant="filled"
                                />
                            )}
                        </Box>
                    </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Lizenz aktualisieren</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Lizenzschlüssel hier einfügen..."
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
                        Lizenz speichern
                    </Button>
                    {msg && (
                        <Alert severity={msg.startsWith('Error') || msg.startsWith('Fehler') ? 'error' : 'success'} sx={{ mt: 1 }}>
                            {msg.replace('License updated successfully!', 'Lizenz erfolgreich aktualisiert!').replace('Error:', 'Fehler:')}
                        </Alert>
                    )}
                </Grid>
            </Grid>
        </Paper>
    );
}
