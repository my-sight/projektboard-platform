'use client';

import { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    TextField,
    Button,
    Alert,
    Stack,
    Divider
} from '@mui/material';
import { AccessTime, LockClock } from '@mui/icons-material';
import { pb } from '@/lib/pocketbase';
import dayjs from 'dayjs';
import 'dayjs/locale/de';

export default function SystemLockoutPanel() {
    const [enabled, setEnabled] = useState(false);
    const [lockoutTime, setLockoutTime] = useState<string>('');
    const [message, setMessage] = useState('');
    const [serverTime, setServerTime] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const fetchSettings = async () => {
        try {
            const record = await pb.collection('system_settings').getFirstListItem('key="lockout"');
            if (record && record.value) {
                setEnabled(!!record.value.enabled);

                // Format for datetime-local input: YYYY-MM-DDTHH:mm
                if (record.value.lockoutTime) {
                    setLockoutTime(dayjs(record.value.lockoutTime).format('YYYY-MM-DDTHH:mm'));
                }
                setMessage(record.value.message || '');

                // Approximate server time from record update if available, or just show client time as reference
                // Better: Use the updated timestamp of the record as a "last known server time" reference
                setServerTime(new Date(record.updated).toLocaleString());
            }
        } catch (e) {
            console.log('No lockout settings found, using defaults.');
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        setSuccess('');
        try {
            const payload = {
                enabled,
                lockoutTime: lockoutTime ? new Date(lockoutTime).toISOString() : null,
                message
            };

            // Check if exists
            try {
                const record = await pb.collection('system_settings').getFirstListItem('key="lockout"');
                await pb.collection('system_settings').update(record.id, { value: payload });
            } catch {
                await pb.collection('system_settings').create({ key: 'lockout', value: payload });
            }

            setSuccess('Einstellungen gespeichert. Serverzeit aktualisiert.');
            fetchSettings(); // Refresh to get new 'updated' time
        } catch (e: any) {
            alert('Fehler beim Speichern: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LockClock color="primary" />
                        <Typography variant="h6">System-Sperre (Timer)</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        Hier können Sie einen Zeitpunkt festlegen, ab dem das System für alle Nicht-Superuser gesperrt wird.
                        Die Prüfung erfolgt basierend auf der <strong>Serverzeit</strong>, um Manipulationen zu verhindern.
                    </Typography>

                    <Divider />

                    <FormControlLabel
                        control={<Switch checked={enabled} onChange={e => setEnabled(e.target.checked)} />}
                        label={enabled ? "Sperre AKTIV (Timer läuft)" : "Sperre DEAKTIVIERT"}
                    />

                    <TextField
                        label="Sperr-Zeitpunkt (Serverzeit)"
                        type="datetime-local"
                        value={lockoutTime}
                        onChange={(e) => setLockoutTime(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        disabled={!enabled}
                    />

                    {serverTime && (
                        <Typography variant="caption" color="text.secondary">
                            Letzter Server-Sync: {serverTime}
                        </Typography>
                    )}

                    <Button variant="contained" onClick={handleSave} disabled={loading}>
                        {loading ? 'Speichere...' : 'Speichern'}
                    </Button>

                    {success && <Alert severity="success">{success}</Alert>}

                    {enabled && lockoutTime && (
                        <Alert severity="warning">
                            Achtung: Ab <strong>{new Date(lockoutTime).toLocaleString()}</strong> wird das System gesperrt sein.
                        </Alert>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
