import { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Divider, Avatar, Tooltip, useTheme, alpha } from '@mui/material';
import { useLanguage } from '@/contexts/LanguageContext';
import { KanbanCardRow, Member } from './types';
import dayjs from 'dayjs';
import { ClientProfile } from '@/lib/clientProfiles';

interface ProjectTimelineViewProps {
    cards: KanbanCardRow[];
    members: (Member & { profile?: ClientProfile })[];
    completionLabel?: string;
}

export function ProjectTimelineView({ cards, members, completionLabel = 'SOP' }: ProjectTimelineViewProps) {
    const { t } = useLanguage();
    const theme = useTheme();
    const today = useMemo(() => dayjs(), []);

    // Helper: Parse German Dates
    const parseDate = (value: string | undefined) => {
        if (!value) return null;
        if (typeof value !== 'string') return null;

        // Try ISO
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
            const d = dayjs(value);
            return d.isValid() ? d : null;
        }

        // Try German DD.MM.YYYY
        const parts = value.trim().split('.');
        if (parts.length === 3) {
            const d = dayjs(`${parts[2]}-${parts[1]}-${parts[0]}`); // YYYY-MM-DD
            return d.isValid() ? d : null;
        }

        // Fallback
        const d = dayjs(value);
        return d.isValid() ? d : null;
    }

    // Helper: Resolve Member Name
    const resolveResponsibleName = (rawName: string | undefined): string => {
        if (!rawName) return t('kanban.unassigned');

        // Try to match by name, full_name, email, or id
        const cleanRaw = rawName.trim().toLowerCase();

        const match = (members || []).find(m => {
            const p = m.profile;
            if (!p) return false;
            return (
                (p.full_name && p.full_name.toLowerCase() === cleanRaw) ||
                (p.alias && p.alias.toLowerCase() === cleanRaw) ||
                (p.email && p.email.toLowerCase() === cleanRaw) ||
                (p.id === cleanRaw) || // UUID match
                (p.name && p.name.toLowerCase() === cleanRaw) // Legacy
            );
        });

        if (match && match.profile) {
            return match.profile.alias || match.profile.full_name || match.profile.email;
        }

        // If no match found using robust check, fallback to rawName but maybe formatted?
        // User says "PM den es nicht gibt". If rawName is weird ID, we show "Unknown".
        // If rawName looks like a name, we keep it (maybe an external PM?).
        // Let's assume if it looks like a valid name, keep it. If it looks like ID, show fallback.
        if (cleanRaw.length > 30 && !cleanRaw.includes(' ')) return t('kanban.unknown');

        return rawName;
    };

    // 1. Data Processing
    const { groups, maxDate, totalDays } = useMemo(() => {
        let globalMax = today.add(6, 'months');

        const validCards = cards.filter(c => {
            const rawSop = c.card_data['SOP_Datum'] as string | undefined;
            const rawSopNeu = c.card_data['SOP_Neu'] as string | undefined;

            return !!parseDate(rawSopNeu) || !!parseDate(rawSop);
        });

        const grouped: Record<string, any[]> = {};

        validCards.forEach(c => {
            const rawSop = c.card_data['SOP_Datum'] as string | undefined;
            const rawSopNeu = c.card_data['SOP_Neu'] as string | undefined;

            const sopDate = parseDate(rawSop);
            const sopNeuDate = parseDate(rawSopNeu);

            // Priority: SOP neu > SOP
            const finalSop = sopNeuDate || sopDate;

            if (!finalSop) return; // Should be filtered out but safe check

            const sop = finalSop;
            const bufferEnd = sop.add(3, 'months');

            if (bufferEnd.isAfter(globalMax)) {
                globalMax = bufferEnd;
            }

            const rawResp = c.card_data['Verantwortlich'] as string | undefined;
            const responsible = resolveResponsibleName(rawResp);

            if (!grouped[responsible]) {
                grouped[responsible] = [];
            }

            grouped[responsible].push({
                id: c.id,
                name: c.project_name || c.id,
                number: c.project_number,
                sop,
                bufferEnd,
                isPastSop: sop.isBefore(today)
            });
        });

        const sortedGroups = Object.keys(grouped).sort().map(key => ({
            responsible: key,
            projects: grouped[key].sort((a, b) => a.sop.valueOf() - b.sop.valueOf())
        }));

        const totalDays = globalMax.diff(today, 'day');

        return { groups: sortedGroups, maxDate: globalMax, totalDays };

    }, [cards, members, t, today]);

    // 2. Scale Helper
    const getPosition = (date: dayjs.Dayjs) => {
        const diff = date.diff(today, 'day');
        if (diff <= 0) return 0;
        return (diff / totalDays) * 100;
    };

    const getWidth = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        const startPos = getPosition(start);
        const endPos = getPosition(end);
        return Math.max(0.5, endPos - startPos);
    };

    const gridTicks = useMemo(() => {
        const ticks = [];
        let cursor = today.clone().add(1, 'month').startOf('month');
        while (cursor.isBefore(maxDate)) {
            ticks.push(cursor);
            cursor = cursor.add(1, 'month');
        }
        return ticks;
    }, [today, maxDate]);


    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {t('boardManagement.projectTimeline', { label: completionLabel })}
                </Typography>

                {groups.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('boardManagement.noSopProjects')}
                    </Typography>
                ) : (
                    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {/* Timeline Header (Months) */}
                        <Box sx={{ display: 'flex', mb: 1, pl: '200px' }}>
                            <Box sx={{ position: 'relative', width: '100%', height: 24 }}>
                                <Typography variant="caption" sx={{ position: 'absolute', left: 0, transform: 'translateX(-50%)', fontWeight: 'bold' }}>
                                    {t('common.today')}
                                </Typography>
                                {gridTicks.map(date => (
                                    <Typography
                                        key={date.toISOString()}
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            position: 'absolute',
                                            left: `${getPosition(date)}%`,
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        {date.format('MMM YY')}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>

                        {groups.map((group, gIdx) => (
                            <Box key={group.responsible} sx={{ mb: 2 }}>
                                {/* Responsible Header */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 1 }}>
                                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem' }}>
                                        {group.responsible.charAt(0)}
                                    </Avatar>
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {group.responsible}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        ({group.projects.length} {t('kanban.projects')})
                                    </Typography>
                                </Box>

                                {/* Projects */}
                                <Box sx={{ position: 'relative' }}>

                                    {/* Grid Lines */}
                                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: '200px', right: 0, pointerEvents: 'none', zIndex: 0 }}>
                                        <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderLeft: `2px solid ${theme.palette.primary.main}`, opacity: 0.3 }} />
                                        {gridTicks.map(date => (
                                            <Box
                                                key={date.toISOString()}
                                                sx={{
                                                    position: 'absolute',
                                                    left: `${getPosition(date)}%`,
                                                    top: 0,
                                                    bottom: 0,
                                                    borderLeft: `1px dashed ${theme.palette.divider}`
                                                }}
                                            />
                                        ))}
                                    </Box>

                                    {/* Rows */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, position: 'relative', zIndex: 1 }}>
                                        {group.projects.map((proj: any) => {
                                            const sopPos = getPosition(proj.sop);
                                            const bufferWidth = getWidth(proj.sop, proj.bufferEnd);
                                            const mainWidth = sopPos;

                                            return (
                                                <Box key={proj.id} sx={{ display: 'flex', alignItems: 'center', height: 28 }}>
                                                    <Box sx={{ width: 200, flexShrink: 0, pr: 2 }}>
                                                        <Tooltip title={`${proj.name} (${completionLabel}: ${proj.sop.format('DD.MM.YYYY')})`}>
                                                            <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                                                                {proj.number ? `${proj.number} ` : ''}{proj.name}
                                                            </Typography>
                                                        </Tooltip>
                                                    </Box>

                                                    <Box sx={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                                                        <Box sx={{
                                                            position: 'relative',
                                                            height: 16,
                                                            top: 6,
                                                            bgcolor: 'transparent',
                                                            border: `1px dashed ${theme.palette.divider}`,
                                                            borderRadius: 4,
                                                            width: '100%',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {!proj.isPastSop && (
                                                                <Tooltip title={`Laufzeit bis ${completionLabel} (${proj.sop.format('DD.MM.YYYY')})`}>
                                                                    <Box sx={{
                                                                        position: 'absolute',
                                                                        left: 0,
                                                                        top: 0,
                                                                        bottom: 0,
                                                                        width: `${mainWidth}%`,
                                                                        bgcolor: 'primary.main',
                                                                        opacity: 0.85,
                                                                        borderRight: '1px solid #fff'
                                                                    }} />
                                                                </Tooltip>
                                                            )}

                                                            <Tooltip title={`Safety Buffer (+3 Monate) bis ${proj.bufferEnd.format('DD.MM.YYYY')}`}>
                                                                <Box sx={{
                                                                    position: 'absolute',
                                                                    left: `${mainWidth}%`,
                                                                    top: 0,
                                                                    bottom: 0,
                                                                    width: `${bufferWidth}%`,
                                                                    bgcolor: '#ed6c02',
                                                                    opacity: 0.85
                                                                }} />
                                                            </Tooltip>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>
                                <Divider sx={{ mt: 2, display: gIdx === groups.length - 1 ? 'none' : 'block' }} />
                            </Box>
                        ))}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
