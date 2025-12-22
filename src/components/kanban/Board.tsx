import { Box, Typography } from '@mui/material';
import { Board as BoardType } from '@/types';
import Column from './Column';

interface BoardProps {
  board: BoardType;
}

export default function Board({ board }: BoardProps) {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {board.name}
      </Typography>
      {board.description && (
        <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
          {board.description}
        </Typography>
      )}
      
      <Box sx={{ display: 'flex', overflowX: 'auto', pb: 2 }}>
        {(board.columns ?? []).map((column) => (
          <Column key={column.id} column={column} />
        ))}
      </Box>
    </Box>
  );
}
