'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Avatar,
    IconButton,
    Typography,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Stack,
    Divider,
    CircularProgress,
    Alert,
    Tooltip,
} from '@mui/material';
import { CloudUpload, PhotoCamera, Language as LanguageIcon, Business, Person, Fingerprint, Lock, Close } from '@mui/icons-material';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

interface UserSettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

// --- HELPER: IMAGE COMPRESSION (similar to KanbanDialogs) ---
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

export default function UserSettingsDialog({ open, onClose }: UserSettingsDialogProps) {
    const { profile, updateProfile, updatePassword } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form states
    const [fullName, setFullName] = useState('');
    const [alias, setAlias] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (open && profile) {
            setFullName(profile.full_name || '');
            setAlias(profile.alias || '');
            setAvatarUrl(profile.avatar_url || '');
            setDepartmentId(profile.department_id || '');
            setError(null);
            setSuccess(null);
            fetchDepartments();
        }
    }, [open, profile]);

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('id, name')
                .order('name');
            if (error) throw error;
            setDepartments(data || []);
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const base64 = await compressImage(file);
            setAvatarUrl(base64);
        } catch (err) {
            console.error('Error uploading avatar:', err);
            setError('Fehler beim Verarbeiten des Bildes');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            // Find department name for legacy company sync
            const deptName = departmentId
                ? departments.find(d => d.id === departmentId)?.name || null
                : null;

            const { error } = await updateProfile({
                full_name: fullName,
                alias: alias,
                avatar_url: avatarUrl,
                department_id: departmentId || null,
                company: deptName, // Sync department name to company
                preferred_language: language,
            });

            if (error) throw error;
            setSuccess('Profil erfolgreich gespeichert');
        } catch (err: any) {
            setError(err.message || 'Fehler beim Speichern des Profils');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!newPassword) return;
        if (newPassword !== confirmPassword) {
            setError('Passwörter stimmen nicht überein');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            const { error } = await updatePassword(newPassword);
            if (error) throw error;
            setSuccess('Passwort erfolgreich geändert');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || 'Fehler beim Ändern des Passworts');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                className: 'glass',
                sx: {
                    backgroundImage: 'none',
                    bgcolor: 'background.paper',
                }
            }}
        >
            <DialogTitle
                component="div"
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider'
                }}
            >
                <Typography variant="h6" component="h2" fontWeight={600}>
                    {t('userSettings.title') || 'Benutzereinstellungen'}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Stack spacing={3}>
                    {error && <Alert severity="error">{error}</Alert>}
                    {success && <Alert severity="success">{success}</Alert>}

                    {/* Avatar Section */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ position: 'relative' }}>
                            <Avatar
                                src={avatarUrl}
                                sx={{ width: 100, height: 100, border: '2px solid', borderColor: 'primary.main' }}
                            >
                                {fullName?.charAt(0) || 'U'}
                            </Avatar>
                            <IconButton
                                component="label"
                                sx={{
                                    position: 'absolute',
                                    bottom: -8,
                                    right: -8,
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
                        <Typography variant="caption" color="text.secondary">
                            {t('userSettings.avatarDesc') || 'Klicken Sie auf das Kamera-Icon, um Ihr Avatar zu ändern.'}
                        </Typography>
                    </Box>

                    <Divider />

                    {/* Profile Section */}
                    <Box>
                        <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person fontSize="small" /> {t('userSettings.profileInfo') || 'Profilinformationen'}
                        </Typography>
                        <Stack spacing={2}>
                            <TextField
                                label={t('userSettings.fullName') || 'Vollständiger Name'}
                                fullWidth
                                size="small"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Echter Name"
                            />
                            <TextField
                                label={t('userSettings.alias') || 'Alias'}
                                fullWidth
                                size="small"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                                placeholder="Anzeigename (z.B. Kürzel)"
                            />
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('userSettings.department') || 'Abteilung'}</InputLabel>
                                <Select
                                    value={departmentId}
                                    label={t('userSettings.department') || 'Abteilung'}
                                    onChange={(e) => setDepartmentId(e.target.value)}
                                >
                                    <MenuItem value=""><em>{t('common.none') || 'Keine'}</em></MenuItem>
                                    {departments.map((dept) => (
                                        <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>
                    </Box>

                    <Divider />

                    {/* Preferences Section */}
                    <Box>
                        <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LanguageIcon fontSize="small" /> {t('userSettings.preferences') || 'Präferenzen'}
                        </Typography>
                        <FormControl fullWidth size="small">
                            <InputLabel>{t('userSettings.language') || 'Sprache'}</InputLabel>
                            <Select
                                value={language}
                                label={t('userSettings.language') || 'Sprache'}
                                onChange={(e) => setLanguage(e.target.value as any)}
                            >
                                <MenuItem value="de">Deutsch</MenuItem>
                                <MenuItem value="en">English</MenuItem>
                                <MenuItem value="pl">Polski</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    <Divider />

                    {/* Security Section */}
                    <Box>
                        <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Lock fontSize="small" /> {t('userSettings.security') || 'Sicherheit'}
                        </Typography>
                        <Stack spacing={2}>
                            <TextField
                                label={t('userSettings.newPassword') || 'Neues Passwort'}
                                type="password"
                                fullWidth
                                size="small"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <TextField
                                label={t('userSettings.confirmPassword') || 'Passwort bestätigen'}
                                type="password"
                                fullWidth
                                size="small"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleUpdatePassword}
                                disabled={!newPassword || saving}
                            >
                                Passwort aktualisieren
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
