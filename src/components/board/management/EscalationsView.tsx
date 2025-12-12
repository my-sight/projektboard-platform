
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    List,
    ListItem,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import { CompletionDial } from './CompletionDial';
import { Department, EscalationDraft, EscalationHistoryEntry, EscalationView as EscalationViewType } from './types';

interface EscalationsViewProps {
    filteredEscalations: { Y: EscalationViewType[]; R: EscalationViewType[] };
    profiles: ClientProfile[];
    departments: Department[];
    escalationHistory: Record<string, EscalationHistoryEntry[]>;
    canEdit: boolean;
    schemaReady: boolean;
    schemaHelpText: string;

    // Dialog State
    dialogOpen: boolean;
    editingEscalation: EscalationViewType | null;
    draft: EscalationDraft | null;

    // Handlers
    onOpenEditor: (entry: EscalationViewType) => void;
    onCloseEditor: () => void;
    onUpdateDraft: (updates: Partial<EscalationDraft>) => void;
    onSave: () => void;
    onClearFields: () => void;
    onCycleCompletion: () => void;
}

export function EscalationsView({
    filteredEscalations,
    profiles,
    departments,
    escalationHistory,
    canEdit,
    schemaReady,
    schemaHelpText,
    dialogOpen,
    editingEscalation,
    draft,
    onOpenEditor,
    onCloseEditor,
    onUpdateDraft,
    onSave,
    onClearFields,
    onCycleCompletion,
}: EscalationsViewProps) {
    const { t } = useLanguage();

    const profileById = new Map(profiles.map(p => [p.id, p]));

    const departmentName = (departmentId: string | null) =>
        departments.find(entry => entry.id === departmentId)?.name ?? '';

    const responsibleOptions = (departmentId: string | null) => {
        const name = departmentName(departmentId);
        return profiles.filter(profile => {
            if (isSuperuserEmail(profile.email)) {
                return false;
            }
            const matchesDepartment = name ? profile.company === name : true;
            const isActive = profile.is_active ?? true;
            return matchesDepartment && isActive;
        });
    };

    return (
        <>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🚨 {t('boardManagement.escalationsTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {t('boardManagement.escalationsDesc')}
                    </Typography>
                    {!schemaReady && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            {schemaHelpText}
                        </Alert>
                    )}
                    <Divider sx={{ my: 2 }} />
                    {(['Y', 'R'] as const).map(category => {
                        const entries = filteredEscalations[category];
                        const title = category === 'Y' ? t('boardManagement.yEscalations') : t('boardManagement.rEscalations');
                        return (
                            <Box key={category} sx={{ mb: category === 'Y' ? 3 : 0 }}>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                    {title}
                                </Typography>
                                {entries.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {category === 'Y'
                                            ? t('boardManagement.noYEscalations')
                                            : t('boardManagement.noREscalations')}
                                    </Typography>
                                ) : (
                                    <Stack spacing={2} sx={{ mb: 2 }}>
                                        {entries.map(entry => {
                                            const responsible = entry.responsible_id ? profileById.get(entry.responsible_id) : undefined;
                                            const department = departmentName(entry.department_id);
                                            const targetLabel = entry.target_date
                                                ? new Date(entry.target_date).toLocaleDateString('de-DE')
                                                : 'Kein Termin';
                                            return (
                                                <Box
                                                    key={entry.card_id}
                                                    sx={{
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        borderRadius: 2,
                                                        p: 2,
                                                    }}
                                                >
                                                    <Stack
                                                        direction={{ xs: 'column', md: 'row' }}
                                                        spacing={2}
                                                        justifyContent="space-between"
                                                        alignItems={{ xs: 'flex-start', md: 'center' }}
                                                    >
                                                        <Box>
                                                            <Typography variant="subtitle2">
                                                                {entry.project_code || entry.project_name
                                                                    ? `${entry.project_code ?? ''}${entry.project_code && entry.project_name ? ' – ' : ''}${entry.project_name ?? ''}`
                                                                    : entry.title}
                                                            </Typography>
                                                            {entry.stage && (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {t('boardManagement.phase')}: {entry.stage}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                        <Stack direction="row" spacing={2} alignItems="center">
                                                            <Tooltip title={t('boardManagement.progressTooltip')}>
                                                                <Box>
                                                                    <CompletionDial steps={entry.completion_steps ?? 0} onClick={() => { }} disabled />
                                                                </Box>
                                                            </Tooltip>
                                                            <Button
                                                                variant="outlined"
                                                                onClick={() => onOpenEditor(entry)}
                                                                disabled={!canEdit || !schemaReady}
                                                            >
                                                                {t('boardManagement.edit')}
                                                            </Button>
                                                        </Stack>
                                                    </Stack>
                                                    <Grid container spacing={2} sx={{ mt: 1 }}>
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('boardManagement.reason')}
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                {entry.reason || t('boardManagement.noReason')}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('boardManagement.measure')}
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                {entry.measure || t('boardManagement.noMeasure')}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} md={4}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('boardManagement.department')}
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                {department || t('boardManagement.noDepartment')}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} md={4}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('boardManagement.responsibility')}
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                {responsible
                                                                    ? `${responsible.full_name || responsible.email}${responsible.company ? ` • ${responsible.company}` : ''}`
                                                                    : t('boardManagement.noResponsibility')}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12} md={4}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('boardManagement.targetDate')}
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                {targetLabel}
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                    {(() => {
                                                        const historyEntries = escalationHistory[entry.card_id] ?? [];
                                                        if (!historyEntries.length) {
                                                            return null;
                                                        }
                                                        return (
                                                            <Box sx={{ mt: 1.5 }}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {t('boardManagement.history')}
                                                                </Typography>
                                                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                                    {historyEntries.slice(0, 1).map(history => {
                                                                        const author = profileById.get(history.changed_by ?? '') ?? null;
                                                                        const authorLabel = author
                                                                            ? author.full_name || author.email || 'Unbekannt'
                                                                            : t('boardManagement.unknown');
                                                                        const changedAt = new Date(history.changed_at);
                                                                        return (
                                                                            <Typography key={history.id} variant="body2">
                                                                                {changedAt.toLocaleString('de-DE')} – {authorLabel}
                                                                            </Typography>
                                                                        );
                                                                    })}
                                                                    {historyEntries.length > 1 && (
                                                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                                            {t('boardManagement.olderEntries').replace('{n}', String(historyEntries.length - 1))}
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
                                                            </Box>
                                                        );
                                                    })()}
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                )}
                                {category === 'Y' && <Divider sx={{ my: 2 }} />}
                            </Box>
                        );
                    })}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onClose={onCloseEditor} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {t('boardManagement.editEscalation')}
                    {editingEscalation && (
                        <Typography variant="body2" color="text.secondary">
                            {editingEscalation.project_code || editingEscalation.project_name
                                ? `${editingEscalation.project_code ?? ''}${editingEscalation.project_code && editingEscalation.project_name ? ' – ' : ''}${editingEscalation.project_name ?? ''}`
                                : editingEscalation.title}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent dividers>
                    {draft ? (
                        <Stack spacing={2}>
                            <TextField
                                label={t('boardManagement.reason')}
                                value={draft.reason}
                                onChange={(event) => onUpdateDraft({ reason: event.target.value })}
                                fullWidth
                                multiline
                                minRows={3}
                                disabled={!canEdit}
                            />
                            <TextField
                                label={t('boardManagement.measure')}
                                value={draft.measure}
                                onChange={(event) => onUpdateDraft({ measure: event.target.value })}
                                fullWidth
                                multiline
                                minRows={3}
                                disabled={!canEdit}
                            />
                            <FormControl fullWidth size="small" disabled={!canEdit}>
                                <InputLabel>{t('boardManagement.department')}</InputLabel>
                                <Select
                                    value={draft.department_id ?? ''}
                                    label={t('boardManagement.department')}
                                    onChange={(event) =>
                                        onUpdateDraft({
                                            department_id: event.target.value ? String(event.target.value) : null,
                                            responsible_id: null,
                                        })
                                    }
                                >
                                    <MenuItem value="">
                                        <em>{t('boardManagement.none')}</em>
                                    </MenuItem>
                                    {departments.map(department => (
                                        <MenuItem key={department.id} value={department.id}>
                                            {department.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small" disabled={!canEdit}>
                                <InputLabel>{t('boardManagement.responsibility')}</InputLabel>
                                <Select
                                    value={draft.responsible_id ?? ''}
                                    label={t('boardManagement.responsibility')}
                                    onChange={(event) =>
                                        onUpdateDraft({
                                            responsible_id: event.target.value ? String(event.target.value) : null,
                                        })
                                    }
                                >
                                    <MenuItem value="">
                                        <em>{t('boardManagement.none')}</em>
                                    </MenuItem>
                                    {responsibleOptions(draft.department_id ?? null).map(option => (
                                        <MenuItem key={option.id} value={option.id}>
                                            {option.full_name || option.email}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <StandardDatePicker
                                label={t('boardManagement.targetDate')}
                                value={draft.target_date ? dayjs(draft.target_date) : null}
                                onChange={(newValue) => onUpdateDraft({ target_date: newValue ? newValue.format('YYYY-MM-DD') : null })}
                                disabled={!canEdit}
                            />
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Tooltip title={t('boardManagement.progress')}>
                                    <Box>
                                        <CompletionDial
                                            steps={draft.completion_steps ?? 0}
                                            onClick={onCycleCompletion}
                                            disabled={!canEdit}
                                        />
                                    </Box>
                                </Tooltip>
                                <Typography variant="body2">{draft.completion_steps ?? 0} / 4 {t('boardManagement.steps')}</Typography>
                            </Stack>
                            {editingEscalation && (
                                (() => {
                                    const historyEntries = escalationHistory[editingEscalation.card_id] ?? [];
                                    if (!historyEntries.length) return null;
                                    return (
                                        <Box>
                                            <Divider sx={{ my: 1.5 }} />
                                            <Typography variant="subtitle2">{t('boardManagement.changeHistory')}</Typography>
                                            <List dense>
                                                {historyEntries.map(history => {
                                                    const author = profileById.get(history.changed_by ?? '') ?? null;
                                                    const authorLabel = author
                                                        ? author.full_name || author.email || 'Unbekannt'
                                                        : t('boardManagement.unknown');
                                                    const changedAt = new Date(history.changed_at);
                                                    return (
                                                        <ListItem key={history.id} sx={{ py: 0 }}>
                                                            <Typography variant="body2">
                                                                {changedAt.toLocaleString('de-DE')} – {authorLabel}
                                                            </Typography>
                                                        </ListItem>
                                                    );
                                                })}
                                            </List>
                                        </Box>
                                    );
                                })()
                            )}
                        </Stack>
                    ) : (
                        <Typography variant="body2">{t('boardManagement.noEscalationSelected')}</Typography>
                    )}
                </DialogContent>

                <DialogActions sx={{ justifyContent: 'space-between' }}>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={onClearFields}
                        disabled={!canEdit}
                    >
                        🧹 {t('boardManagement.clearFields')}
                    </Button>

                    <Box>
                        <Button onClick={onCloseEditor} sx={{ mr: 1 }}>{t('common.cancel')}</Button>
                        <Button onClick={onSave} variant="contained" disabled={!canEdit}>
                            {t('common.save')}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </>
    );
}
