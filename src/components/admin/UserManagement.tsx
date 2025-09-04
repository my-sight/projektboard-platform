'use client';

import { useEffect, useState } from 'react';
import {
  Box, Typography, Container, Card, CardContent, Grid,
  Avatar, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper
} from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../contexts/AuthContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  created_at: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

const loadData = async () => {
  try {
    console.log('🔍 Starte Daten-Laden...');

    // Alle User laden
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('👥 Users geladen:', usersData?.length || 0);

    if (usersError) {
      console.error('❌ Users Error:', usersError);
      setMessage(`❌ User-Fehler: ${usersError.message}`);
      setUsers([]);
    } else {
      setUsers(usersData || []);
    }

    // Teams laden (einfacher)
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('🏢 Teams geladen:', teamsData?.length || 0);

    if (teamsError) {
      console.error('❌ Teams Error:', teamsError);
      setMessage(`❌ Team-Fehler: ${teamsError.message}`);
      setTeams([]);
    } else {
      // Vereinfachte Teams (ohne Member-Count erstmal)
      const teamsWithCounts = teamsData?.map(team => ({
        ...team,
        member_count: 0 // Erstmal 0, später können wir das richtig machen
      })) || [];
      
      setTeams(teamsWithCounts);
    }

    console.log('✅ Daten-Laden abgeschlossen');

  } catch (error) {
    console.error('💥 Unerwarteter Fehler:', error);
    setMessage(`❌ Unerwarteter Fehler: ${error.message}`);
  } finally {
    setLoading(false);
  }
};



  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setMessage('✅ Benutzerrolle erfolgreich aktualisiert!');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      setMessage('❌ Fehler beim Aktualisieren der Rolle');
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    try {
      const inviteCode = Math.random().toString(36).substring(2, 15);

      const { data, error } = await supabase
        .from('teams')
        .insert([
          {
            name: newTeamName.trim(),
            description: newTeamDescription.trim(),
            invite_code: inviteCode,
            created_by: user?.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Ersteller als Owner hinzufügen
      await supabase
        .from('team_members')
        .insert([
          {
            team_id: data.id,
            user_id: user?.id,
            role: 'owner'
          }
        ]);

      setCreateTeamDialogOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');
      setMessage('✅ Team erfolgreich erstellt!');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      setMessage('❌ Fehler beim Erstellen des Teams');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Typography variant="h6">🔄 Wird geladen...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          👥 User & Team Management
        </Typography>
        <Button variant="contained" onClick={() => setCreateTeamDialogOpen(true)}>
          ➕ Neues Team
        </Button>
      </Box>

      {/* Message */}
      {message && (
        <Alert severity={message.startsWith('✅') ? 'success' : 'error'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {users.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Benutzer gesamt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main">
                {users.filter(u => u.is_active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Benutzer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="info.main">
                {teams.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Teams
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="warning.main">
                {users.filter(u => u.role === 'admin').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Administratoren
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Users Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            👤 Alle Benutzer
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Benutzer</TableCell>
                  <TableCell>E-Mail</TableCell>
                  <TableCell>Rolle</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Registriert</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={userProfile.avatar_url} sx={{ width: 32, height: 32 }}>
                          {userProfile.full_name?.[0] || userProfile.email[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {userProfile.full_name || 'Unbekannt'}
                          </Typography>
                          {userProfile.company && (
                            <Typography variant="caption" color="text.secondary">
                              {userProfile.company}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{userProfile.email}</TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={userProfile.role}
                          onChange={(e) => updateUserRole(userProfile.id, e.target.value)}
                        >
                          <MenuItem value="user">User</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="guest">Guest</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={userProfile.is_active ? 'Aktiv' : 'Inaktiv'} 
                        color={userProfile.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(userProfile.created_at).toLocaleDateString('de-DE')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Teams Grid */}
      <Typography variant="h6" gutterBottom>
        👥 Teams
      </Typography>
      <Grid container spacing={3}>
        {teams.map((team) => (
          <Grid item xs={12} sm={6} md={4} key={team.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {team.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {team.description || 'Keine Beschreibung'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip label={`${team.member_count} Mitglieder`} size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(team.created_at).toLocaleDateString('de-DE')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Team Dialog */}
      <Dialog open={createTeamDialogOpen} onClose={() => setCreateTeamDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>👥 Neues Team erstellen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Team Name" fullWidth variant="outlined"
            value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} sx={{ mb: 2 }}
          />
          <TextField
            margin="dense" label="Beschreibung (optional)" fullWidth multiline rows={3} variant="outlined"
            value={newTeamDescription} onChange={(e) => setNewTeamDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTeamDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={createTeam} variant="contained" disabled={!newTeamName.trim()}>
            ✅ Erstellen
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
