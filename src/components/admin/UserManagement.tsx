'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Paper,
  Switch,
  Stack,
  Tooltip,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { isSuperuserEmail } from '@/constants/superuser';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';

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

interface BoardSummary {
  id: string;
  name: string;
  boardType: 'standard' | 'team';
  boardAdminId: string | null;
}

function normalizeUserProfile(profile: any): UserProfile {
  return {
    id: profile.id,
    email: profile.email ?? '',
    full_name: profile.full_name ?? '',
    avatar_url: profile.avatar_url ?? undefined,
    bio: profile.bio ?? undefined,
    company: profile.company ?? null,
    role: profile.role ?? 'user',
    is_active: profile.is_active ?? true,
    created_at: profile.created_at ?? '',
  };
}

export default function UserManagement() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  if (!supabase) {
    return (
      <Box sx={{ p: 3 }}>
        <SupabaseConfigNotice />
      </Box>
    );
  }

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
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

  const postJson = useMemo(() => ({ 'Content-Type': 'application/json' }), []);

  const isProtectedUser = (userId: string): boolean => {
    const profile = users.find(entry => entry.id === userId);
    return isSuperuserEmail(profile?.email);
  };

  const guardSuperuser = (userId: string): boolean => {
    if (isProtectedUser(userId)) {
      setMessage('❌ Der Superuser kann nicht bearbeitet werden.');
      setTimeout(() => setMessage(''), 4000);
      return true;
    }

    return false;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [usersResult, departmentsResult, boardsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('*')
          .order('name'),
        supabase
          .from('kanban_boards')
          .select('id, name, settings, board_admin_id')
          .order('name', { ascending: true }),
      ]);

      const { data: usersData, error: usersError } = usersResult;
      if (usersError) {
        console.error('❌ Users Error:', usersError);
        setMessage(`❌ User-Fehler: ${usersError.message}`);
        setUsers([]);
      } else {
        const normalizedUsers = ((usersData as any[]) ?? []).map(normalizeUserProfile);
        setUsers(normalizedUsers);
        const mappedNames: Record<string, string> = {};
        normalizedUsers.forEach(profile => {
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

      const { data: boardsData, error: boardsError } = boardsResult;
      if (boardsError) {
        console.error('❌ Boards Error:', boardsError);
        setBoards([]);
        if (!boardsError.message.includes('permission')) {
          setMessage(`❌ Board-Fehler: ${boardsError.message}`);
        }
      } else {
        const normalizedBoards: BoardSummary[] = ((boardsData as any[]) ?? []).map((entry) => {
          const rawSettings =
            entry && typeof entry.settings === 'object' && entry.settings !== null
              ? (entry.settings as Record<string, unknown>)
              : {};
          const typeCandidate = rawSettings['boardType'];
          const typeValue =
            typeof typeCandidate === 'string' && typeCandidate.toLowerCase() === 'team'
              ? 'team'
              : 'standard';
          return {
            id: String(entry.id),
            name: String(entry.name ?? 'Unbenanntes Board'),
            boardType: typeValue,
            boardAdminId: typeof entry.board_admin_id === 'string' ? entry.board_admin_id : null,
          };
        });
        setBoards(normalizedBoards);
      }
    } catch (error) {
      console.error('💥 Unerwarteter Fehler:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`❌ Unerwarteter Fehler: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const mutateUser = async (
    userId: string,
    payload: Partial<Pick<UserProfile, 'full_name' | 'role' | 'company' | 'is_active'>>,
    successMessage: string,
  ) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: postJson,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const { error: errorMessage } = await response.json();
        throw new Error(errorMessage ?? 'Unbekannter Fehler');
      }

      const { data } = await response.json();

      setUsers(prev =>
        prev.map(profile => {
          if (profile.id !== userId) {
            return profile;
          }

          if (data) {
            return normalizeUserProfile({ ...profile, ...data });
          }

          return normalizeUserProfile({ ...profile, ...payload });
        }),
      );

      if ('full_name' in payload) {
        const updatedName =
          typeof payload.full_name === 'string'
            ? payload.full_name
            : (data?.full_name as string | null) ?? '';
        setEditableNames(prev => ({ ...prev, [userId]: updatedName ?? '' }));
      }

      setMessage(`✅ ${successMessage}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Benutzeraktualisierung fehlgeschlagen:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Fehler beim Aktualisieren der Benutzerdaten';
      setMessage(`❌ ${message}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    if (guardSuperuser(userId)) {
      return;
    }

    await mutateUser(userId, { role: newRole }, 'Benutzerrolle erfolgreich aktualisiert!');
  };

  const updateUserDepartment = async (userId: string, departmentName: string) => {
    if (guardSuperuser(userId)) {
      return;
    }

    await mutateUser(
      userId,
      { company: departmentName || null },
      'Abteilung erfolgreich aktualisiert!',
    );
  };

  const updateUserName = async (userId: string, fullName: string) => {
    if (guardSuperuser(userId)) {
      return;
    }

    const trimmed = fullName.trim();
    if (!trimmed) {
      const fallbackName = users.find(profile => profile.id === userId)?.full_name || '';
      setEditableNames(prev => ({ ...prev, [userId]: fallbackName }));
      setMessage('❌ Name darf nicht leer sein.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    await mutateUser(userId, { full_name: trimmed }, 'Benutzername erfolgreich aktualisiert!');
  };

  const handleInlineNameChange = (userId: string, value: string) => {
    setEditableNames(prev => ({ ...prev, [userId]: value }));
  };

  const toggleUserActive = async (userId: string, currentState: boolean | null | undefined) => {
    if (guardSuperuser(userId)) {
      return;
    }

    await mutateUser(
      userId,
      { is_active: !(currentState ?? true) },
      `Benutzer ${(currentState ?? true) ? 'deaktiviert' : 'reaktiviert'}!`,
    );
  };

  const deleteUser = async (userId: string) => {
    if (guardSuperuser(userId)) {
      return;
    }

    if (!window.confirm('Benutzer wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error ?? 'Fehler beim Löschen des Benutzers');
      }

      setUsers(prev => prev.filter(user => user.id !== userId));
      setEditableNames(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      setMessage('✅ Benutzer erfolgreich gelöscht!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Benutzerlöschen fehlgeschlagen:', error);
      const message = error instanceof Error ? error.message : 'Fehler beim Löschen des Benutzers';
      setMessage(`❌ ${message}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const addDepartment = async () => {
    if (!newDepartmentName.trim()) return;

    try {
      const response = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: postJson,
        body: JSON.stringify({ name: newDepartmentName.trim() }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error ?? 'Fehler beim Anlegen der Abteilung');
      }

      const { data } = await response.json();

      if (data) {
        setDepartments(prev => [...prev, data]);
      }

      setNewDepartmentName('');
      setDepartmentDialogOpen(false);
      setMessage('✅ Abteilung erfolgreich angelegt!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Anlegen der Abteilung:', error);
      const message = error instanceof Error ? error.message : 'Fehler beim Anlegen der Abteilung';
      setMessage(`❌ ${message}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const deleteDepartment = async (departmentId: string) => {
    if (!window.confirm('Abteilung wirklich löschen?')) return;

    try {
      const response = await fetch(`/api/admin/departments/${departmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error ?? 'Fehler beim Löschen der Abteilung');
      }

      setDepartments(prev => prev.filter(department => department.id !== departmentId));
      setMessage('✅ Abteilung erfolgreich gelöscht!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Löschen der Abteilung:', error);
      const message = error instanceof Error ? error.message : 'Fehler beim Löschen der Abteilung';
      setMessage(`❌ ${message}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const updateBoardAdmin = async (boardId: string, adminId: string | null) => {
    try {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ board_admin_id: adminId })
        .eq('id', boardId);

      if (error) {
        throw error;
      }

      setBoards(prev =>
        prev.map(board => (board.id === boardId ? { ...board, boardAdminId: adminId } : board)),
      );
      setMessage('✅ Board-Admin aktualisiert');
      setTimeout(() => setMessage(''), 4000);

      window.dispatchEvent(
        new CustomEvent('board-meta-updated', {
          detail: { id: boardId },
        }),
      );
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren des Board-Admins', error);
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setMessage(`❌ Board-Admin konnte nicht aktualisiert werden: ${message}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const createUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;

    try {
      const trimmedEmail = newUserEmail.trim();
      const trimmedPassword = newUserPassword.trim();
      const trimmedName = newUserName.trim();
      const trimmedDepartment = newUserDepartment.trim();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          data: {
            full_name: trimmedName || null,
            company: trimmedDepartment || null,
            role: 'user'
          }
        }
      });

      if (error) throw error;

      if (!data.user?.id) {
        throw new Error('Benutzerkonto konnte nicht erstellt werden.');
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
      setTimeout(() => setMessage(''), 4000);
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
            🛠️ Board-Administratoren
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Weise jedem Board eine verantwortliche Person zu. Board-Admins verfügen in ihren Boards über vollständige Rechte.
          </Typography>
          {boards.length > 0 ? (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Board</TableCell>
                    <TableCell>Typ</TableCell>
                    <TableCell>Board-Admin</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {boards.map(board => {
                    const currentAdmin = users.find(user => user.id === board.boardAdminId);
                    const hasCurrentAdmin = Boolean(currentAdmin);
                    return (
                      <TableRow key={board.id} hover>
                        <TableCell>{board.name}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={board.boardType === 'team' ? 'info' : 'default'}
                            label={board.boardType === 'team' ? 'Teamboard' : 'Projektboard'}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 220 }}>
                            <Select
                              displayEmpty
                              value={board.boardAdminId ?? ''}
                              onChange={event =>
                                updateBoardAdmin(
                                  board.id,
                                  event.target.value ? String(event.target.value) : null,
                                )
                              }
                            >
                              <MenuItem value="">
                                <em>Kein Admin</em>
                              </MenuItem>
                              {users.map(userProfile => (
                                <MenuItem key={userProfile.id} value={userProfile.id}>
                                  {userProfile.full_name || userProfile.email}
                                </MenuItem>
                              ))}
                              {board.boardAdminId && !hasCurrentAdmin && (
                                <MenuItem value={board.boardAdminId}>
                                  {board.boardAdminId}
                                </MenuItem>
                              )}
                            </Select>
                          </FormControl>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Keine Boards gefunden.
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
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((userProfile) => {
                  const protectedUser = isProtectedUser(userProfile.id);
                  return (
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
                            disabled={protectedUser}
                          />
                          {userProfile.company && (
                            <Typography variant="caption" color="text.secondary">
                              {userProfile.company}
                            </Typography>
                          )}
                          {protectedUser && (
                            <Chip label="Superuser" size="small" color="secondary" />
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
                          disabled={protectedUser}
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
                          disabled={protectedUser}
                        >
                          <MenuItem value="user">User</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="guest">Guest</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={userProfile.is_active}
                          onChange={() => toggleUserActive(userProfile.id, userProfile.is_active)}
                          inputProps={{ 'aria-label': 'Benutzerstatus umschalten' }}
                          size="small"
                          disabled={protectedUser}
                        />
                        <Chip
                          label={userProfile.is_active ? 'Aktiv' : 'Inaktiv'}
                          color={userProfile.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {new Date(userProfile.created_at).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Benutzer löschen">
                        <span>
                          <IconButton
                            color="error"
                            onClick={() => deleteUser(userProfile.id)}
                            size="small"
                            disabled={protectedUser}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                    </TableRow>
                  );
                })}
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
