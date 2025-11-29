'use client';

import { useState } from 'react';
import { 
  Box, Button, Card, CardContent, Typography, LinearProgress, 
  Chip, Divider, Stack 
} from '@mui/material';
import { PlayArrow, Build, CheckCircle, Warning, Search, BugReport } from '@mui/icons-material';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { fetchClientProfiles } from '@/lib/clientProfiles';
import { useSnackbar } from 'notistack';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice'; // Falls Client fehlt

export default function MigrationTool() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, ok: 0, fixable: 0, unknown: 0 });

  const supabase = getSupabaseBrowserClient();
  const { enqueueSnackbar } = useSnackbar();

  // Sicherstellen, dass supabase da ist
  if (!supabase) {
      return <SupabaseConfigNotice />;
  }

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 50));

  const tokenize = (text: any) => {
    if (!text) return [];
    return String(text).toLowerCase()
      .split(/[\s,._-]+/)
      .filter(t => t.length >= 2);
  };

  const runScan = async () => {
    setScanning(true);
    setCandidates([]);
    setLogs([]);
    setProgress(0);
    
    try {
      addLog('Lade User-Profile...');
      const profiles = await fetchClientProfiles();
      
      const userIndex = profiles.map(u => {
        const tokens = new Set<string>();
        if (u.email) tokenize(u.email).forEach(t => tokens.add(t));
        if (u.full_name) tokenize(u.full_name).forEach(t => tokens.add(t));
        if (u.name) tokenize(u.name).forEach(t => tokens.add(t));
        
        return {
          id: u.id,
          email: u.email,
          name: u.full_name || u.name || u.email,
          tokens: Array.from(tokens),
          rawIds: [u.id, u.email?.toLowerCase()].filter(Boolean)
        };
      });

      addLog(`${userIndex.length} User geladen. Lade Karten...`);
      
      // Hier ist der Fix: supabase ist sicher nicht null durch den Check oben
      const { data: cards, error } = await supabase.from('kanban_cards').select('*');
      
      if (error) throw error;
      if (!cards) throw new Error("Keine Karten gefunden");

      addLog(`${cards.length} Karten geladen.`);

      const newCandidates: any[] = [];
      let s_ok = 0, s_fix = 0, s_unk = 0;

      cards.forEach((card, idx) => {
        if (idx % 50 === 0) setProgress((idx / cards.length) * 100);

        let d = card.card_data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
        d = d || {};

        if (d.userId || d.assigneeId) { s_ok++; return; }

        const respText = d.Verantwortlich || d.responsible || d.assigneeName;
        if (!respText) { s_ok++; return; }

        const rawText = String(respText).toLowerCase().trim();
        const cardTokens = tokenize(rawText);

        let match = userIndex.find(u => u.rawIds.includes(rawText));

        if (!match && cardTokens.length > 0) {
            match = userIndex.find(u => {
                const matches = cardTokens.filter(token => u.tokens.includes(token));
                if (matches.length === 0) return false;
                const cardIsSubset = matches.length === cardTokens.length;
                const userIsSubset = matches.length === u.tokens.length;
                return cardIsSubset || userIsSubset;
            });
        }

        if (match) {
            s_fix++;
            newCandidates.push({
                cardId: card.card_id,
                cardTitle: d.Nummer ? `${d.Nummer} ${d.Teil}` : (d.description || 'Unbenannt'),
                currentText: respText,
                matchedUser: match,
                originalData: d
            });
        } else {
            s_unk++;
        }
      });

      setCandidates(newCandidates);
      setStats({ total: cards.length, ok: s_ok, fixable: s_fix, unknown: s_unk });
      setProgress(100);
      addLog(`Scan beendet. ${s_fix} Karten eindeutig zuordenbar.`);

    } catch (err: any) {
      addLog(`Fehler: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const runFix = async () => {
      if (candidates.length === 0) return;
      setFixing(true);
      setProgress(0);
      addLog('Starte Reparatur...');

      let fixed = 0;
      for (let i = 0; i < candidates.length; i++) {
          const item = candidates[i];
          const user = item.matchedUser;
          
          try {
              const updatedData = {
                  ...item.originalData,
                  userId: user.id,
                  assigneeId: user.id,
                  email: user.email,
                  Verantwortlich: user.name 
              };

              await supabase.from('kanban_cards')
                .update({ card_data: updatedData, updated_at: new Date().toISOString() })
                .eq('card_id', item.cardId);

              fixed++;
          } catch (e) { console.error(e); }
          
          if (i % 10 === 0) setProgress((i / candidates.length) * 100);
      }

      addLog(`Fertig! ${fixed} Karten repariert.`);
      enqueueSnackbar(`${fixed} Karten repariert und gespeichert`, { variant: 'success' });

      setCandidates([]);
      setFixing(false);
      setProgress(100);
      setStats(prev => ({ ...prev, ok: prev.ok + fixed, fixable: 0 }));
  };

  return (
    <Card variant="outlined" sx={{ mt: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Build color="primary" /> Datenbank-Migration (Strikter Modus)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Scannt Karten und weist User-IDs zu. Nutzt strikte Logik.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button variant="contained" startIcon={<Search />} onClick={runScan} disabled={scanning || fixing}>
                {scanning ? 'Scanne...' : 'Datenbank Scannen'}
            </Button>
            <Button variant="contained" color="success" startIcon={<PlayArrow />} onClick={runFix} disabled={scanning || fixing || candidates.length === 0}>
                {candidates.length} Karten reparieren
            </Button>
        </Stack>

        {(scanning || fixing) && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />}

        {stats.total > 0 && (
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Chip icon={<CheckCircle />} label={`OK: ${stats.ok}`} color="success" variant="outlined" />
                <Chip icon={<Build />} label={`Reparierbar: ${stats.fixable}`} color={stats.fixable > 0 ? "warning" : "default"} />
                <Chip icon={<Warning />} label={`Unbekannt/Mehrdeutig: ${stats.unknown}`} color={stats.unknown > 0 ? "error" : "default"} variant="outlined" />
            </Stack>
        )}

        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
            {candidates.length > 0 && !fixing && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BugReport fontSize="small" /> Vorschau (Bitte prüfen!):
                    </Typography>
                    {candidates.slice(0, 10).map((c, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', py: 0.5 }}>
                           <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                               &quot;{c.currentText}&quot;
                           </Typography>
                           <Typography variant="caption">➔</Typography>
                           <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>
                               {c.matchedUser.name}
                           </Typography>
                        </Box>
                    ))}
                    {candidates.length > 10 && <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>... und {candidates.length - 10} weitere.</Typography>}
                    <Divider sx={{ my: 1 }} />
                </Box>
            )}
            
            <Typography variant="subtitle2">System Log:</Typography>
            {logs.map((log, i) => <Typography key={i} variant="caption" display="block" color="text.secondary">{log}</Typography>)}
        </Box>
      </CardContent>
    </Card>
  );
}