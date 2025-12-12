
import {
    Box,
    Card,
    CardContent,
    Typography,
} from '@mui/material';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

interface EvaluationsViewProps {
    stageChartData: { stage: string; count: number }[];
}

export function EvaluationsView({ stageChartData }: EvaluationsViewProps) {
    const { t } = useLanguage();

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    📈 {t('boardManagement.projectsPerPhase')}
                </Typography>
                {stageChartData.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('boardManagement.noProjectData')}
                    </Typography>
                ) : (
                    <Box sx={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer>
                            <LineChart data={stageChartData} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="stage" angle={-15} textAnchor="end" height={60} interval={0} />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip
                                    formatter={(value: number | string) => [`${value} Projekte`, 'Anzahl']}
                                />
                                <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot />
                            </LineChart>
                        </ResponsiveContainer>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
