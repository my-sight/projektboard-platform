import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Typography,
    Box,
    CircularProgress,
    Grid,
    Chip,
    Card,
    CardContent,
    LinearProgress,
    Divider,
    useTheme,
    alpha
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { KanbanCardRow } from './types'; // Make sure this import path is correct based on where we are
import dayjs from 'dayjs';

interface ProjectStatusReportDialogProps {
    open: boolean;
    onClose: () => void;
    card: KanbanCardRow | null;
    boardId: string;
}

export function ProjectStatusReportDialog({ open, onClose, card, boardId }: ProjectStatusReportDialogProps) {
    const { t } = useLanguage();
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!card || !open) return;

            setLoading(true);
            try {
                // 1. Fetch Con-Boards AND Main Board (to get settings)
                const { data: boards } = await supabase
                    .from('kanban_boards')
                    .select('id, name, settings, parent_id')
                    .or(`parent_id.eq.${boardId},id.eq.${boardId}`);

                // 2. Fetch Statuses for this card across all boards
                const { data: statuses } = await supabase
                    .from('board_card_statuses')
                    .select('*')
                    .eq('card_id', card.card_id);

                // 3. Separate Main Board and Con-Boards
                const mainBoard = boards?.find(b => b.id === boardId);
                const conBoards = boards?.filter(b => b.parent_id === boardId) || [];

                // Helper: Calculate Checklist Info
                const getChecklistInfo = (templates: any, fullDoneMap: any, currentStageId: string) => {
                    const stageTasks = templates[currentStageId] || []; // Array of strings (task names)
                    const doneForStage = fullDoneMap?.[currentStageId] || {};

                    const openItems = stageTasks.filter((task: string) => !doneForStage[task]);
                    const doneCount = stageTasks.length - openItems.length;
                    const totalCount = stageTasks.length;

                    // Create list of all items with status
                    const allItems = stageTasks.map((task: string) => ({
                        name: task,
                        isDone: !!doneForStage[task]
                    }));

                    return {
                        done: doneCount,
                        total: totalCount,
                        progress: totalCount > 0 ? (doneCount / totalCount) * 100 : 0,
                        allItems: allItems
                    };
                };

                // 4. Process Con-Boards Data
                const connectedBoards = conBoards.map(board => {
                    const status = statuses?.find(s => s.board_id === board.id);
                    const currentStageId = status?.column_id || 'Speicher';

                    // Resolve Column Title
                    const columns = board.settings?.columns || [];
                    const columnDef = Array.isArray(columns)
                        ? columns.find((c: any) => c.id === currentStageId || c === currentStageId)
                        : null;

                    let stageLabel = currentStageId;
                    if (columnDef && typeof columnDef === 'object' && columnDef.title) {
                        stageLabel = columnDef.title;
                    } else if (typeof columnDef === 'string') {
                        stageLabel = columnDef;
                    }

                    // Checklist
                    const templates = board?.settings?.checklistTemplates || {};
                    const doneMap = status?.local_data?.ChecklistDone || {};
                    const checklist = getChecklistInfo(templates, doneMap, currentStageId);

                    // Status Text (Kurz)
                    const localData = status?.local_data || {};
                    let statusText = localData['Status Kurz'] || '';
                    if (!statusText && Array.isArray(localData.StatusHistory) && localData.StatusHistory.length > 0) {
                        const latest = localData.StatusHistory[0];
                        if (latest?.message?.text) statusText = latest.message.text;
                        else if (latest?.text) statusText = latest.text;
                    }

                    return {
                        id: board.id,
                        name: board.name,
                        stage: status?.archived ? 'Archiviert' : currentStageId,
                        stageLabel: status?.archived ? 'Archiviert' : stageLabel,
                        statusText: statusText,
                        escalation: status?.local_data?.Eskalation,
                        ampel: status?.local_data?.Ampel,
                        checklist,
                        updated: status?.updated_at
                    };
                });

                // 5. Process Main Board Data
                const mainStatus = statuses?.find(s => s.board_id === boardId);
                // Note: card.card_data has 'Board Stage' but we prefer 'board_card_statuses' if available for consistency,
                // otherwise fallback to card_data.
                const mainStageId = mainStatus?.column_id || card.card_data['Board Stage'] || 'Unbekannt';

                // Get human readable Main Stage Label if possible
                let mainStageLabel = mainStageId;
                if (mainBoard) {
                    const columns = mainBoard.settings?.columns || [];
                    const columnDef = Array.isArray(columns)
                        ? columns.find((c: any) => c.id === mainStageId || c === mainStageId)
                        : null;
                    if (columnDef && typeof columnDef === 'object' && columnDef.title) mainStageLabel = columnDef.title;
                }

                const mainTemplates = mainBoard?.settings?.checklistTemplates || {};
                const mainDoneMap = mainStatus?.local_data?.ChecklistDone || card.card_data?.ChecklistDone || {};

                const mainChecklist = getChecklistInfo(mainTemplates, mainDoneMap, mainStageId);

                // Extract Custom Labels (SOP, TR)
                // Settings store them as 'sopLabel' and 'trLabel' directly.
                const customLabels = {
                    sop: mainBoard?.settings?.sopLabel || 'SOP',
                    tr: mainBoard?.settings?.trLabel || 'Milestone'
                };

                // Extract Main Status Text
                const mainCardData = card.card_data || {};
                let mainStatusText = mainCardData['Status Kurz'] || '';
                if (!mainStatusText && Array.isArray(mainCardData.StatusHistory) && mainCardData.StatusHistory.length > 0) {
                    const latest = mainCardData.StatusHistory[0];
                    if (latest?.message?.text) mainStatusText = latest.message.text;
                    else if (latest?.text) mainStatusText = latest.text;
                }

                setReportData({
                    mainStage: mainStageLabel,
                    mainStatusText,
                    mainChecklist,
                    connectedBoards,
                    customLabels
                });

            } catch (error) {
                console.error('Error fetching report data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [card, open, boardId]);

    if (!card) return null;

    // Helper: Parse Date (ISO or German)
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
    };

    const cardData = card.card_data || {};
    const rawSop = (cardData.SOP_Neu || cardData.SOP_Datum) as string | undefined;
    const rawMs = (cardData.MS_Neu || cardData.MS_Datum || cardData.TR_Neu || cardData.TR_Datum) as string | undefined;

    const sopDate = parseDate(rawSop);
    const msDate = parseDate(rawMs);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                className: 'glass', // Reuse existing glassmorphism class
                sx: {
                    backgroundImage: theme.palette.mode === 'dark'
                        ? 'linear-gradient(145deg, rgba(20,20,20,0.9) 0%, rgba(35,35,45,0.95) 100%)'
                        : `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
                    backdropFilter: 'blur(20px)',
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'divider',
                    color: theme.palette.text.primary
                }
            }}
        >
            <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 1.2 }}>
                        Status Report
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {card.project_number ? `${card.project_number} ` : ''}{card.project_name}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ mt: 1 }}> {/* Reduced mt */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}> {/* Reduced gap: 3->1.5 */}

                        {/* TOP SECTION: Main Status & Dates */}
                        <Grid container spacing={1}> {/* Reduced spacing: 2->1 */}
                            <Grid item xs={12} md={6}>
                                <Card sx={{
                                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.background.default, 0.5),
                                    height: '100%'
                                }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}> {/* Tight padding */}
                                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 0.5 }}>
                                            Haupt-Status (Main Board)
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{String(reportData?.mainStage || '')}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Verantwortlich: {String(cardData.Verantwortlich || 'N/A')}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Main Status Text Display */}
                                        {reportData?.mainStatusText && (
                                            <Box sx={{ p: 0.75, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderRadius: 1, mb: 1.5 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 3,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    fontStyle: 'italic',
                                                    lineHeight: 1.25
                                                }}>
                                                    "{reportData.mainStatusText}"
                                                </Typography>
                                            </Box>
                                        )}

                                        {/* Main Board Checklist */}
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                                                <Typography variant="caption" color="text.secondary">Checkliste ({reportData?.mainChecklist?.total || 0})</Typography>
                                                <Typography variant="caption" fontWeight="bold" color={reportData?.mainChecklist?.done === reportData?.mainChecklist?.total && reportData?.mainChecklist?.total > 0 ? 'success.main' : 'text.primary'}>
                                                    {reportData?.mainChecklist?.done || 0} / {reportData?.mainChecklist?.total || 0}
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={reportData?.mainChecklist?.progress || 0}
                                                sx={{
                                                    height: 4,
                                                    borderRadius: 2,
                                                    mb: 0.5,
                                                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                                    '& .MuiLinearProgress-bar': {
                                                        borderRadius: 2,
                                                        bgcolor: reportData?.mainChecklist?.progress === 100 ? 'success.main' : 'primary.main'
                                                    }
                                                }}
                                            />
                                            {/* List All Items Main Board */}
                                            {reportData?.mainChecklist?.allItems?.length > 0 ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                                                    {reportData.mainChecklist.allItems.map((item: { name: string, isDone: boolean }, idx: number) => (
                                                        <Chip
                                                            key={idx}
                                                            label={item.name}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={item.isDone ? {
                                                                // DONE Style
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                bgcolor: alpha(theme.palette.success.main, 0.05),
                                                                borderColor: theme.palette.success.main,
                                                                color: theme.palette.success.main,
                                                                maxWidth: '100%'
                                                            } : {
                                                                // OPEN Style
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                bgcolor: alpha(theme.palette.error.main, 0.05),
                                                                borderColor: alpha(theme.palette.error.main, 0.2),
                                                                color: theme.palette.error.main,
                                                                maxWidth: '100%'
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                    Keine Checklisten-Punkte
                                                </Typography>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Card sx={{
                                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.background.default, 0.5),
                                    height: '100%'
                                }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 0.5 }}>
                                            Meilensteine
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}> {/* Reduced gap 1.5->1 */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography variant="body2" sx={{ color: '#ed6c02', fontWeight: 'bold' }}>{reportData?.customLabels?.sop || 'SOP'}</Typography>
                                                <Chip
                                                    label={sopDate ? sopDate.format('DD.MM.YYYY') : 'Kein Datum'}
                                                    size="small"
                                                    sx={{ height: 20, fontSize: '0.75rem', bgcolor: alpha('#ed6c02', 0.2), color: '#ed6c02', border: '1px solid #ed6c02' }}
                                                />
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography variant="body2" sx={{ color: '#0288d1', fontWeight: 'bold' }}>{reportData?.customLabels?.tr || 'Milestone'}</Typography>
                                                <Chip
                                                    label={msDate ? msDate.format('DD.MM.YYYY') : 'Kein Datum'}
                                                    size="small"
                                                    sx={{ height: 20, fontSize: '0.75rem', bgcolor: alpha('#0288d1', 0.2), color: '#0288d1', border: '1px solid #0288d1' }}
                                                />
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />


                        {/* MIDDLE SECTION: Connected Boards */}
                        <Typography variant="subtitle1" fontWeight="bold">Verbundene Boards</Typography>
                        {reportData?.connectedBoards?.length === 0 ? (
                            <Typography color="text.secondary" variant="caption">Keine Con-Boards gefunden.</Typography>
                        ) : (
                            <Grid container spacing={1}> {/* Reduced spacing */}
                                {reportData?.connectedBoards?.map((board: any) => {
                                    // Escalation / Ampel Logic
                                    const isRed = board.escalation === 'Eskalation' || board.ampel === 'Rot' || board.escalation === 'SK' || board.escalation === 'R';
                                    const isYellow = board.escalation === 'LK' || board.ampel === 'Gelb' || board.escalation === 'Y';



                                    const bgcolor = isRed
                                        ? alpha(theme.palette.error.main, 0.05)
                                        : (isYellow ? alpha(theme.palette.warning.main, 0.05) : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : alpha(theme.palette.background.paper, 0.5)));

                                    const hoverBgcolor = isRed
                                        ? alpha(theme.palette.error.main, 0.1)
                                        : (isYellow ? alpha(theme.palette.warning.main, 0.1) : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : alpha(theme.palette.background.paper, 0.8)));

                                    let borderColor = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                                    if (isRed) borderColor = theme.palette.error.main;
                                    else if (isYellow) borderColor = theme.palette.warning.main;

                                    return (
                                        <Grid item xs={12} sm={6} md={4} key={board.id}>
                                            <Card
                                                className="glass"
                                                sx={{
                                                    bgcolor: bgcolor,
                                                    border: '1px solid',
                                                    borderColor: borderColor,
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    '&:hover': {
                                                        transform: 'translateY(-2px)',
                                                        borderColor: theme.palette.primary.main,
                                                        bgcolor: hoverBgcolor
                                                    }
                                                }}
                                            >
                                                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}> {/* Tight padding */}
                                                    {/* Header: Dept Name + Escalation Icon */}
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                        <Typography variant="subtitle2" fontWeight="bold" noWrap title={board.name} sx={{ fontSize: '0.9rem' }}>
                                                            {board.name}
                                                        </Typography>
                                                        {(isRed || isYellow) && (
                                                            <Box sx={{
                                                                ml: 0.5,
                                                                p: 0.25,
                                                                borderRadius: 1,
                                                                bgcolor: isRed ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.warning.main, 0.2),
                                                                color: isRed ? 'error.main' : 'warning.main',
                                                                display: 'flex'
                                                            }}>
                                                                {/* Warning Icon equivalent */}
                                                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'currentColor' }} />
                                                            </Box>
                                                        )}
                                                    </Box>

                                                    {/* Stage Chip */}
                                                    <Box sx={{ mb: 1 }}>
                                                        <Chip
                                                            label={board.stageLabel}
                                                            size="small"
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                                color: theme.palette.primary.main,
                                                                maxWidth: '100%'
                                                            }}
                                                        />
                                                    </Box>

                                                    {/* Status Text (Kurz) */}
                                                    {board.statusText && (
                                                        <Box sx={{ mb: 1.5, p: 0.75, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderRadius: 1 }}>
                                                            <Typography variant="caption" color="text.secondary" sx={{
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 3,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden',
                                                                fontStyle: 'italic',
                                                                lineHeight: 1.2
                                                            }}>
                                                                "{board.statusText}"
                                                            </Typography>
                                                        </Box>
                                                    )}

                                                    {/* Checklist */}
                                                    <Box>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Checkliste</Typography>
                                                            </Box>
                                                            <Typography variant="caption" fontWeight="bold" color={board.checklist.done === board.checklist.total && board.checklist.total > 0 ? 'success.main' : 'text.primary'}>
                                                                {board.checklist.done} / {board.checklist.total}
                                                            </Typography>
                                                        </Box>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={board.checklist.progress}
                                                            sx={{
                                                                height: 3, // Thinner
                                                                borderRadius: 1.5,
                                                                mb: 0.5,
                                                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                                                '& .MuiLinearProgress-bar': {
                                                                    borderRadius: 1.5,
                                                                    bgcolor: board.checklist.progress === 100 ? 'success.main' : 'primary.main'
                                                                }
                                                            }}
                                                        />
                                                        {/* List ALL Items for Con-Boards */}
                                                        {board.checklist.allItems?.length > 0 && (
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                                                                {board.checklist.allItems.map((item: { name: string, isDone: boolean }, idx: number) => (
                                                                    <Chip
                                                                        key={idx}
                                                                        label={item.name}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={item.isDone ? {
                                                                            // DONE Style
                                                                            height: 16,
                                                                            fontSize: '0.6rem',
                                                                            bgcolor: alpha(theme.palette.success.main, 0.05),
                                                                            borderColor: theme.palette.success.main,
                                                                            color: theme.palette.success.main,
                                                                            maxWidth: '100%'
                                                                        } : {
                                                                            // OPEN Style
                                                                            height: 16,
                                                                            fontSize: '0.6rem',
                                                                            bgcolor: alpha(theme.palette.error.main, 0.05),
                                                                            borderColor: alpha(theme.palette.error.main, 0.2),
                                                                            color: theme.palette.error.main,
                                                                            maxWidth: '100%'
                                                                        }}
                                                                    />
                                                                ))}
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        )}

                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
