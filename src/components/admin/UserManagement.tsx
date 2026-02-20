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
  Divider,
  ListSubheader
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
  Edit as EditIcon,
  Dns as DnsIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ReceiptLong as ReceiptLongIcon,
  PhotoCamera
} from '@mui/icons-material';
import { isSuperuserEmail } from '@/constants/superuser';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLicenseStatus } from '@/lib/license';
import AuditLogViewer from './AuditLogViewer';

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

// --- HELPER: IMAGE COMPRESSION ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; // Smaller for avatars
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error('Canvas Context failed'));
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
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
  const { t } = useLanguage();
  // const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  // --- STATE ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [boardAdminSelections, setBoardAdminSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id || null;
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);

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
  const [editUserAvatar, setEditUserAvatar] = useState('');

  // Import
  const [importData, setImportData] = useState<CsvUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [serverCheck, setServerCheck] = useState<{ status: 'ok' | 'error' | null, msg: string }>({ status: null, msg: '' });

  // Inline Edit
  const [editableNames, setEditableNames] = useState<Record<string, string>>({});

  const postJson = useMemo(() => ({ 'Content-Type': 'application/json' }), []);

  // --- DATA LOADING ---
  // --- DATA LOADING ---
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Users laden via API (requires admin token)
      let profiles: UserProfile[] = [];
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.users) {
            profiles = data.users.map((u: any) => normalizeUserProfile(u))
              .filter((p: UserProfile) => !isSuperuserEmail(p.email));
          }
        } else {
          console.error('Failed to load users via API', res.statusText);
          // Fallback or error? If 401, maybe not admin.
          // If we can't load users via API, maybe we try public profiles read if allowed?
          // But let's assume API is the way for this panel.
        }
      }

      setUsers(profiles);
      const mapped: Record<string, string> = {};
      profiles.forEach(p => mapped[p.id] = p.full_name || '');
      setEditableNames(mapped);

      // 2. Departments laden 
      try {
        const { data: deps } = await supabase.from('departments').select('*').order('name');
        if (deps) {
          setDepartments(deps.map((d: any) => ({ id: d.id, name: d.name, created_at: d.created_at })));
        }
      } catch (e) { console.log("Departments load error", e); setDepartments([]); }

      // 3. Boards laden (für Admin-Zuweisung)
      try {
        const { data: boardsList } = await supabase.from('kanban_boards').select('id,name,description,settings,board_admin_id');
        if (boardsList) {
          const summary: BoardSummary[] = boardsList.map((b: any) => ({
            id: b.id,
            name: b.name,
            description: b.description,
            settings: b.settings,
            board_admin_id: b.board_admin_id,
            boardType: b.settings?.boardType || 'standard'
          }));
          setBoards(summary);
          const admins: Record<string, string> = {};
          summary.forEach(b => admins[b.id] = b.board_admin_id || '');
          setBoardAdminSelections(admins);
        }
      } catch (e) { console.error(e); }

    } catch (error: any) {
      console.error('Error loading data:', error);
      setMessage('Fehler beim Laden der Daten: ' + error.message);
    } finally {
      setLoading(false);
      // Load License implicitly
      getLicenseStatus().then(status => {
        if (status.valid && status.maxUsers) setMaxUsers(status.maxUsers);
      }).catch(() => { });

      // Load System Status
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/admin/system-status', { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(res => res.json())
          .then(data => setSystemStatus(data))
          .catch(err => console.error('Status fetch error', err));
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]); // Reload when user changes/auth init

  // --- ACTIONS ---
  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const isProtectedUser = (userId: string) => isSuperuserEmail(users.find(entry => entry.id === userId)?.email);

  const mutateUser = async (userId: string, payload: any, successMsg: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht authentifiziert');

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: userId, ...payload })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Update fehlgeschlagen');
      }

      // Update local state immediately
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...payload } : u));

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // setLoading(true); // Optional: Loading state for avatar?
      const base64 = await compressImage(file);
      setEditUserAvatar(base64);
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setMessage('❌ Fehler beim Verarbeiten des Bildes');
    }
  };

  const deleteUser = async (id: string) => {
    if (isProtectedUser(id) || !confirm('Benutzer löschen?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!res.ok) throw new Error('Delete failed');

      setUsers(prev => prev.filter(u => u.id !== id));
      setMessage('✅ Benutzer gelöscht');
    } catch (e: any) { setMessage(`❌ ${e.message}`); }
  };

  // BULK DELETE (Nur für Superuser erlaubt)
  const bulkDeleteOthers = async () => {
    if (!currentUserId) return;
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const others = users.filter(u => u.id !== currentUserId);
      for (const u of others) {
        await fetch(`/api/admin/users?id=${u.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
      }
      setMessage(`✅ Alle anderen Benutzer (${others.length}) gelöscht.`);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht authentifiziert');

      const data = {
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        name: newUserName.trim() || undefined,
        role: 'user',
        company: newUserDepartment || undefined
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erstellen fehlgeschlagen');
      }

      setCreateUserDialogOpen(false);
      setNewUserEmail(''); setNewUserPassword(''); setNewUserName('');
      setMessage('✅ Benutzer erstellt');
      loadData();
    } catch (e: any) {
      console.error("Create User Error:", e);
      setMessage(`❌ ${e.message}`);
    }
  };

  const addDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: newDepartmentName.trim() })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      const { data } = await res.json();

      setDepartments(prev => [...prev, { id: data.id, name: data.name, created_at: data.created_at }]);
      setDepartmentDialogOpen(false);
      setNewDepartmentName('');
      setMessage('✅ Abteilung erstellt');
    } catch (e: any) { setMessage('❌ Fehler: ' + e.message); }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Löschen?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(`/api/admin/departments?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch (e: any) { setMessage('❌ Fehler: ' + e.message); }
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
      if (parsedUsers.length > 0) { setImportDialogOpen(true); setImportProgress(0); }
      else { alert('Keine gültigen Daten gefunden.'); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    setImporting(true);
    setImportProgress(0);
    const total = importData.length;
    let successCount = 0;
    let allErrors: string[] = [];

    for (let i = 0; i < total; i++) {
      const u = importData[i];
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            email: u.email,
            password: u.password,
            name: u.full_name,
            role: 'user',
            company: u.company || ''
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed');
        }
        successCount++;
      } catch (err: any) {
        console.error(err);
        allErrors.push(`${u.email}: ${err.message}`);
      }
      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    setImportDialogOpen(false);
    setImportData([]);

    if (allErrors.length > 0) {
      const errorMsg = allErrors.slice(0, 5).join('\n') + (allErrors.length > 5 ? `\n...und ${allErrors.length - 5} weitere.` : '');
      alert(`Import fertig.\n✅ ${successCount} OK\n❌ ${allErrors.length} Fehler:\n${errorMsg}`);
      setMessage(`⚠️ Import mit Fehlern.`);
    } else {
      setMessage(`✅ Alle ${successCount} Benutzer erfolgreich importiert.`);
    }
    await loadData();
    setImporting(false);
    setImportProgress(0);
  };

  if (loading) return <Box sx={{ py: 10, textAlign: 'center' }}><Typography variant="h6">🔄 Laden...</Typography></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>

      {/* HEADER & STATS */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button variant="text" onClick={() => (window.location.href = '/')}>← {t('admin.back')}</Button>
            <Typography variant="h4" component="h1">{t('admin.title')}</Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="primary">{users.length} {maxUsers ? <span style={{ fontSize: '0.6em', opacity: 0.7 }}>/ {maxUsers}</span> : ''}</Typography><Typography variant="caption">{t('admin.users')}</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="success.main">{users.filter(u => u.is_active).length}</Typography><Typography variant="caption">{t('admin.active')}</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="info.main">{departments.length}</Typography><Typography variant="caption">{t('admin.departments')}</Typography></CardContent></Card></Grid>
          <Grid item xs={6} md={3}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h4" color="warning.main">{users.filter(u => u.role === 'admin').length}</Typography><Typography variant="caption">{t('admin.admins')}</Typography></CardContent></Card></Grid>
        </Grid>
      </Box>

      {message && <Alert severity={message.startsWith('✅') ? 'success' : (message.startsWith('⚠️') ? 'warning' : 'error')} sx={{ mb: 3 }}>{message}</Alert>}

      {/* TABS NAVIGATION */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab icon={<PeopleIcon />} label={t('admin.users')} iconPosition="start" />
          <Tab icon={<BusinessIcon />} label={t('admin.departments')} iconPosition="start" />
          <Tab icon={<DashboardIcon />} label={t('admin.boards')} iconPosition="start" />
          <Tab icon={<DnsIcon />} label={t('admin.systemStatus')} iconPosition="start" />
          <Tab icon={<ReceiptLongIcon />} label="Audit Log" iconPosition="start" />
        </Tabs>
      </Box>

      {/* --- TAB 0: BENUTZER --- */}
      <CustomTabPanel value={currentTab} index={0}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} justifyContent="flex-end">
          {/* NEW BULK DELETE BUTTON (Nur für Superuser sichtbar) */}
          {isSuperUser && (
            <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={bulkDeleteOthers}>
              {t('admin.deleteAll')}
            </Button>
          )}

          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreateUserDialogOpen(true)}>{t('admin.newUser')}</Button>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            {t('admin.importCsv')} <input type="file" hidden accept=".csv,.txt" onChange={handleFileChange} />
          </Button>
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.name')}</TableCell>
                <TableCell>{t('admin.email')}</TableCell>
                <TableCell>{t('admin.department')}</TableCell>
                <TableCell>{t('admin.role')}</TableCell>
                <TableCell>{t('admin.status')}</TableCell>
                <TableCell align="right">{t('admin.action')}</TableCell>
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
                        setEditUserAvatar(u.avatar_url || '');
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDepartmentDialogOpen(true)}>{t('admin.newDepartment')}</Button>
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
                        {departments.map(dept => {
                          const deptUsers = users.filter(u => u.company === dept.name);
                          if (deptUsers.length === 0) return null;
                          return [
                            <ListSubheader key={`dept-${dept.id}`} sx={{ fontWeight: 'bold', color: 'primary.main', bgcolor: 'background.paper' }}>
                              {dept.name}
                            </ListSubheader>,
                            ...deptUsers.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)).map(u => (
                              <MenuItem key={u.id} value={u.id} sx={{ pl: 4 }}>
                                {u.full_name || u.email}
                              </MenuItem>
                            ))
                          ];
                        })}
                        {(() => {
                          const noDeptUsers = users.filter(u => !u.company);
                          if (noDeptUsers.length === 0) return null;
                          return [
                            <ListSubheader key="no-dept" sx={{ fontWeight: 'bold', color: 'text.secondary', bgcolor: 'background.paper' }}>
                              Ohne Abteilung
                            </ListSubheader>,
                            ...noDeptUsers.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)).map(u => (
                              <MenuItem key={u.id} value={u.id} sx={{ pl: 4 }}>
                                {u.full_name || u.email}
                              </MenuItem>
                            ))
                          ];
                        })()}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CustomTabPanel>

      {/* --- TAB 3: SYSTEM STATUS --- */}
      <CustomTabPanel value={currentTab} index={3}>
        <Grid container spacing={3}>
          {/* LIZENZ */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6">{t('admin.license')}</Typography>
                </Stack>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                  <Chip
                    icon={systemStatus?.license?.valid ? <CheckCircleIcon /> : <ErrorIcon />}
                    label={systemStatus?.license?.valid ? 'Aktiv' : 'Ungültig'}
                    color={systemStatus?.license?.valid ? 'success' : 'error'}
                    size="small"
                    sx={{ width: 'fit-content' }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Kunde</Typography>
                  <Typography variant="body1" fontWeight="medium">{systemStatus?.license?.customer || '-'}</Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Gültig bis</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {systemStatus?.license?.expiry ? new Date(systemStatus.license.expiry).toLocaleDateString('de-DE') : '-'}
                  </Typography>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {systemStatus?.license?.expiry ? (() => {
                      const diff = new Date(systemStatus.license.expiry).getTime() - Date.now();
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      return `Noch ${days} Tage`;
                    })() : ''}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* BACKUP */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <StorageIcon color="info" />
                  <Typography variant="h6">Backup Backup</Typography>
                </Stack>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                  <Chip
                    label={
                      systemStatus?.backup?.status === 'ok' ? 'Aktuell' :
                        systemStatus?.backup?.status === 'warning' ? 'Veraltet / Leer' :
                          systemStatus?.backup?.status === 'not_configured' ? 'Nicht Konfiguriert' : 'Fehler'
                    }
                    color={
                      systemStatus?.backup?.status === 'ok' ? 'success' :
                        systemStatus?.backup?.status === 'not_configured' ? 'default' : 'warning'
                    }
                    size="small"
                    sx={{ width: 'fit-content' }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Letztes Backup</Typography>
                  <Typography variant="body1">
                    {systemStatus?.backup?.lastBackup ? new Date(systemStatus.backup.lastBackup).toLocaleString('de-DE') : 'Nie'}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Anzahl Backups</Typography>
                  <Typography variant="body1">{systemStatus?.backup?.totalBackups || 0}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* RAID */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <DnsIcon color={systemStatus?.raid?.healthy === false ? 'error' : 'secondary'} />
                  <Typography variant="h6">System RAID1</Typography>
                </Stack>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                  <Chip
                    label={
                      systemStatus?.raid?.healthy === true ? 'Healthy' :
                        systemStatus?.raid?.healthy === false ? 'DEGRADED' : 'Unbekannt'
                    }
                    color={
                      systemStatus?.raid?.healthy === true ? 'success' :
                        systemStatus?.raid?.healthy === false ? 'error' : 'default'
                    }
                    size="small"
                    sx={{ width: 'fit-content' }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Details</Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {systemStatus?.raid?.details || 'Keine Information'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CustomTabPanel>

      {/* --- DIALOGE --- */}

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onClose={() => setEditUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Benutzer bearbeiten</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, mt: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={editUserAvatar}
                sx={{ width: 80, height: 80, border: '2px solid', borderColor: 'primary.main' }}
              >
                {editUserName?.charAt(0) || 'U'}
              </Avatar>
              <IconButton
                component="label"
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  boxShadow: 2
                }}
                size="small"
              >
                <PhotoCamera fontSize="small" />
                <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
              </IconButton>
            </Box>
          </Box>
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
            if (editUserAvatar !== (editingUser.avatar_url || '')) modifications.avatar_url = editUserAvatar;

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
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('No session');

              const res = await fetch('/api/admin/departments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ id: editingDepartment.id, name: editDepartmentName.trim() })
              });

              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed');
              }
              const { data: updated } = await res.json();

              setDepartments(prev => prev.map(d => d.id === editingDepartment.id ? { ...d, name: updated.name } : d));
              setEditDepartmentDialogOpen(false);
              setMessage('✅ Abteilung umbenannt');
            } catch (err: any) {
              console.error('Error updating department:', err);
              setMessage('❌ Fehler: ' + (err.message || 'Unbekannter Fehler'));
            }
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

          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>Abbrechen</Button>
          <Button onClick={executeImport} variant="contained" disabled={importing} startIcon={<UploadFileIcon />}>{importing ? 'Importiere...' : 'Starten'}</Button>
        </DialogActions>
      </Dialog>



      {/* --- TAB 4: AUDIT LOG --- */}
      <CustomTabPanel value={currentTab} index={4}>
        <AuditLogViewer />
      </CustomTabPanel>

    </Container >
  );
}