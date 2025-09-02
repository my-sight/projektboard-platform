'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Box, 
  IconButton,
  Avatar,
  Tooltip
} from '@mui/material';
import { 
  Edit as EditIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as WarningIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExtendedCard } from '@/types';

interface TaskCardProps {
  card: ExtendedCard;
  onEdit: (card: ExtendedCard) => void;
  onToggleCollapse: (cardId: string) => void;
  onEscalate: (cardId: string, level: 'LK' | 'SK' | null) => void;
  density?: 'compact' | 'normal' | 'large';
}

export default function TaskCard({ 
  card, 
  onEdit, 
  onToggleCollapse, 
  onEscalate,
  density = 'normal'
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: ExtendedCard['priority']) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getEscalationColor = () => {
    if (card.escalation === 'SK') return '#c62828';
    if (card.escalation === 'LK') return '#ef6c00';
    return '#14c38e';
  };

  const isOverdue = card.due_date && new Date(card.due_date) <= new Date();

  const getStatusSummary = () => {
    if (!card.status_history?.length) return '';
    const latest = card.status_history[0];
    return latest.message.text || '';
  };

  const getResponsibleAbbr = () => {
    if (!card.assignee?.display_name) return '';
    const parts = card.assignee.display_name.split(' ').filter(Boolean);
    let abbr = parts[0] ? parts[0].charAt(0) : '';
    if (parts.length > 1) abbr += parts[1].charAt(0);
    return abbr.toUpperCase();
  };

  const cardPadding = density === 'compact' ? 1 : density === 'large' ? 2 : 1.5;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: density === 'compact' ? 1 : 2,
        cursor: isDragging ? 'grabbing' : 'grab',
        borderLeft: `4px solid ${getEscalationColor()}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        },
        ...(card.escalation && {
          backgroundColor: card.escalation === 'SK' ? '#ffebee' : '#fff3e0'
        })
      }}
    >
      <CardContent sx={{ pb: `${cardPadding}px !important`, p: cardPadding }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: getEscalationColor(),
                flexShrink: 0
              }}
            />
            <Typography 
              variant="h6" 
              component="h3" 
              sx={{ 
                fontSize: density === 'compact' ? '13px' : '14px',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {card.title}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Chip 
              label={card.priority} 
              size="small" 
              color={getPriorityColor(card.priority)}
            />
            {card.escalation && (
              <Chip
                label={card.escalation}
                size="small"
                sx={{
                  backgroundColor: card.escalation === 'SK' ? '#c62828' : '#ef6c00',
                  color: 'white'
                }}
              />
            )}
          </Box>
        </Box>

        {/* Controls */}
        {density !== 'compact' && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(card.id);
                }}
              >
                {card.collapsed ? <ExpandIcon /> : <CollapseIcon />}
              </IconButton>
              
              <Tooltip title="Leitungskreis">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEscalate(card.id, card.escalation === 'LK' ? null : 'LK');
                  }}
                  sx={{ 
                    color: card.escalation === 'LK' ? '#ef6c00' : 'inherit',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  LK
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Strategiekreis">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEscalate(card.id, card.escalation === 'SK' ? null : 'SK');
                  }}
                  sx={{ 
                    color: card.escalation === 'SK' ? '#c62828' : 'inherit',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  SK
                </IconButton>
              </Tooltip>
              
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card);
                }}
              >
                <EditIcon />
              </IconButton>
            </Box>

            {card.assignee && (
              <Tooltip title={card.assignee.display_name || 'Unbekannt'}>
                {card.assignee.avatar_url ? (
                  <Avatar 
                    src={card.assignee.avatar_url} 
                    sx={{ width: 24, height: 24 }}
                  />
                ) : (
                  <Avatar sx={{ width: 24, height: 24, fontSize: '10px' }}>
                    {getResponsibleAbbr()}
                  </Avatar>
                )}
              </Tooltip>
            )}
          </Box>
        )}

        {/* Content (only if not collapsed) */}
        {!card.collapsed && density !== 'compact' && (
          <>
            {card.description && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 1,
                  fontSize: density === 'large' ? '14px' : '12px'
                }}
              >
                {card.description}
              </Typography>
            )}

            {/* Status Summary */}
            {getStatusSummary() && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 1, 
                  fontStyle: 'italic',
                  fontSize: '12px',
                  color: 'text.secondary'
                }}
              >
                {getStatusSummary()}
              </Typography>
            )}

            {/* Due Date */}
            {card.due_date && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                {isOverdue && <WarningIcon color="error" sx={{ fontSize: 16 }} />}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: isOverdue ? 'error.main' : 'text.secondary',
                    fontWeight: isOverdue ? 'bold' : 'normal'
                  }}
                >
                  Fällig: {new Date(card.due_date).toLocaleDateString('de-DE')}
                </Typography>
              </Box>
            )}

            {/* Swimlane */}
            {card.swimlane && (
              <Chip
                label={card.swimlane}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: '20px' }}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
