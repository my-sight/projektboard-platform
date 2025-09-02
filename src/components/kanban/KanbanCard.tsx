'use client';

import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Box, 
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Flag as FlagIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Comment as CommentIcon
} from '@mui/icons-material';
import { Card as CardType } from '@/types';

interface KanbanCardProps {
  card: CardType;
  onClick: () => void;
  isDragging?: boolean;
  density?: 'compact' | 'normal' | 'comfortable';
}

export default function KanbanCard({ card, onClick, isDragging, density = 'normal' }: KanbanCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'success';
      case 'in_progress': return 'primary';
      case 'review': return 'warning';
      case 'blocked': return 'error';
      default: return 'default';
    }
  };

  const isOverdue = card.due_date && new Date(card.due_date) < new Date();
  const isDueSoon = card.due_date && 
    new Date(card.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) &&
    new Date(card.due_date) >= new Date();

  const spacing = density === 'compact' ? 1 : density === 'comfortable' ? 2 : 1.5;
  const fontSize = density === 'compact' ? '0.875rem' : '1rem';

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: isDragging ? 'rotate(5deg)' : 'none',
        opacity: isDragging ? 0.8 : 1,
        '&:hover': {
          transform: isDragging ? 'rotate(5deg)' : 'translateY(-2px)',
          boxShadow: 3
        },
        border: 1,
        borderColor: 'divider',
        borderLeft: 4,
        borderLeftColor: getPriorityColor(card.priority)
      }}
    >
      <CardContent sx={{ p: spacing, '&:last-child': { pb: spacing } }}>
        {/* Title */}
        <Typography 
          variant="subtitle2" 
          component="h3" 
          gutterBottom
          sx={{ 
            fontSize,
            fontWeight: 600,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: density === 'compact' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {card.title}
        </Typography>

        {/* Description (if not compact) */}
        {density !== 'compact' && card.description && (
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              fontSize: '0.875rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 1
            }}
          >
            {card.description}
          </Typography>
        )}

        {/* Tags from metadata */}
        {card.metadata?.tags && card.metadata.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            {card.metadata.tags.slice(0, 3).map((tag: string, index: number) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ 
                  height: density === 'compact' ? 20 : 24,
                  fontSize: '0.75rem'
                }}
              />
            ))}
            {card.metadata.tags.length > 3 && (
              <Chip
                label={`+${card.metadata.tags.length - 3}`}
                size="small"
                variant="outlined"
                sx={{ 
                  height: density === 'compact' ? 20 : 24,
                  fontSize: '0.75rem'
                }}
              />
            )}
          </Box>
        )}

        {/* Status Chip */}
        {card.status !== 'open' && (
          <Box sx={{ mb: 1 }}>
            <Chip
              label={card.status.replace('_', ' ')}
              size="small"
              color={getStatusColor(card.status) as any}
              sx={{ 
                height: density === 'compact' ? 20 : 24,
                fontSize: '0.75rem',
                textTransform: 'capitalize'
              }}
            />
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mt: 1
        }}>
          {/* Left side - Due date and priority */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Priority indicator */}
            {card.priority !== 'medium' && (
              <Tooltip title={`Priorität: ${card.priority}`}>
                <FlagIcon 
                  sx={{ 
                    fontSize: 16, 
                    color: getPriorityColor(card.priority)
                  }} 
                />
              </Tooltip>
            )}

            {/* Due date */}
            {card.due_date && (
              <Tooltip title={`Fällig: ${new Date(card.due_date).toLocaleDateString('de-DE')}`}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  color: isOverdue ? 'error.main' : isDueSoon ? 'warning.main' : 'text.secondary'
                }}>
                  <ScheduleIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    {new Date(card.due_date).toLocaleDateString('de-DE', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </Typography>
                </Box>
              </Tooltip>
            )}

            {/* Comments indicator */}
            {card.metadata?.comments && card.metadata.comments.length > 0 && (
              <Tooltip title={`${card.metadata.comments.length} Kommentare`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <CommentIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    {card.metadata.comments.length}
                  </Typography>
                </Box>
              </Tooltip>
            )}
          </Box>

          {/* Right side - Assignee */}
          {card.assignee && (
            <Tooltip title={`Zugewiesen an: ${card.assignee.display_name || card.assignee.email}`}>
              <Avatar 
                sx={{ 
                  width: density === 'compact' ? 24 : 28, 
                  height: density === 'compact' ? 24 : 28,
                  fontSize: '0.75rem'
                }}
                src={card.assignee.avatar_url}
              >
                {(card.assignee.display_name || card.assignee.email).charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
