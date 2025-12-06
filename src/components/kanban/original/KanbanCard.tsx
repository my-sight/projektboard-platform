'use client';

import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Box, Chip, IconButton, Typography, Card, CardContent, Avatar, Tooltip } from '@mui/material';
import { Draggable } from '@hello-pangea/dnd';
import { CheckCircle, AccessTime, Warning, PriorityHigh, UnfoldMore, UnfoldLess, ArrowCircleRight } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { alpha, useTheme } from '@mui/material/styles';

import { nullableDate, toBoolean } from '@/utils/booleans';
import { ProjectBoardCard, LayoutDensity } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

export type KanbanDensity = LayoutDensity;

const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); border-color: #3b82f6; }
  50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); border-color: #3b82f6; background-color: rgba(59, 130, 246, 0.1); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
`;

export interface KanbanCardProps {
  card: ProjectBoardCard;
  index: number;
  density: LayoutDensity;
  rows: ProjectBoardCard[];
  setRows: (rows: ProjectBoardCard[]) => void;
  saveCards: () => Promise<boolean | void> | boolean | void;
  patchCard: (card: ProjectBoardCard, changes: Partial<ProjectBoardCard>) => Promise<void | boolean>;
  setSelectedCard: (card: ProjectBoardCard) => void;
  setEditModalOpen: (open: boolean) => void;
  setEditTabValue: (value: number) => void;
  inferStage: (card: ProjectBoardCard) => string;
  idFor: (card: ProjectBoardCard) => string;
  users: Array<{ id: string; name?: string; full_name?: string; email?: string; department?: string | null; company?: string | null; }>;
  canModify: boolean;
  highlighted?: boolean;
  checklistTemplates: Record<string, string[]>;
  onClick?: () => void;
  trLabel?: string;
  sopLabel?: string;
}

const statusKeys = ['message', 'qualitaet', 'kosten', 'termine'] as const;

export function KanbanCard({
  card,
  index,
  density,
  rows,
  setRows,
  saveCards,
  patchCard,
  setSelectedCard,
  setEditModalOpen,
  setEditTabValue,
  inferStage,
  idFor,
  users,
  canModify,
  highlighted,
  checklistTemplates,
  onClick,
  trLabel = 'TR',
  sopLabel = 'SOP',
}: KanbanCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const cardId = idFor(card);
  const isDragDisabled = !canModify;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [highlighted]);

  // Eskalations-Logik
  const rawEscalation = String(card.Eskalation || '').trim().toUpperCase();
  const isYellow = rawEscalation === 'Y' || rawEscalation === 'LK';
  const isRed = rawEscalation === 'R' || rawEscalation === 'SK';

  let statusKurz = '';
  if (Array.isArray(card.StatusHistory) && card.StatusHistory.length) {
    const latest = card.StatusHistory[0];
    statusKeys.some((key) => {
      const entry = (latest as any)[key];
      if (entry && entry.text && entry.text.trim()) { statusKurz = entry.text.trim(); return true; }
      return false;
    });
  } else {
    statusKurz = String(card['Status Kurz'] || '').trim();
  }

  const dueDate = nullableDate(card['Due Date']);
  const trCompleted = toBoolean(card.TR_Completed);
  const isOverdue = !!dueDate && !trCompleted && dueDate < new Date();
  const hasPriority = toBoolean(card.Priorität);
  const sopDate = nullableDate(card.SOP_Datum);

  const trOriginalDate = nullableDate(card.TR_Datum);
  const trNeuDate = nullableDate(card.TR_Neu);
  const trDiff = trOriginalDate && trNeuDate
    ? Math.round((trNeuDate.getTime() - trOriginalDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const stage = inferStage(card);
  const templateTasks = checklistTemplates?.[stage] || [];
  const totalChecklist = templateTasks.length;
  const doneChecklist = templateTasks.filter(task => card.ChecklistDone?.[stage]?.[task]).length;
  const hasChecklist = totalChecklist > 0;

  let currentSize: LayoutDensity = density;
  if (card.Collapsed === 'large') currentSize = 'large';
  else if (card.Collapsed === 'compact') currentSize = 'compact';

  // Dynamic Styles based on status
  let borderColor = alpha(theme.palette.divider, 0.1);
  let glowColor = 'transparent';

  if (isRed) {
    borderColor = theme.palette.error.main;
    glowColor = alpha(theme.palette.error.main, 0.2);
  } else if (isYellow) {
    borderColor = theme.palette.warning.main;
    glowColor = alpha(theme.palette.warning.main, 0.2);
  } else if (hasPriority) {
    borderColor = theme.palette.error.light;
  }

  const handleUpdateCard = (updates: Partial<ProjectBoardCard>) => {
    if (!canModify) return;
    if (patchCard) { patchCard(card, updates); } else {
      const cardIndex = rows.findIndex((c) => idFor(c) === cardId);
      if (cardIndex >= 0) {
        const newRows = [...rows];
        newRows[cardIndex] = { ...newRows[cardIndex], ...updates };
        setRows(newRows);
        setTimeout(() => saveCards(), 200);
      }
    }
  };

  const renderTRChip = (label: string, value: string | Date | undefined, type: 'original' | 'new'): ReactNode => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;

    const color = type === 'original' ? 'info' : 'success';

    return (
      <Chip
        label={`${label}: ${date.toLocaleDateString('de-DE')}`}
        size="small"
        color={color}
        variant="outlined"
        sx={{ fontSize: '0.65rem', height: 20 }}
      />
    );
  };

  return (
    <Draggable key={cardId} draggableId={cardId} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <Box
          ref={(el: HTMLElement | null) => {
            provided.innerRef(el);
            (cardRef as React.MutableRefObject<HTMLElement | null>).current = el;
          }}
          {...provided.draggableProps} {...provided.dragHandleProps}
          sx={{
            mb: 0,
            position: 'relative',
            transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'none',
            zIndex: snapshot.isDragging ? 100 : 1,
            animation: highlighted ? `${blinkAnimation} 1s 5` : 'none',
          }}
        >
          <Card
            className="glass"
            sx={{
              border: '1px solid',
              borderColor: borderColor,
              boxShadow: snapshot.isDragging ? theme.shadows[8] : `0 1px 3px ${alpha(theme.palette.common.black, 0.1)}, 0 0 0 1px ${glowColor}`,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.shadows[3],
                borderColor: theme.palette.primary.main
              },
              bgcolor: isRed ? alpha(theme.palette.error.main, 0.04) : (isYellow ? alpha(theme.palette.warning.main, 0.04) : alpha(theme.palette.background.paper, 0.8))
            }}
            onClick={(e) => {
              if (!canModify) return;
              if (!(e.target as HTMLElement).closest('.controls')) {
                if (onClick) onClick();
                else { setSelectedCard(card); setEditModalOpen(true); setEditTabValue(0); }
              }
            }}
          >
            {currentSize === 'xcompact' ? (
              <Box sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isRed ? 'error.main' : (isYellow ? 'warning.main' : 'success.main') }} />
                <Typography variant="caption" fontWeight={600} noWrap>{card.Nummer}</Typography>
              </Box>
            ) : (
              <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <Chip
                      label={card.Nummer}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main
                      }}
                    />
                    {hasPriority && <PriorityHigh sx={{ fontSize: 14, color: 'error.main' }} />}

                    {/* Escalation Toggle */}
                    <IconButton
                      size="small"
                      sx={{
                        p: 0.5,
                        width: 24,
                        height: 24,
                        color: isRed ? 'error.main' : (isYellow ? 'warning.main' : 'text.disabled'),
                        bgcolor: isRed ? alpha(theme.palette.error.main, 0.1) : (isYellow ? alpha(theme.palette.warning.main, 0.1) : alpha(theme.palette.action.hover, 0.05)),
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: isRed ? alpha(theme.palette.error.main, 0.2) : (isYellow ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.action.hover, 0.1)),
                          transform: 'scale(1.1)'
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        let nextState = '';
                        if (!isYellow && !isRed) nextState = 'Y';
                        else if (isYellow) nextState = 'R';
                        else if (isRed) nextState = '';

                        handleUpdateCard({ Eskalation: nextState });
                      }}
                      title={t('kanban.escalationToggle')}
                    >
                      <Warning sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>

                  <Box className="controls" sx={{ display: 'flex', gap: 0.5, alignItems: 'center', opacity: 0.6, transition: 'opacity 0.2s', '&:hover': { opacity: 1 } }}>
                    <IconButton
                      size="small"
                      sx={{
                        p: 0.25,
                        color: toBoolean(card.PhaseTransition) ? 'primary.main' : 'action.disabled',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateCard({ PhaseTransition: !toBoolean(card.PhaseTransition) });
                      }}
                      title={t('kanban.phaseTransition')}
                    >
                      <ArrowCircleRight fontSize="small" />
                    </IconButton>

                    {/* SOP-Datum */}
                    {sopDate && (
                      <Chip
                        icon={<AccessTime sx={{ fontSize: '0.9rem' }} />}
                        label={`${sopLabel}: ${sopDate.toLocaleDateString('de-DE')}`}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          color: theme.palette.secondary.main,
                          mr: 0.5
                        }}
                      />
                    )}

                    <IconButton
                      size="small"
                      sx={{ p: 0.25 }}
                      onClick={(e) => { e.stopPropagation(); handleUpdateCard({ Collapsed: currentSize === 'large' ? '' : 'large' }); }}
                    >
                      {currentSize === 'large' ? <UnfoldLess fontSize="small" /> : <UnfoldMore fontSize="small" />}
                    </IconButton>
                  </Box>
                </Box>

                <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5, lineHeight: 1.2, fontSize: '0.85rem' }}>
                  {card.Teil || t('kanban.noTitle')}
                </Typography>



                {statusKurz && (
                  <Tooltip title={statusKurz}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: currentSize === 'large' ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: currentSize === 'large' ? 'visible' : 'hidden',
                        mb: 0.5,
                        fontSize: '0.7rem',
                        lineHeight: 1.2
                      }}
                    >
                      {statusKurz}
                    </Typography>
                  </Tooltip>
                )}

                {currentSize === 'large' && card.Bild && (
                  <Box sx={{ mb: 1, borderRadius: 1, overflow: 'hidden' }}>
                    <img src={card.Bild} alt={t('kanban.preview')} style={{ width: '100%', height: 'auto', maxHeight: 180, objectFit: 'contain' }} />
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {card.Verantwortlich && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500 }}>
                          {card.Verantwortlich}
                        </Typography>
                      </Box>
                    )}
                    {hasChecklist && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: doneChecklist === totalChecklist ? 'success.main' : 'text.secondary' }}>
                        <CheckCircle sx={{ fontSize: 12 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                          {doneChecklist}/{totalChecklist}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {dueDate && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isOverdue ? 'error.main' : 'text.secondary' }}>
                      <AccessTime sx={{ fontSize: 12 }} />
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: isOverdue ? 700 : 400 }}>
                        {dueDate.toLocaleDateString('de-DE')}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {(card.TR_Datum || card.TR_Neu) && (
                  <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {renderTRChip(trLabel, trOriginalDate || undefined, 'original')}
                    {renderTRChip(t('kanban.currentNew'), trNeuDate || undefined, 'new')}
                    {trDiff !== null && trDiff !== 0 && (
                      <Chip
                        label={`${trDiff > 0 ? '+' : ''}${trDiff} T`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: trDiff > 0 ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.success.main, 0.1),
                          color: trDiff > 0 ? theme.palette.error.main : theme.palette.success.main,
                          border: '1px solid',
                          borderColor: trDiff > 0 ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.success.main, 0.2)
                        }}
                      />
                    )}
                    {trCompleted && (
                      <Tooltip title={t('kanban.trCompleted')}>
                        <CheckCircle sx={{ fontSize: 14, color: 'success.main', ml: 0.5 }} />
                      </Tooltip>
                    )}
                  </Box>
                )}

                {currentSize === 'large' && card.Team && Array.isArray(card.Team) && card.Team.length > 0 && (
                  <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {card.Team.map((member: any, idx: number) => (
                      <Chip
                        key={idx}
                        avatar={<Avatar sx={{ width: 16, height: 16, fontSize: '0.5rem' }}>{(member.name || '?').charAt(0)}</Avatar>}
                        label={`${member.name || t('kanban.unknown')} ${member.department ? `(${member.department})` : ''}`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.6rem', maxWidth: '100%' }}
                      />
                    ))}
                  </Box>
                )}
              </CardContent>
            )}
          </Card>
        </Box>
      )}
    </Draggable>
  );
}