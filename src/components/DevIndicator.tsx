'use client';

import { Box, Typography, Tooltip } from '@mui/material';
import { Extension } from '@mui/icons-material';

export default function DevIndicator() {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                bottom: 16,
                right: 16, // User requested Bottom Right
                zIndex: 9999,
                pointerEvents: 'none', // Allow clicking through most of it, but maybe we want to hover?
                // Actually, if we want to hover, pointerEvents should be auto on the badge itself.
                display: 'flex',
                alignItems: 'center',
                gap: 1
            }}
        >
            <Tooltip title="Development Environment (Localhost)">
                <Box
                    sx={{
                        pointerEvents: 'auto',
                        bgcolor: '#e91e63', // Pink
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(233, 30, 99, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}
                >
                    <Extension sx={{ fontSize: 16 }} />
                    LOCAL DEV
                </Box>
            </Tooltip>
        </Box>
    );
}
