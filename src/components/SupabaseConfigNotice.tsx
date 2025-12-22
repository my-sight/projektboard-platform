'use client';

import { Alert, AlertTitle, Box, Link, Typography } from '@mui/material';

interface SupabaseConfigNoticeProps {
  title?: string;
  description?: string;
  hintUrl?: string;
}

const DEFAULT_DESCRIPTION =
  'Bitte hinterlege die Umgebungsvariablen NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY, ' +
  'damit die Anwendung eine Verbindung zu Supabase aufbauen kann.';

export default function SupabaseConfigNotice({
  title = 'Supabase-Konfiguration fehlt',
  description = DEFAULT_DESCRIPTION,
  hintUrl,
}: SupabaseConfigNoticeProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 640, mx: 'auto', mt: 6 }}>
      <Alert severity="error" variant="filled" sx={{ alignItems: 'flex-start' }}>
        <AlertTitle>{title}</AlertTitle>
        <Typography component="p" sx={{ mb: hintUrl ? 1.5 : 0 }}>
          {description}
        </Typography>
        {hintUrl ? (
          <Typography component="p">
            <Link href={hintUrl} target="_blank" rel="noreferrer" sx={{ color: 'inherit', textDecoration: 'underline' }}>
              Weitere Informationen anzeigen
            </Link>
          </Typography>
        ) : null}
      </Alert>
    </Box>
  );
}
