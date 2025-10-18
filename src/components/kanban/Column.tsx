import { Paper, Typography, Box } from '@mui/material';
import { BoardColumn } from '@/types';
import TaskCard from './TaskCard';

interface ColumnProps {
  column: BoardColumn;
}

export default function Column({ column }: ColumnProps) {
  return (
    <Paper sx={{ p: 2, minHeight: 400, width: 300, mr: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {column.name}
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {(column.cards?.length ?? 0)}
        </Typography>
      </Typography>

      <Box>
        {(column.cards ?? []).map((card) => (
          <TaskCard key={card.id} task={card} />
        ))}
      </Box>
    </Paper>
  );
}
