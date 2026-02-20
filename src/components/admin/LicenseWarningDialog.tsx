'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Alert } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getLicenseStatus } from '@/lib/license';

export default function LicenseWarningDialog() {
    const { isAdmin, loading } = useAuth();
    const [open, setOpen] = useState(false);
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
    const [expiryDate, setExpiryDate] = useState<string | null>(null);

    useEffect(() => {
        // Only run for Admins, once Auth is ready
        console.log('[LicenseWarning] Check 1: Loading:', loading, 'Admin:', isAdmin);
        if (loading || !isAdmin) return;

        // Prevent showing twice in a session? Maybe not needed for now.
        // If we want to show it once per session, we can use sessionStorage.
        const hasSeenWarning = sessionStorage.getItem('license_warning_seen');
        // console.log('[LicenseWarning] Seen?', hasSeenWarning); 
        // TEMPORARILY DISABLED SESSION CHECK FOR DEBUGGING
        // if (hasSeenWarning) return;

        const checkUsage = async () => {
            try {
                const status = await getLicenseStatus();
                console.log('[LicenseWarning] Status:', status);

                if (status.valid && status.expiry) {
                    const expiry = new Date(status.expiry);
                    const now = new Date();
                    const diffTime = expiry.getTime() - now.getTime();
                    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    console.log('[LicenseWarning] Days Remaining:', days);

                    if (days < 40) {
                        setDaysRemaining(days);
                        setExpiryDate(status.expiry);
                        setOpen(true);
                        // sessionStorage.setItem('license_warning_seen', 'true');
                    }
                }
            } catch (e) {
                console.error('License warning check failed', e);
            }
        };

        checkUsage();
    }, [isAdmin, loading]);

    if (!open || daysRemaining === null) return null;

    // Severity based on days
    const severity = daysRemaining < 14 ? 'error' : 'warning';

    return (
        <Dialog open={open} onClose={() => setOpen(false)}>
            <DialogTitle color={severity === 'error' ? 'error' : 'warning.main'}>
                {daysRemaining < 0 ? 'Lizenz abgelaufen!' : 'Lizenz läuft bald ab'}
            </DialogTitle>
            <DialogContent>
                <DialogContentText paragraph>
                    {daysRemaining < 0 ? (
                        <>Die Lizenz ist am <strong>{new Date(expiryDate!).toLocaleDateString('de-DE')}</strong> abgelaufen.</>
                    ) : (
                        <>Die Lizenz für diese Instanz läuft in <strong>{daysRemaining} Tagen</strong> ab.</>
                    )}
                </DialogContentText>
                <Alert severity={severity}>
                    Bitte kontaktieren Sie den Support oder verlängern Sie Ihre Lizenz, um Unterbrechungen zu vermeiden.
                </Alert>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)} color="primary">
                    Verstanden
                </Button>
            </DialogActions>
        </Dialog>
    );
}
