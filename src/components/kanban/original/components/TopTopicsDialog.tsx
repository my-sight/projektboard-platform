
import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack, Box, TextField, Chip, IconButton
} from '@mui/material';
import { Star, DeleteOutline, AddCircle } from '@mui/icons-material';
import { supabase } from '@/lib/supabaseClient';
import { StandardDatePicker } from '@/components/common/StandardDatePicker';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

import { TopTopic } from '../types';

interface TopTopicsDialogProps {
    open: boolean;
    onClose: () => void;
    topTopics: TopTopic[];
    boardId: string;
    t: any;
}

export function TopTopicsDialog({
    open,
    onClose,
    topTopics,
    boardId,
    t
}: TopTopicsDialogProps) {
    const [localTopics, setLocalTopics] = useState<TopTopic[]>(topTopics);

    useEffect(() => {
        setLocalTopics(topTopics);
    }, [topTopics]);

    const handleSaveTopic = async (index: number, field: keyof TopTopic, value: any) => {
        const topic = localTopics[index];
        const updated = { ...topic, [field]: value };
        const newTopics = [...localTopics];
        newTopics[index] = updated;
        setLocalTopics(newTopics);

        if (!topic.id.startsWith('temp-')) {
            await supabase.from('board_top_topics').update({ [field]: value }).eq('id', topic.id);
        }
    };

    const handleDateAccept = async (index: number, newValue: dayjs.Dayjs | null) => {
        if (!newValue) return;
        const d = newValue.format('YYYY-MM-DD');
        const kw = `${newValue.isoWeekYear()}-W${newValue.isoWeek()}`;
        const topic = localTopics[index];
        const updated = { ...topic, due_date: d, calendar_week: kw };
        const newTopics = [...localTopics];
        newTopics[index] = updated;
        setLocalTopics(newTopics);

        if (!topic.id.startsWith('temp-')) {
            await supabase.from('board_top_topics').update({ due_date: d, calendar_week: kw }).eq('id', topic.id);
        }
    };

    const handleAdd = async () => {
        if (localTopics.length >= 5) return;
        try {
            const { data, error } = await supabase.from('board_top_topics').insert({
                board_id: boardId,
                title: '',
                position: localTopics.length
            }).select().single();

            if (error || !data) throw error;

            const newTopic: TopTopic = {
                id: data.id,
                title: data.title,
                position: data.position,
                due_date: data.due_date,
                calendar_week: data.calendar_week
            };
            setLocalTopics([...localTopics, newTopic]);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        await supabase.from('board_top_topics').delete().eq('id', id);
        setLocalTopics(localTopics.filter(t => t.id !== id));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Star color="warning" /> {t('kanban.topTopicsTitle')}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {localTopics.length === 0 && <Typography variant="body2" color="text.secondary">{t('kanban.noTopTopics')}</Typography>}
                    {localTopics.map((topic, index) => (
                        <Box key={topic.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder={t('kanban.topicPlaceholder')}
                                value={topic.title}
                                onChange={(e) => handleSaveTopic(index, 'title', e.target.value)}
                            />

                            <Box sx={{ width: 200 }}>
                                <StandardDatePicker
                                    label={t('kanban.dueDate')}
                                    value={topic.due_date ? dayjs(topic.due_date) : null}
                                    onChange={(newValue) => handleDateAccept(index, newValue)}
                                />
                            </Box>
                            <Chip
                                label={(() => {
                                    if (topic.calendar_week && topic.calendar_week.includes('-W')) {
                                        return `KW ${topic.calendar_week.split('-W')[1]}`;
                                    }
                                    if (topic.due_date) {
                                        return `KW ${dayjs(topic.due_date).isoWeek()}`;
                                    }
                                    return 'KW -';
                                })()}
                            />
                            <IconButton color="error" onClick={() => handleDelete(topic.id)}><DeleteOutline /></IconButton>
                        </Box>
                    ))}
                    {localTopics.length < 5 && <Button startIcon={<AddCircle />} onClick={handleAdd}>{t('kanban.addTopic')}</Button>}
                </Stack>
            </DialogContent>
            <DialogActions><Button onClick={onClose}>{t('kanban.close')}</Button></DialogActions>
        </Dialog >
    );
};
