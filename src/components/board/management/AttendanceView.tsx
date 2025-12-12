
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useLanguage } from '@/contexts/LanguageContext';
import { isoWeekNumber, weekRangeLabel, formatWeekInputValue } from '@/utils/dateUtils';
import { AttendanceRecord, Member } from './types';

interface AttendanceViewProps {
    members: Member[];
    attendanceByWeek: Record<string, Record<string, AttendanceRecord | undefined>>;
    selectedWeek: string;
    selectedWeekDate: Date;
    historyWeeks: { week: string; date: Date }[];
    canEdit: boolean;
    attendanceDraft: Record<string, boolean>;
    attendanceSaving: boolean;
    onSave: () => void;
    onWeekChange: (week: string) => void;
    onWeekOffset: (offset: number) => void;
    onWeekInputChange: (value: string) => void;
    onToggleDraft: (profileId: string) => void;
}

export function AttendanceView({
    members,
    attendanceByWeek,
    selectedWeek,
    selectedWeekDate,
    historyWeeks,
    canEdit,
    attendanceDraft,
    attendanceSaving,
    onSave,
    onWeekChange,
    onWeekOffset,
    onWeekInputChange,
    onToggleDraft
}: AttendanceViewProps) {
    const { t } = useLanguage();
    const selectedWeekInputValue = formatWeekInputValue(selectedWeekDate);

    return (
        <Card>
            <CardContent>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Typography variant="h6">🗓️ {t('boardManagement.attendance')}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('boardManagement.calendarWeek')} {isoWeekNumber(selectedWeekDate)} · {weekRangeLabel(selectedWeekDate)}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <IconButton onClick={() => onWeekOffset(-1)} aria-label="Vorherige Woche">
                                <ArrowBackIcon />
                            </IconButton>
                            <TextField
                                type="week"
                                label={t('boardManagement.calendarWeek')}
                                size="small"
                                value={selectedWeekInputValue}
                                onChange={event => onWeekInputChange(event.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 180 }}
                            />
                            <IconButton onClick={() => onWeekOffset(1)} aria-label="Nächste Woche">
                                <ArrowForwardIcon />
                            </IconButton>
                            {canEdit && (
                                <Button
                                    variant="contained"
                                    onClick={onSave}
                                    disabled={attendanceSaving || members.length === 0}
                                    sx={{ ml: 1 }}
                                >
                                    {t('boardManagement.saveButton') || 'Speichern'}
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ minWidth: 220 }}>{t('boardManagement.member')}</TableCell>
                                    <TableCell align="center" sx={{ minWidth: 160 }}>
                                        <Stack spacing={0.5} alignItems="center">
                                            <Typography variant="subtitle2">
                                                {t('boardManagement.calendarWeek')} {isoWeekNumber(selectedWeekDate)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {weekRangeLabel(selectedWeekDate)}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    {historyWeeks.map(history => (
                                        <TableCell key={history.week} align="center" sx={{ minWidth: 140 }}>
                                            <Stack spacing={0.5} alignItems="center">
                                                <Button
                                                    size="small"
                                                    variant={history.week === selectedWeek ? 'contained' : 'text'}
                                                    onClick={() => onWeekChange(history.week)}
                                                >
                                                    {t('boardManagement.calendarWeek')} {isoWeekNumber(history.date)}
                                                </Button>
                                                <Typography variant="caption" color="text.secondary">
                                                    {weekRangeLabel(history.date)}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {members.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={historyWeeks.length + 2}>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('boardManagement.addMembersHint')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    members.map(member => {
                                        const profile = member.profile;
                                        const label = profile?.full_name || profile?.email || 'Unbekannt';
                                        const department = profile?.company;
                                        const present = attendanceDraft[member.profile_id] ?? true;
                                        return (
                                            <TableRow key={member.id} hover>
                                                <TableCell>
                                                    <Stack spacing={0.25}>
                                                        <Typography variant="subtitle2">{label}</Typography>
                                                        {department && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {department}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title={present ? t('boardManagement.present') : t('boardManagement.absent')}>
                                                        <span>
                                                            <Checkbox
                                                                checked={present}
                                                                onChange={() => onToggleDraft(member.profile_id)}
                                                                disabled={!canEdit || attendanceSaving}
                                                                icon={<CloseIcon color="error" />}
                                                                checkedIcon={<CheckIcon color="success" />}
                                                                sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
                                                            />
                                                        </span>
                                                    </Tooltip>
                                                </TableCell>
                                                {historyWeeks.map(history => {
                                                    const record = attendanceByWeek[history.week]?.[member.profile_id];
                                                    if (!record) {
                                                        return (
                                                            <TableCell key={history.week} align="center">
                                                                <Typography variant="caption" color="text.secondary">
                                                                    —
                                                                </Typography>
                                                            </TableCell>
                                                        );
                                                    }
                                                    const wasPresent = record.status !== 'absent';
                                                    return (
                                                        <TableCell key={history.week} align="center">
                                                            {wasPresent ? (
                                                                <CheckIcon color="success" fontSize="small" />
                                                            ) : (
                                                                <CloseIcon color="error" fontSize="small" />
                                                            )}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}
