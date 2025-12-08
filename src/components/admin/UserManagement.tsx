'use client';

import { useEffect, useMemo, useState, SyntheticEvent } from 'react';
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
  IconButton,
  LinearProgress,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
  PersonAdd as PersonAddIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  DeleteForever as DeleteForeverIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { isSuperuserEmail } from '@/constants/superuser';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import SupabaseConfigNotice from '@/components/SupabaseConfigNotice';

// --- TYPEN ---
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
  description?: string | null;
  settings?: Record<string, unknown> | null;
  board_admin_id: string | null;
  boardType: 'standard' | 'team';
}

interface CsvUser {
  email: string;
  password?: string;
  full_name: string;
  company: string;
  role: string;
  generatedPassword?: string;
}

// ✅ HIER IST DER FIX: Props definieren
interface UserManagementProps {
  isSuperUser?: boolean;
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

// --- PARSER ---
const parseCSV = (text: string): string[][] => {
  const cleanText = text.replace(/^\uFEFF/, ''); // BOM entfernen
  const rows: string[][] = [];
  let currentRow: string[] = [''];
  let colIndex = 0;
  let inQuotes = false;

  const firstLineEnd = cleanText.indexOf('\n');
  const firstLine = cleanText.substring(0, firstLineEnd > -1 ? firstLineEnd : cleanText.length);
  const delimiter = firstLine.includes(';') ? ';' : ',';

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentRow[colIndex] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      colIndex++;
      currentRow[colIndex] = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (currentRow.length > 1 || (currentRow[0] && currentRow[0].trim() !== '')) {
        rows.push(currentRow.map(c => c.trim()));
      }
      currentRow = [''];
      colIndex = 0;
    } else {
      currentRow[colIndex] += char;
    }
  }
  if (currentRow.length > 1 || (currentRow[0] && currentRow[0].trim() !== '')) {
    rows.push(currentRow.map(c => c.trim()));
  }
  return rows;
};

