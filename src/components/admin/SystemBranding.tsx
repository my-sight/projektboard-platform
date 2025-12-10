'use client';

import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button,
  Select, MenuItem, FormControl, InputLabel, Divider, Stack, CircularProgress
} from '@mui/material';
import { Save, CloudUpload, Refresh, ColorLens, Image as ImageIcon } from '@mui/icons-material';
import { useSystemConfig, defaultSettings } from '@/contexts/SystemConfigContext';
import { pb } from '@/lib/pocketbase';
import { useSnackbar } from 'notistack';

export default function SystemBranding() {
  const { config, refreshConfig } = useSystemConfig();
  const { enqueueSnackbar } = useSnackbar();

  const [localConfig, setLocalConfig] = useState(config);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setLocalConfig(config); }, [config]);

  const handleChange = (key: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const ensureConfigRecord = async () => {
    try {
      return await pb.collection('system_settings').getFirstListItem('key="config"');
    } catch {
      return await pb.collection('system_settings').create({ key: 'config', value: defaultSettings });
    }
  };

  const handleSave = async () => {
    try {
      const record = await ensureConfigRecord();
      await pb.collection('system_settings').update(record.id, {
        value: {
          primaryColor: localConfig.primaryColor,
          secondaryColor: localConfig.secondaryColor,
          fontFamily: localConfig.fontFamily,
          appName: localConfig.appName,
          logoUrl: localConfig.logoUrl // keep URL in json for fallback or explicitly null
        }
      });

      await refreshConfig();
      enqueueSnackbar('Design gespeichert!', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar('Fehler: ' + e.message, { variant: 'error' });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const record = await ensureConfigRecord();

      const formData = new FormData();
      formData.append('logo', file);

      const updated = await pb.collection('system_settings').update(record.id, formData);
      const url = pb.files.getUrl(updated, updated.logo);

      // Update local state and save config with new URL (optional, depends on if context prefers file url)
      setLocalConfig(prev => ({ ...prev, logoUrl: url }));

      enqueueSnackbar('Logo hochgeladen!', { variant: 'info' });
      refreshConfig();
    } catch (error: any) {
      enqueueSnackbar('Fehler: ' + error.message, { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mt: 4, mb: 10 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">🎨 Design & Branding</Typography>
          <Button startIcon={<Refresh />} onClick={() => setLocalConfig(config)}>Reset</Button>
        </Stack>

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>Farben</Typography>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <input type="color" value={localConfig.primaryColor} onChange={e => handleChange('primaryColor', e.target.value)} style={{ height: 40 }} />
                <TextField label="Hauptfarbe" value={localConfig.primaryColor} onChange={e => handleChange('primaryColor', e.target.value)} size="small" fullWidth />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <input type="color" value={localConfig.secondaryColor} onChange={e => handleChange('secondaryColor', e.target.value)} style={{ height: 40 }} />
                <TextField label="Akzentfarbe" value={localConfig.secondaryColor} onChange={e => handleChange('secondaryColor', e.target.value)} size="small" fullWidth />
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>App Details</Typography>
            <Stack spacing={2}>
              <TextField label="App-Name" value={localConfig.appName} onChange={e => handleChange('appName', e.target.value)} size="small" fullWidth />
              <FormControl fullWidth size="small">
                <InputLabel>Schriftart</InputLabel>
                <Select value={localConfig.fontFamily} label="Schriftart" onChange={e => handleChange('fontFamily', e.target.value)}>
                  <MenuItem value="Inter">Inter</MenuItem>
                  <MenuItem value="Roboto">Roboto</MenuItem>
                  <MenuItem value="Open Sans">Open Sans</MenuItem>
                  <MenuItem value="Montserrat">Montserrat</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>Logo</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ width: 150, height: 60, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {localConfig.logoUrl ? <img src={localConfig.logoUrl} alt="Logo" style={{ maxHeight: '100%', maxWidth: '100%' }} /> : <ImageIcon color="disabled" />}
              </Box>
              <Button variant="outlined" component="label" startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />} disabled={uploading}>
                Logo wählen
                <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Button variant="contained" size="large" startIcon={<Save />} onClick={handleSave}>Speichern</Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}