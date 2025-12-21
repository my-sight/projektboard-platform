'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export default function DebugOverlay() {
    const { user, profile, loading, signOut } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const [apiStatus, setApiStatus] = useState<'testing' | 'ok' | 'fail'>('testing');
    // @ts-ignore - access private for debug
    const supabaseUrl = supabase['supabaseUrl'];

    useEffect(() => {
        setMounted(true);
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;

        const addLog = (msg: string) => {
            setLogs(prev => [msg.substring(0, 80), ...prev].slice(0, 8));
        };

        console.log = (...args) => {
            if (typeof args[0] === 'string' && (args[0].includes('[Auth') || args[0].includes('[Dashboard') || args[0].includes('[Supabase'))) {
                addLog(`L: ${args[0]}`);
            }
            originalConsoleLog(...args);
        };
        console.warn = (...args) => {
            if (typeof args[0] === 'string' && (args[0].includes('[Auth') || args[0].includes('[Dashboard') || args[0].includes('[Supabase'))) {
                addLog(`W: ${args[0]}`);
            }
            originalConsoleWarn(...args);
        };
        console.error = (...args) => {
            if (typeof args[0] === 'string' && (args[0].includes('[Auth') || args[0].includes('[Dashboard') || args[0].includes('[Supabase'))) {
                addLog(`E: ${args[0]}`);
            }
            originalConsoleError(...args);
        };

        // Test connectivity to port 8000
        fetch(`${supabaseUrl}/auth/v1/health`)
            .then(res => setApiStatus(res.ok ? 'ok' : 'fail'))
            .catch(() => setApiStatus('fail'));

        return () => {
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
        };
    }, [supabaseUrl]);

    const handleReset = async () => {
        if (confirm('App-Cache wirklich zurücksetzen? Alle Sitzungen werden beendet.')) {
            localStorage.clear();
            sessionStorage.clear();
            // Try to clear cookies as well
            document.cookie.split(";").forEach(function (c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            await signOut();
            window.location.reload();
        }
    };

    if (!mounted) return null;

    return (
        <Box sx={{
            position: 'fixed',
            bottom: 10,
            right: 10,
            zIndex: 99999,
            bgcolor: 'rgba(0,0,0,0.95)',
            color: '#00ff00',
            p: 1.5,
            borderRadius: 1,
            fontSize: '10px',
            fontFamily: 'monospace',
            border: `1px solid ${apiStatus === 'ok' ? '#00ff00' : '#f44336'}`,
            width: 350,
            boxShadow: '0 0 30px rgba(0,0,0,0.5)',
            pointerEvents: 'auto'
        }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', mb: 1, borderBottom: '1px solid #333' }}>
                <span>NUC DIAGNOSTIC CENTER v2</span>
                <span style={{ color: loading ? '#ff9800' : '#4caf50' }}>{loading ? 'SYNCING' : 'LIVE'}</span>
            </Typography>

            <Box sx={{ mb: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 1 }}>
                <Box>
                    BASE: <span style={{ color: '#fff' }}>{typeof window !== 'undefined' ? window.location.origin : '...'}</span><br />
                    API: <span style={{ color: apiStatus === 'ok' ? '#00ff00' : '#f44336' }}>{supabaseUrl}</span><br />
                    CONN: <span style={{ color: apiStatus === 'ok' ? '#00ff00' : '#f44336' }}>{apiStatus.toUpperCase()}</span>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    USER: <span style={{ color: user ? '#fff' : '#f44336' }}>{user ? user.email?.split('@')[0] : 'NONE'}</span><br />
                    ROLE: <span style={{ color: profile ? '#fff' : '#f44336' }}>{profile ? profile.system_role : 'NONE'}</span>
                </Box>
            </Box>

            <Box sx={{ mb: 1.5, opacity: 0.9, backgroundColor: 'rgba(20,20,20,0.8)', p: 0.5, color: '#00ffcc', fontSize: '9px', height: 120, overflowY: 'auto', border: '1px solid #222' }}>
                {logs.map((l, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #1a1a1a', padding: '2px 0', wordBreak: 'break-all' }}>{l}</div>
                ))}
                {logs.length === 0 && 'Tracing enabled...'}
            </Box>

            <Button
                fullWidth
                size="small"
                variant="contained"
                color="warning"
                onClick={handleReset}
                sx={{
                    fontSize: '9px',
                    py: 0.5,
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px rgba(255, 152, 0, 0.3)'
                }}
            >
                HARD RESET & CLEAR SESSION
            </Button>
        </Box>
    );
}
