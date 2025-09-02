import { Paper, Typography, Box } from '@mui/material';
import { Column as ColumnType } from '@/types';
import TaskCard from './TaskCard';

interface ColumnProps {
  column: ColumnType;
}

export default function Column({ column }: ColumnProps) {
  return (
    <Paper sx={{ p: 2, minHeight: 400, width: 300, mr: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {column.title}
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          ({column.tasks.length})
        </Typography>
      </Typography>
      
      <Box>
        {column.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </Box>
    </Paper>
  );
}
