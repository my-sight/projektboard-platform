'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert
} from '@mui/material';
import { Refresh as RefreshIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { supabase } from '@/lib/supabaseClient';

interface AuditLogEntry {
    id: string;
    created_at: string;
    actor_id: string | null;
    action: string;
    target_id: string | null;
    details: any;
    profiles?: {
        full_name: string;
        email: string;
    }
}

export default function AuditLogViewer() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            // Join with profiles to get actor name
            const { data, error } = await supabase
                .from('audit_logs')
                .select(`
          *,
          profiles:actor_id (
            full_name,
            email
          )
        `)
                .order('created_at', { ascending: false })
                .limit(50); // Pagination could be added later

            if (error) throw error;
            setLogs(data || []);
        } catch (err: any) {
            console.error('Error fetching audit logs:', err);
            setError('Fehler beim Laden des Audit-Logs: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getActionColor = (action: string) => {
        if (action.includes('delete')) return 'error';
        if (action.includes('update') || action.includes('change')) return 'warning';
        return 'default';
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">System Protokoll</Typography>
                <IconButton onClick={fetchLogs} disabled={loading} color="primary">
                    <RefreshIcon />
                </IconButton>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading && logs.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Zeitpunkt</TableCell>
                                <TableCell>Akteur</TableCell>
                                <TableCell>Aktion</TableCell>
                                <TableCell>Ziel (ID)</TableCell>
                                <TableCell align="right">Details</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                        Keine Einträge vorhanden.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} hover>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</TableCell>
                                        <TableCell>
                                            {log.profiles ? (
                                                <Box>
                                                    <Typography variant="body2" fontWeight={500}>{log.profiles.full_name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{log.profiles.email}</Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="caption" fontStyle="italic">System / Unbekannt</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={log.action}
                                                size="small"
                                                color={getActionColor(log.action) as any}
                                                variant="outlined"
                                                sx={{ textTransform: 'uppercase', fontSize: '0.7rem' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {log.target_id || '-'}
                                        </TableCell>
                                        <TableCell align="right">
                                            {log.details && Object.keys(log.details).length > 0 && (
                                                <Tooltip title={<pre style={{ fontSize: '0.7em' }}>{JSON.stringify(log.details, null, 2)}</pre>}>
                                                    <IconButton size="small">
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
