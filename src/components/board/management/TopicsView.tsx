
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useLanguage } from '@/contexts/LanguageContext';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import { Topic, TopicDraft } from './types';

interface TopicsViewProps {
    topics: Topic[];
    topicDrafts: Record<string, TopicDraft>;
    onUpdateDraft: (key: string, draft: Partial<TopicDraft>) => void;
    onCreateTopic: () => void;
    onDeleteTopic: (id: string) => void;
    canEdit: boolean;
}

export function TopicsView({
    topics,
    topicDrafts,
    onUpdateDraft,
    onCreateTopic,
    onDeleteTopic,
    canEdit,
}: TopicsViewProps) {
    const { t } = useLanguage();

    return (
        <Card>
            <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                    <Box>
                        <Typography variant="h6">⭐ {t('boardManagement.topTopicsTitle')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('boardManagement.topTopicsDesc')}
                        </Typography>
                    </Box>
                </Stack>

                <Stack spacing={3} sx={{ mt: 3 }}>
                    {/* Compose Area */}
                    {canEdit && topics.length < 5 && (
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('boardManagement.createTopicTitle')}</Typography>
                            <Stack spacing={2}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    placeholder={t('boardManagement.topicContent')}
                                    value={topicDrafts['new']?.title || ''}
                                    onChange={(e) => onUpdateDraft('new', { title: e.target.value })}
                                />
                                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                                    <StandardDatePicker
                                        label={t('boardManagement.topicDue')}
                                        value={topicDrafts['new']?.dueDate ? dayjs(topicDrafts['new'].dueDate) : null}
                                        onChange={(newValue) => onUpdateDraft('new', { dueDate: newValue ? newValue.format('YYYY-MM-DD') : '' })}
                                        sx={{ width: 200 }}
                                    />
                                    <Button
                                        variant="contained"
                                        onClick={onCreateTopic}
                                        disabled={!topicDrafts['new']?.title.trim()}
                                    >
                                        {t('boardManagement.saveButton')}
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>
                    )}

                    {/* List Area */}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('boardManagement.currentTopicsTitle')}</Typography>
                        {topics.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">{t('boardManagement.noTopicsCaptured')}</Typography>
                        ) : (
                            <Stack spacing={1}>
                                {topics.map((topic) => (
                                    <Card key={topic.id} variant="outlined">
                                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                                <Box>
                                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{topic.title}</Typography>
                                                    {topic.due_date && (
                                                        <Chip
                                                            label={`${t('boardManagement.dueLabel')}: ${dayjs(topic.due_date).format('DD.MM.YYYY')} (KW ${dayjs(topic.due_date).isoWeek()})`}
                                                            size="small"
                                                            color={dayjs(topic.due_date).isBefore(dayjs(), 'day') ? 'error' : (dayjs(topic.due_date).isSame(dayjs(), 'day') || dayjs(topic.due_date).isSame(dayjs().add(1, 'day'), 'day') ? 'warning' : 'default')}
                                                            variant={dayjs(topic.due_date).isBefore(dayjs(), 'day') || dayjs(topic.due_date).isSame(dayjs(), 'day') || dayjs(topic.due_date).isSame(dayjs().add(1, 'day'), 'day') ? 'filled' : 'outlined'}
                                                            sx={{ mt: 1, height: 20, fontSize: '0.75rem' }}
                                                        />
                                                    )}
                                                </Box>
                                                {canEdit && (
                                                    <IconButton size="small" color="error" onClick={() => onDeleteTopic(topic.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </CardContent>
        </Card >
    );
}
