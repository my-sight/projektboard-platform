'use client';

import { Paper, Typography } from '@mui/material';
import { Card } from '@/types';

interface TaskCardProps {
  task: Card;
}

export default function TaskCard({ task }: TaskCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" component="h3">
        {task.title}
      </Typography>
      {task.description && (
        <Typography variant="body2" color="text.secondary">
          {task.description}
        </Typography>
      )}
    </Paper>
  );
}
