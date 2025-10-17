'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  company?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  created_at?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [editableNames, setEditableNames] = useState<Record<string, string>>({});

  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [usersResult, departmentsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('*')
          .order('name')
      ]);

      const { data: usersData, error: usersError } = usersResult;
      if (usersError) {
        console.error('❌ Users Error:', usersError);
        setMessage(`❌ User-Fehler: ${usersError.message}`);
        setUsers([]);
      } else {
        setUsers(usersData || []);
        const mappedNames: Record<string, string> = {};
        (usersData || []).forEach(profile => {
          mappedNames[profile.id] = profile.full_name || '';
        });
        setEditableNames(mappedNames);
      }

      const { data: departmentsData, error: departmentsError } = departmentsResult;
      if (departmentsError) {
        console.error('❌ Departments Error:', departmentsError);
        if (departmentsError.code === '42P01') {
          setMessage('❌ Tabelle "departments" nicht gefunden. Bitte in Supabase anlegen.');
        } else {
          setMessage(`❌ Abteilungs-Fehler: ${departmentsError.message}`);
        }
        setDepartments([]);
      } else {
        setDepartments(departmentsData || []);
      }
    } catch (error) {
      console.error('💥 Unerwarteter Fehler:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`❌ Unerwarteter Fehler: ${errorMessage}`);
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
      await loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      setMessage('❌ Fehler beim Aktualisieren der Rolle');
    }
  };

  const updateUserDepartment = async (userId: string, departmentName: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ company: departmentName || null })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev =>
        prev.map(profile =>
          profile.id === userId ? { ...profile, company: departmentName || null } : profile,
        ),
      );
      setMessage('✅ Abteilung erfolgreich aktualisiert!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Abteilung:', error);
      setMessage('❌ Fehler beim Aktualisieren der Abteilung');
    }
  };

  const updateUserName = async (userId: string, fullName: string) => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      const fallbackName = users.find(profile => profile.id === userId)?.full_name || '';
      setEditableNames(prev => ({ ...prev, [userId]: fallbackName }));
      setMessage('❌ Name darf nicht leer sein.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev =>
        prev.map(profile =>
          profile.id === userId ? { ...profile, full_name: trimmed } : profile,
        ),
      );
      setEditableNames(prev => ({ ...prev, [userId]: trimmed }));

      setMessage('✅ Benutzername erfolgreich aktualisiert!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Namens:', error);
      setMessage('❌ Fehler beim Aktualisieren des Namens');
    }
  };

  const handleInlineNameChange = (userId: string, value: string) => {
    setEditableNames(prev => ({ ...prev, [userId]: value }));
  };

  const addDepartment = async () => {
    if (!newDepartmentName.trim()) return;

    try {
      const name = newDepartmentName.trim();
      const { data, error } = await supabase
        .from('departments')
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setDepartments(prev => [...prev, data]);
      }

      setNewDepartmentName('');
      setDepartmentDialogOpen(false);
      setMessage('✅ Abteilung erfolgreich angelegt!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Anlegen der Abteilung:', error);
      setMessage('❌ Fehler beim Anlegen der Abteilung');
    }
  };

  const deleteDepartment = async (departmentId: string) => {
    if (!window.confirm('Abteilung wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;

      setDepartments(prev => prev.filter(department => department.id !== departmentId));
      setMessage('✅ Abteilung erfolgreich gelöscht!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Löschen der Abteilung:', error);
      setMessage('❌ Fehler beim Löschen der Abteilung');
    }
  };

  const createUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail.trim(),
        password: newUserPassword.trim()
      });

      if (error) throw error;

      if (data.user?.id) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: newUserEmail.trim(),
          full_name: newUserName.trim() || null,
          role: 'user',
          is_active: true,
          company: newUserDepartment || null
        });
      }

      setCreateUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserDepartment('');
      setMessage('✅ Benutzer erfolgreich erstellt!');
      await loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Fehler beim Benutzer anlegen:', err);
      setMessage(`❌ Fehler beim Erstellen: ${err.message ?? err}`);
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 4
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button variant="text" onClick={() => (window.location.href = '/')}>← Zurück</Button>
          <Typography variant="h4" component="h1">
            👥 User & Abteilungsverwaltung
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => setDepartmentDialogOpen(true)}>
            🏢 Neue Abteilung
          </Button>
          <Button variant="outlined" onClick={() => setCreateUserDialogOpen(true)}>
            👤 Neuer Benutzer
          </Button>
        </Box>
      </Box>

      {message && (
        <Alert severity={message.startsWith('✅') ? 'success' : 'error'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

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
                {departments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Abteilungen
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

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🏢 Abteilungen
          </Typography>
          {departments.length > 0 ? (
            <Grid container spacing={2}>
              {departments.map(department => (
                <Grid item xs={12} sm={6} md={4} key={department.id}>
                  <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {department.name}
                        </Typography>
                        {department.created_at && (
                          <Typography variant="caption" color="text.secondary">
                            Angelegt: {new Date(department.created_at).toLocaleDateString('de-DE')}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => deleteDepartment(department.id)}
                      >
                        Löschen
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Noch keine Abteilungen angelegt.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            👤 Alle Benutzer
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Benutzer</TableCell>
                  <TableCell>E-Mail</TableCell>
                  <TableCell>Abteilung</TableCell>
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
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <TextField
                            value={editableNames[userProfile.id] ?? userProfile.full_name ?? ''}
                            onChange={(e) => handleInlineNameChange(userProfile.id, e.target.value)}
                            onBlur={(e) => updateUserName(userProfile.id, e.target.value)}
                            size="small"
                            placeholder="Name eingeben"
                          />
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
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select
                          displayEmpty
                          value={userProfile.company || ''}
                          onChange={(e) => updateUserDepartment(userProfile.id, e.target.value)}
                        >
                          <MenuItem value="">
                            <em>Keine</em>
                          </MenuItem>
                          {departments.map((department) => (
                            <MenuItem key={department.id} value={department.name}>
                              {department.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
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

      <Dialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>👤 Neuen Benutzer anlegen</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="E-Mail"
            type="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="Passwort"
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            fullWidth
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Abteilung</InputLabel>
            <Select
              label="Abteilung"
              value={newUserDepartment}
              onChange={(e) => setNewUserDepartment(e.target.value)}
            >
              <MenuItem value="">
                <em>Keine</em>
              </MenuItem>
              {departments.map((department) => (
                <MenuItem key={department.id} value={department.name}>
                  {department.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={createUser}>Erstellen</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={departmentDialogOpen} onClose={() => setDepartmentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>🏢 Neue Abteilung anlegen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Abteilungsname"
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartmentDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={addDepartment}
            disabled={!newDepartmentName.trim()}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
