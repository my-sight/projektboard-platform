
import { Box } from '@mui/material';

interface CompletionDialProps {
    steps: number;
    onClick: () => void;
    disabled?: boolean;
}

export function CompletionDial({
    steps,
    onClick,
    disabled,
}: CompletionDialProps) {
    const clamped = Math.max(0, Math.min(4, steps || 0));
    const angle = (clamped / 4) * 360;
    const background = `conic-gradient(#4caf50 0deg ${angle}deg, #e0e0e0 ${angle}deg 360deg)`;

    return (
        <Box
            onClick={disabled ? undefined : onClick}
            sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '1px solid',
                borderColor: 'divider',
                backgroundImage: background,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'transform 0.2s ease',
                '&:hover': disabled
                    ? undefined
                    : {
                        transform: 'scale(1.05)',
                    },
            }}
        />
    );
}