// --- TAB PANEL HELPER ---
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// ✅ HIER IST DER FIX: Props übernehmen
export default function UserManagement({ isSuperUser = false }: UserManagementProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  // --- STATE ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [boardAdminSelections, setBoardAdminSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Tabs
  const [currentTab, setCurrentTab] = useState(0);

  // Dialogs
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Edit Dialogs
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [editDepartmentDialogOpen, setEditDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editDepartmentName, setEditDepartmentName] = useState('');

  // Form Fields
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');

  // Edit User Form State
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState('user');
  const [editUserDepartment, setEditUserDepartment] = useState('');
  const [editUserActive, setEditUserActive] = useState(true);

  // Import
  const [importData, setImportData] = useState<CsvUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [serverCheck, setServerCheck] = useState<{ status: 'ok' | 'error' | null, msg: string }>({ status: null, msg: '' });

  // Inline Edit
  const [editableNames, setEditableNames] = useState<Record<string, string>>({});

  const postJson = useMemo(() => ({ 'Content-Type': 'application/json' }), []);

  if (!supabase) return <Box sx={{ p: 3 }}><SupabaseConfigNotice /></Box>;

  // --- DATA LOADING ---
  const loadData = async () => {
    try {
      setLoading(true);

      // Eigene ID holen
      const { data: authData } = await supabase.auth.getUser();
      setCurrentUserId(authData.user?.id ?? null);

      const [usersResult, departmentsResult, boardsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('*').order('name'),
        supabase.from('kanban_boards').select('id, name, description, settings, board_admin_id').order('name'),
      ]);

      if (usersResult.data) {
        const normalized = usersResult.data.map(normalizeUserProfile);
        setUsers(normalized);
        const mapped: Record<string, string> = {};
        normalized.forEach(p => mapped[p.id] = p.full_name || '');
        setEditableNames(mapped);
      }
      if (departmentsResult.data) setDepartments(departmentsResult.data);
      if (boardsResult.data) {
        const normalizedBoards = boardsResult.data.map((board: any) => ({
          id: board.id,
          name: board.name,
          description: board.description,
          settings: board.settings || {},
          board_admin_id: board.board_admin_id,
          boardType: (board.settings?.boardType === 'team' ? 'team' : 'standard')
        })) as BoardSummary[];
        setBoards(normalizedBoards);
        const admins: Record<string, string> = {};
        normalizedBoards.forEach(b => admins[b.id] = b.board_admin_id || '');
        setBoardAdminSelections(admins);
      }
    } catch (error: any) {
      setMessage(`❌ Fehler beim Laden: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- ACTIONS ---
  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const isProtectedUser = (userId: string) => isSuperuserEmail(users.find(entry => entry.id === userId)?.email);

  const mutateUser = async (userId: string, payload: any, successMsg: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: postJson, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error);
      const { data } = await res.json();
      setUsers(prev => prev.map(u => u.id === userId ? normalizeUserProfile({ ...u, ...data }) : u));
      setMessage(`✅ ${successMsg}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) { setMessage(`❌ ${e.message}`); }
  };

  const updateUserRole = (id: string, role: string) => !isProtectedUser(id) && mutateUser(id, { role }, 'Rolle aktualisiert');
  const updateUserDepartment = (id: string, company: string) => !isProtectedUser(id) && mutateUser(id, { company: company || null }, 'Abteilung aktualisiert');
  const toggleUserActive = (id: string, current: boolean) => !isProtectedUser(id) && mutateUser(id, { is_active: !current }, 'Status geändert');
  const updateUserName = (id: string, name: string) => !isProtectedUser(id) && name.trim() && mutateUser(id, { full_name: name.trim() }, 'Name aktualisiert');
  const handleInlineNameChange = (userId: string, value: string) => {
    setEditableNames(prev => ({ ...prev, [userId]: value }));
  };

  const deleteUser = async (id: string) => {
    if (isProtectedUser(id) || !confirm('Benutzer löschen?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers(prev => prev.filter(u => u.id !== id));
      setMessage('✅ Benutzer gelöscht');
    } catch (e: any) { setMessage(`❌ ${e.message}`); }
  };

  // BULK DELETE (Nur für Superuser erlaubt)
  const bulkDeleteOthers = async () => {
    if (!currentUserId) return;
    // Doppelte Absicherung: Nur wenn Prop true ist
    if (!isSuperUser) {
      alert("Nur Superuser dürfen diese Aktion ausführen.");
      return;
    }

    const count = users.length - 1;
    if (count <= 0) return alert("Keine anderen Benutzer da.");

    if (!confirm(`⚠️ ACHTUNG: Alle anderen Benutzer unwiderruflich löschen?`)) return;
    if (!confirm(`Wirklich sicher? Das löscht ${count} Benutzer und deren Profile!`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/reset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMessage(`✅ Aufräumen beendet: ${result.message}`);
      await loadData();
    } catch (e: any) {
      setMessage(`❌ Fehler beim Löschen: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        options: { data: { full_name: newUserName.trim(), company: newUserDepartment || null, role: 'user' } }
      });
      if (error) throw error;
      if (data.user) {
        setCreateUserDialogOpen(false);
        setNewUserEmail(''); setNewUserPassword(''); setNewUserName('');
        setMessage('✅ Benutzer erstellt');
        loadData();
      }
    } catch (e: any) { setMessage(`❌ ${e.message}`); }
  };

  const addDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    try {
      const res = await fetch('/api/admin/departments', { method: 'POST', headers: postJson, body: JSON.stringify({ name: newDepartmentName.trim() }) });
      if (!res.ok) throw new Error('Fehler');
      const { data } = await res.json();
      setDepartments(prev => [...prev, data]);
      setDepartmentDialogOpen(false);
      setNewDepartmentName('');
      setMessage('✅ Abteilung erstellt');
    } catch { setMessage('❌ Fehler'); }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Löschen?')) return;
    try {
      const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler');
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch { setMessage('❌ Fehler'); }
  };

  const updateBoardAdmin = async (boardId: string, adminId: string) => {
    setBoardAdminSelections(prev => ({ ...prev, [boardId]: adminId }));
    try {
      const { error } = await supabase.from('kanban_boards').update({ board_admin_id: adminId || null }).eq('id', boardId);
      if (error) throw error;
      setBoards(prev => prev.map(b => b.id === boardId ? { ...b, board_admin_id: adminId || null } : b));
      setMessage('✅ Admin aktualisiert');
    } catch (e: any) { setMessage(`❌ ${e.message}`); }
  };

  // --- IMPORT LOGIK ---
  const checkServerConfig = async () => {
    try {
      const res = await fetch('/api/admin/users/import', { method: 'GET' });
      const data = await res.json();
      if (data.config?.key === 'OK') {
        setServerCheck({ status: 'ok', msg: 'Server bereit.' });
      } else {
        setServerCheck({ status: 'error', msg: 'Service Key fehlt in .env.local!' });
      }
    } catch (e) {
      setServerCheck({ status: 'error', msg: 'Server nicht erreichbar.' });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setServerCheck({ status: null, msg: '' });
      const rows = parseCSV(e.target?.result as string);
      if (rows.length === 0) return;

      const headers = rows[0].map(h => h.toLowerCase());
      const emailIdx = headers.findIndex(h => h.includes('e-mail') || h.includes('email'));
      const firstIdx = headers.findIndex(h => h.includes('first name') || h.includes('vorname'));
      const lastIdx = headers.findIndex(h => h.includes('last name') || h.includes('nachname'));
      const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name');

      if (emailIdx === -1) { alert('Keine E-Mail Spalte gefunden.'); return; }

      const parsedUsers: CsvUser[] = [];
      const fixedPassword = 'Board2025!';

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length <= emailIdx) continue;
        const email = cols[emailIdx];
        if (!email || !email.includes('@')) continue;

        let full_name = '';
        if (firstIdx !== -1 && lastIdx !== -1) full_name = `${cols[firstIdx] || ''} ${cols[lastIdx] || ''}`.trim();
        else if (nameIdx !== -1) full_name = cols[nameIdx] || '';
        if (!full_name) full_name = email.split('@')[0];

        parsedUsers.push({ email, password: fixedPassword, generatedPassword: fixedPassword, full_name, company: '', role: 'user' });
      }
      setImportData(parsedUsers);
      if (parsedUsers.length > 0) { setImportDialogOpen(true); setImportProgress(0); checkServerConfig(); }
      else { alert('Keine gültigen Daten gefunden.'); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    setImporting(true);
    setImportProgress(0);
    const CHUNK_SIZE = 5;
    const total = importData.length;
    let processed = 0;
    let successCount = 0;
    let allErrors: string[] = [];

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = importData.slice(i, i + CHUNK_SIZE);
        try {
          const response = await fetch('/api/admin/users/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: chunk }) });
          const textResponse = await response.text();
          let result;
          try { result = JSON.parse(textResponse); } catch (e) { throw new Error(`Server-Fehler (Kein JSON)`); }
          if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
          successCount += result.imported || 0;
          if (result.errors) allErrors = [...allErrors, ...result.errors];
        } catch (err: any) { allErrors.push(`Batch Fehler: ${err.message}`); }
        processed += chunk.length;
        setImportProgress(Math.min(100, Math.round((processed / total) * 100)));
      }
      setImportDialogOpen(false);
      setImportData([]);
      if (allErrors.length > 0) {
        alert(`Import beendet.\n✅ ${successCount} erfolgreich\n❌ ${allErrors.length} Fehler`);
        setMessage(`⚠️ Import mit Fehlern (${successCount} OK).`);
      } else {
        setMessage(`✅ ${successCount} Benutzer erfolgreich importiert.`);
      }
      await loadData();
    } catch (err: any) { setMessage(`❌ Fehler: ${err.message}`); }
    finally { setImporting(false); setImportProgress(0); }
  };

  if (loading) return <Box sx={{ py: 10, textAlign: 'center' }}><Typography variant="h6">🔄 Laden...</Typography></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>

      {/* HEADER & STATS */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="text" onClick={() => (window.location.href = '/')}>← Zurück</Button>
            <Typography variant="h4" component="h1">Verwaltung</Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="primary">{users.length}</Typography><Typography variant="caption">Benutzer</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="success.main">{users.filter(u => u.is_active).length}</Typography><Typography variant="caption">Aktiv</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="info.main">{departments.length}</Typography><Typography variant="caption">Abteilungen</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="warning.main">{users.filter(u => u.role === 'admin').length}</Typography><Typography variant="caption">Admins</Typography></CardContent></Card></Grid>
        </Grid>
      </Box>

      {message && <Alert severity={message.startsWith('✅') ? 'success' : (message.startsWith('⚠️') ? 'warning' : 'error')} sx={{ mb: 3 }}>{message}</Alert>}

      {/* TABS NAVIGATION */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab icon={<PeopleIcon />} label="Benutzer" iconPosition="start" />
          <Tab icon={<BusinessIcon />} label="Abteilungen" iconPosition="start" />
          <Tab icon={<DashboardIcon />} label="Boards & Rechte" iconPosition="start" />
        </Tabs>
      </Box>

      {/* --- TAB 0: BENUTZER --- */}
      <CustomTabPanel value={currentTab} index={0}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} justifyContent="flex-end">
          {/* NEW BULK DELETE BUTTON (Nur für Superuser sichtbar) */}
          {isSuperUser && (
            <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={bulkDeleteOthers}>
              Alle anderen löschen
            </Button>
          )}

          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreateUserDialogOpen(true)}>Neuer Benutzer</Button>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            CSV Import <input type="file" hidden accept=".csv,.txt" onChange={handleFileChange} />
          </Button>
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Abteilung</TableCell>
                <TableCell>Rolle</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Aktion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => {
                const protectedUser = isProtectedUser(u.id);
                const isMe = u.id === currentUserId;
                return (
                  <TableRow key={u.id} selected={isMe}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={u.avatar_url} sx={{ width: 28, height: 28 }}>{(u.full_name || u.email)[0].toUpperCase()}</Avatar>
                        <TextField size="small" variant="standard" value={editableNames[u.id] ?? u.full_name} onChange={(e) => setEditableNames(prev => ({ ...prev, [u.id]: e.target.value }))} onBlur={(e) => updateUserName(u.id, e.target.value)} disabled={protectedUser} InputProps={{ disableUnderline: true }} />
                      </Box>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select size="small" variant="standard" disableUnderline value={u.company || ''} onChange={(e) => updateUserDepartment(u.id, e.target.value)} disabled={protectedUser} displayEmpty sx={{ minWidth: 120 }}>
                        <MenuItem value=""><em>Keine</em></MenuItem>
                        {departments.map(d => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select size="small" variant="standard" disableUnderline value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} disabled={protectedUser}>
                        <MenuItem value="user">User</MenuItem><MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell><Switch size="small" checked={u.is_active} onChange={() => toggleUserActive(u.id, u.is_active)} disabled={protectedUser} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" onClick={() => {
                        setEditingUser(u);
                        setEditUserName(u.full_name);
                        setEditUserRole(u.role);
                        setEditUserDepartment(u.company || '');
                        setEditUserActive(u.is_active);
                        setEditUserDialogOpen(true);
                      }} disabled={protectedUser}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteUser(u.id)} disabled={protectedUser || isMe}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CustomTabPanel>

      {/* --- TAB 1: ABTEILUNGEN --- */}
      <CustomTabPanel value={currentTab} index={1}>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDepartmentDialogOpen(true)}>Neue Abteilung</Button>
        </Stack>
        <Grid container spacing={2}>
          {departments.map(d => (
            <Grid item xs={12} sm={6} md={4} key={d.id}>
              <Card variant="outlined"><CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={600}>{d.name}</Typography>
                <Box>
                  <IconButton color="primary" size="small" onClick={() => { setEditingDepartment(d); setEditDepartmentName(d.name); setEditDepartmentDialogOpen(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton color="error" size="small" onClick={() => deleteDepartment(d.id)}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      </CustomTabPanel>

      {/* --- TAB 2: BOARDS --- */}
      <CustomTabPanel value={currentTab} index={2}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead><TableRow><TableCell>Board Name</TableCell><TableCell>Typ</TableCell><TableCell>Administrator</TableCell></TableRow></TableHead>
            <TableBody>
              {boards.map(b => (
                <TableRow key={b.id}>
                  <TableCell sx={{ fontWeight: 500 }}>{b.name}</TableCell>
                  <TableCell><Chip label={b.boardType === 'team' ? 'Teamboard' : 'Projekt'} size="small" /></TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <Select value={boardAdminSelections[b.id] ?? ''} onChange={(e) => updateBoardAdmin(b.id, e.target.value)} displayEmpty>
                        <MenuItem value=""><em>Kein Admin zugewiesen</em></MenuItem>
                        {users.map(u => <MenuItem key={u.id} value={u.id}>{u.full_name || u.email}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CustomTabPanel>

      {/* --- DIALOGE --- */}

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onClose={() => setEditUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Benutzer bearbeiten</DialogTitle>
        <DialogContent>
          <TextField label="Name" fullWidth margin="normal" value={editUserName} onChange={e => setEditUserName(e.target.value)} />

          <FormControl fullWidth margin="normal">
            <InputLabel>Abteilung</InputLabel>
            <Select value={editUserDepartment} label="Abteilung" onChange={e => setEditUserDepartment(e.target.value)} displayEmpty>
              <MenuItem value=""><em>Keine</em></MenuItem>
              {departments.map(d => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Rolle</InputLabel>
            <Select value={editUserRole} label="Rolle" onChange={e => setEditUserRole(e.target.value)}>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography>Aktiv:</Typography>
            <Switch checked={editUserActive} onChange={e => setEditUserActive(e.target.checked)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUserDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={async () => {
            if (!editingUser) return;
            const modifications: any = {};
            if (editUserName !== editingUser.full_name) modifications.full_name = editUserName;
            if (editUserRole !== editingUser.role) modifications.role = editUserRole;
            if (editUserDepartment !== (editingUser.company || '')) modifications.company = editUserDepartment || null;
            if (editUserActive !== editingUser.is_active) modifications.is_active = editUserActive;

            if (Object.keys(modifications).length > 0) {
              await mutateUser(editingUser.id, modifications, 'Benutzer aktualisiert');
            }
            setEditUserDialogOpen(false);
          }}>Speichern</Button>
        </DialogActions>
      </Dialog>

      {/* Create User */}
      <Dialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Neuer Benutzer</DialogTitle>
        <DialogContent>
          <TextField label="Name" fullWidth margin="normal" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
          <TextField label="Email" fullWidth margin="normal" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
          <TextField label="Passwort" type="password" fullWidth margin="normal" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Abteilung</InputLabel>
            <Select value={newUserDepartment} label="Abteilung" onChange={e => setNewUserDepartment(e.target.value)}>
              <MenuItem value=""><em>Keine</em></MenuItem>
              {departments.map(d => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={createUser}>Erstellen</Button>
        </DialogActions>
      </Dialog>

      {/* Create Dept */}
      <Dialog open={departmentDialogOpen} onClose={() => setDepartmentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Neue Abteilung</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" fullWidth margin="normal" value={newDepartmentName} onChange={e => setNewDepartmentName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartmentDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={addDepartment}>Speichern</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dept */}
      <Dialog open={editDepartmentDialogOpen} onClose={() => setEditDepartmentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Abteilung bearbeiten</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            margin="normal"
            value={editDepartmentName}
            onChange={e => setEditDepartmentName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDepartmentDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={async () => {
            if (!editingDepartment || !editDepartmentName.trim()) return;
            try {
              const res = await fetch(`/api/admin/departments/${editingDepartment.id}`, {
                method: 'PATCH',
                headers: postJson,
                body: JSON.stringify({ name: editDepartmentName.trim() })
              });
              if (!res.ok) throw new Error('Fehler');
              const { data } = await res.json();
              setDepartments(prev => prev.map(d => d.id === editingDepartment.id ? { ...d, name: data.name } : d));
              setEditDepartmentDialogOpen(false);
              setMessage('✅ Abteilung umbenannt');
            } catch { setMessage('❌ Fehler'); }
          }}>Speichern</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => !importing && setImportDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>📥 Import Vorschau ({importData.length})</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {/* Server Status */}
            {serverCheck.status === 'error' && <Alert severity="error"><strong>Server Problem:</strong> {serverCheck.msg}</Alert>}

            <Alert severity="info">PW für alle: <strong>Board2025!</strong></Alert>

            {importing && <LinearProgress variant="determinate" value={importProgress} />}

            <TableContainer component={Paper} sx={{ maxHeight: 300 }} variant="outlined">
              <Table stickyHeader size="small">
                <TableHead><TableRow><TableCell>Email</TableCell><TableCell>Name</TableCell><TableCell>PW</TableCell></TableRow></TableHead>
                <TableBody>
                  {importData.map((u, i) => (
                    <TableRow key={i} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{u.generatedPassword}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={checkServerConfig} disabled={importing}>Verbindung testen</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>Abbrechen</Button>
          <Button onClick={executeImport} variant="contained" disabled={importing} startIcon={<UploadFileIcon />}>{importing ? 'Importiere...' : 'Starten'}</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}