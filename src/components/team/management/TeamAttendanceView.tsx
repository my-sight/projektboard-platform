
import React from 'react';
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
    Tooltip,
    Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useLanguage } from '@/contexts/LanguageContext';
import { AttendanceRecord, MemberWithProfile, WeekHistoryItem } from './types';
import { isoWeekNumber, weekRangeLabel, startOfWeek } from '@/utils/dateUtils';

interface TeamAttendanceViewProps {
    members: MemberWithProfile[];
    attendanceByWeek: Record<string, Record<string, AttendanceRecord | undefined>>;
    attendanceDraft: Record<string, boolean>;
    selectedWeek: string;
    historyWeeks: WeekHistoryItem[];
    canEdit: boolean;
    attendanceSaving: boolean;
    onSave: () => void;
    onWeekChange: (week: string) => void;
    onWeekOffset: (offset: number) => void;
    onToggleDraft: (profileId: string) => void;
}

export function TeamAttendanceView({
    members,
    attendanceByWeek,
    attendanceDraft,
    selectedWeek,
    historyWeeks,
    canEdit,
    attendanceSaving,
    onSave,
    onWeekChange,
    onWeekOffset,
    onToggleDraft
}: TeamAttendanceViewProps) {
    const { t } = useLanguage();
    const selectedWeekDate = startOfWeek(new Date(selectedWeek));

    return (
        <Card>
            <CardContent>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    spacing={2}
                    justifyContent="space-between"
                >
                    <Box>
                        <Typography variant="h6">🗓️ {t('boardManagement.attendance')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('boardManagement.attendanceDesc')}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton onClick={() => onWeekOffset(-1)}>
                            <ArrowBackIcon />
                        </IconButton>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="subtitle1">KW {isoWeekNumber(selectedWeekDate)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {weekRangeLabel(selectedWeekDate)}
                            </Typography>
                        </Box>
                        <IconButton onClick={() => onWeekOffset(1)}>
                            <ArrowForwardIcon />
                        </IconButton>
                        {canEdit && (
                            <Button
                                variant="contained"
                                sx={{ ml: { md: 2 } }}
                                onClick={onSave}
                                disabled={attendanceSaving || members.length === 0}
                            >
                                {t('boardManagement.saveWeek')}
                            </Button>
                        )}
                    </Stack>
                </Stack>

                <Box sx={{ mt: 3, overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('boardManagement.member')}</TableCell>
                                <TableCell align="center">{t('boardManagement.currentWeek')}</TableCell>
                                {historyWeeks.map((history) => (
                                    <TableCell key={history.week} align="center">
                                        <Stack spacing={0.5} alignItems="center">
                                            <Button variant="text" size="small" onClick={() => onWeekChange(history.week)}>
                                                KW {isoWeekNumber(startOfWeek(new Date(history.week)))}
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
                                members.map((member) => {
                                    const profile = member.profile;
                                    const label = profile?.full_name || profile?.email || 'Unbekannt';
                                    const present = attendanceDraft[member.profile_id] ?? true;
                                    return (
                                        <TableRow key={member.id} hover>
                                            <TableCell>
                                                <Stack spacing={0.25}>
                                                    <Typography variant="subtitle2">{label}</Typography>
                                                    {profile?.company && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {profile.company}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Tooltip title={present ? t('boardManagement.present') : t('boardManagement.absent')}>
                                                    <span>
                                                        <Checkbox
                                                            checked={present}
                                                            disabled={!canEdit || attendanceSaving}
                                                            icon={<CloseIcon color="error" />}
                                                            checkedIcon={<CheckIcon color="success" />}
                                                            onChange={() => onToggleDraft(member.profile_id)}
                                                        />
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                            {historyWeeks.map((history) => {
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
            </CardContent>
        </Card>
    );
}
