
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Card, CardContent, Typography, Box, List, ListItem
} from '@mui/material';
import { Assessment, Close } from '@mui/icons-material';
import { useLanguage } from '@/contexts/LanguageContext';
import { KanbanKPIs } from '../hooks/useKanbanKPIs';
import { DEFAULT_COLS } from '../constants';

interface KanbanKPIDialogProps {
    open: boolean;
    onClose: () => void;
    kpis: KanbanKPIs;
    distribution: { name: string; count: number }[];
    trLabel: string;
    idFor: (card: any) => string;
}

export function KanbanKPIDialog({ open, onClose, kpis, distribution, trLabel, idFor }: KanbanKPIDialogProps) {
    const { t } = useLanguage();

    const percentage = (count: number) => {
        if (kpis.totalCards === 0) return 0;
        return Math.round((count / kpis.totalCards) * 100);
    };

    const isOverdue = kpis.trOverdue.length > 0;
    const hasEscalations = kpis.rEscalations.length > 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assessment color="primary" />
                    <Typography variant="h6">{t('kanban.kpis')}</Typography>
                </Box>
                <Button onClick={onClose} startIcon={<Close />}>{t('kanban.close')}</Button>
            </DialogTitle>
            <DialogContent>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={4}>
                        <Card variant="outlined" sx={{ height: '100%', backgroundColor: isOverdue ? '#ffebee' : '#f0f0f0' }}>
                            <CardContent>
                                <Typography variant="subtitle2" color="text.secondary">{t('kanban.overdue')}</Typography>
                                <Typography variant="h4" color={isOverdue ? 'error.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                                    {kpis.trOverdue.length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{t('kanban.totalCards').replace('{count}', String(kpis.totalCards))}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card variant="outlined" sx={{ height: '100%', backgroundColor: hasEscalations ? '#fff3e0' : '#f0f0f0' }}>
                            <CardContent>
                                <Typography variant="subtitle2" color="text.secondary">{t('kanban.escalations')}</Typography>
                                <Typography variant="h4" color={hasEscalations ? 'error.main' : 'text.primary'} sx={{ fontWeight: 700 }}>
                                    {kpis.rEscalations.length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">R: {kpis.rEscalations.length}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card variant="outlined" sx={{ height: '100%', backgroundColor: kpis.ampelGreen > 0 ? '#e8f5e8' : '#f0f0f0' }}>
                            <CardContent>
                                <Typography variant="subtitle2" color="text.secondary">{t('kanban.total')}</Typography>
                                <Typography variant="h4" color="text.primary" sx={{ fontWeight: 700 }}>
                                    {kpis.totalCards}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{t('kanban.allCards')}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12}>
                        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: kpis.totalTrDeviation > 0 ? 'error.light' : 'success.light', borderRadius: 1, bgcolor: kpis.totalTrDeviation > 0 ? 'error.50' : 'success.50' }}>
                            <Typography variant="subtitle2" sx={{ color: kpis.totalTrDeviation > 0 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                                {t('kanban.totalTrDeviation').replace('{label}', trLabel).replace('{sign}', kpis.totalTrDeviation > 0 ? '+' : '').replace('{days}', String(kpis.totalTrDeviation))}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('kanban.trDeviationDesc')}
                            </Typography>
                        </Box>

                        <Typography variant="h6" gutterBottom sx={{ mt: 3, color: 'text.secondary' }}>
                            {t('kanban.upcoming')} {trLabel}
                        </Typography>
                        <Grid container spacing={2}>
                            {(kpis.nextTrs || []).map((card: any) => (
                                <Grid item xs={12} md={4} key={idFor(card)}>
                                    <Card variant="outlined" sx={{ height: '100%', p: 1 }}>
                                        <CardContent sx={{ p: '16px !important' }}>
                                            <Typography variant="subtitle2" noWrap title={card.Teil} sx={{ fontWeight: 'bold' }}>
                                                {card.Teil || 'Kein Titel'}
                                            </Typography>
                                            <Typography variant="caption" display="block" color="text.secondary" gutterBottom>
                                                #{card.Nummer || '-'}
                                            </Typography>

                                            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="caption">Original:</Typography>
                                                    <Typography variant="caption">{card._originalDate ? card._originalDate.toLocaleDateString('de-DE') : '-'}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="caption">Aktuell (Neu):</Typography>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: card._currentDate ? 'primary.main' : 'text.primary' }}>
                                                        {card._effectiveDate ? card._effectiveDate.toLocaleDateString('de-DE') : '-'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                            {(!kpis.nextTrs || kpis.nextTrs.length === 0) && (
                                <Grid item xs={12}><Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Keine anstehenden TRs gefunden.</Typography></Grid>
                            )}
                        </Grid>

                        <Typography variant="h6" gutterBottom sx={{ mt: 3, color: 'text.secondary' }}>{t('kanban.cardDistribution')}</Typography>
                        <Card variant="outlined">
                            <CardContent>
                                <List dense>
                                    {distribution.map((item, index) => (
                                        <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
                                            <Grid container alignItems="center" spacing={2}>
                                                <Grid item xs={4}>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Box sx={{ width: '100%', height: '10px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px' }}>
                                                        <Box sx={{
                                                            width: `${percentage(item.count)}%`,
                                                            height: '100%',
                                                            backgroundColor: DEFAULT_COLS.find(c => c.name === item.name)?.done ? '#4caf50' : '#2196f3',
                                                            borderRadius: '4px',
                                                            transition: 'width 0.5s ease',
                                                        }} />
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={2} sx={{ textAlign: 'right' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.count} ({percentage(item.count)}%)</Typography>
                                                </Grid>
                                            </Grid>
                                        </ListItem>
                                    ))}
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions><Button onClick={onClose} variant="outlined">{t('kanban.close')}</Button></DialogActions>
        </Dialog>
    );
}
