'use client';

import { ReactNode, useMemo } from 'react';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import { Draggable } from '@hello-pangea/dnd';

import { nullableDate, toBoolean } from '@/utils/booleans';

export type KanbanDensity = 'compact' | 'xcompact' | 'large';

export interface KanbanCardProps {
  card: any;
  index: number;
  density: KanbanDensity;
  rows: any[];
  setRows: (rows: any[]) => void;
  saveCards: () => Promise<boolean | void> | boolean | void;
  setSelectedCard: (card: any) => void;
  setEditModalOpen: (open: boolean) => void;
  setEditTabValue: (value: number) => void;
  inferStage: (card: any) => string;
  idFor: (card: any) => string;
  users: Array<{
    id: string;
    name?: string;
    full_name?: string;
    email?: string;
    department?: string | null;
    company?: string | null;
  }>;
}

const statusKeys = ['message', 'qualitaet', 'kosten', 'termine'];

export function KanbanCard({
  card,
  index,
  density,
  rows,
  setRows,
  saveCards,
  setSelectedCard,
  setEditModalOpen,
  setEditTabValue,
  inferStage,
  idFor,
  users,
}: KanbanCardProps) {
  const cardId = idFor(card);
  const stage = inferStage(card);

  const usersById = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach((user) => {
      if (user && user.id) {
        map.set(String(user.id), user);
      }
    });
    return map;
  }, [users]);

  const escalation = String(card.Eskalation || '').trim().toUpperCase();
  const hasLKEscalation = escalation === 'LK';
  const hasSKEscalation = escalation === 'SK';

  let statusKurz = '';
  if (Array.isArray(card.StatusHistory) && card.StatusHistory.length) {
    const latest = card.StatusHistory[0];
    statusKeys.some((key) => {
      const entry = latest[key as keyof typeof latest] as any;
      if (entry && entry.text && entry.text.trim()) {
        statusKurz = entry.text.trim();
        return true;
      }
      return false;
    });
  } else {
    statusKurz = String(card['Status Kurz'] || '').trim();
  }

  const dueDate = nullableDate(card['Due Date']);
  const trCompleted = toBoolean(card['TR_Completed']);
  const isOverdue = !!dueDate && !trCompleted && dueDate < new Date();
  const trOriginalDate = nullableDate(card['TR_Datum']);
  const trCompletedDate = nullableDate(card['TR_Completed_At'] || card['TR_Completed_Date']);
  const trCompletionDiff = trOriginalDate && trCompletedDate
    ? Math.round((trCompletedDate.getTime() - trOriginalDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const hasPriority = toBoolean(card['Priorität']);
  const sopDate = nullableDate(card['SOP_Datum']);

  let currentSize: KanbanDensity = density;
  if (card['Collapsed'] === 'large') {
    currentSize = 'large';
  } else if (card['Collapsed'] === 'compact') {
    currentSize = 'compact';
  }

  let backgroundColor = 'white';
  if (hasLKEscalation) backgroundColor = '#fff3e0';
  if (hasSKEscalation) backgroundColor = '#ffebee';

  let borderColor = 'var(--line)';
  if (hasLKEscalation) borderColor = '#ef6c00';
  if (hasSKEscalation) borderColor = '#c62828';

  const ampelColor = hasLKEscalation || hasSKEscalation ? '#ff5a5a' : '#14c38e';

  const updateCard = (updates: any) => {
    const cardIndex = rows.findIndex((c: any) => idFor(c) === cardId);
    if (cardIndex >= 0) {
      const newRows = [...rows];
      newRows[cardIndex] = { ...newRows[cardIndex], ...updates };
      setRows(newRows);

      setTimeout(() => {
        saveCards();
      }, 200);
    }
  };

  const handleOpenEdit = () => {
    setSelectedCard(card);
    setEditModalOpen(true);
    setEditTabValue(1);
  };

  const renderTRChip = (label: string, value: string | Date, color: string, border: string, background: string): ReactNode => {
    if (!value) return null;
    const date = new Date(value);
    return (
      <Chip
        label={`${label}: ${date.toLocaleDateString('de-DE')}`}
        size="small"
        sx={{
          fontSize: '10px',
          height: '18px',
          backgroundColor: background,
          color,
          border,
          '& .MuiChip-label': {
            px: 0.8,
            py: 0,
          },
        }}
      />
    );
  };

  return (
    <Draggable key={cardId} draggableId={cardId} index={index}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`card ${hasLKEscalation ? 'esk-lk' : ''} ${hasSKEscalation ? 'esk-sk' : ''}`}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('.controls')) {
              setSelectedCard(card);
              setEditModalOpen(true);
              setEditTabValue(1);
            }
          }}
          sx={{
            backgroundColor,
            border: `1px solid ${borderColor}`,
            borderRadius: currentSize === 'xcompact' ? '4px' : '12px',
            padding: currentSize === 'xcompact' ? '4px' : '10px',
            cursor: 'pointer',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            opacity: snapshot.isDragging ? 0.96 : 1,
            transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'none',
            boxShadow: snapshot.isDragging
              ? '0 14px 28px rgba(0,0,0,0.30)'
              : '0 3px 8px rgba(0,0,0,0.06)',
            minHeight:
              currentSize === 'xcompact' ? '18px' : currentSize === 'large' ? '150px' : '80px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            '&:hover': {
              transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'translateY(-2px)',
              boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
            },
          }}
          title={statusKurz || ''}
        >
          {currentSize === 'xcompact' ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
                gap: 0.5,
                padding: '2px',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '2px',
                  backgroundColor: ampelColor,
                  border: '1px solid var(--line)',
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'var(--ink)',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                }}
              >
                {card['Nummer']}
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: ampelColor,
                      border: '1px solid var(--line)',
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      fontSize: '14px',
                      color: 'var(--ink)',
                    }}
                  >
                    {card['Nummer']}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {hasPriority && (
                    <Chip
                      label="!"
                      size="small"
                      color="error"
                      sx={{
                        fontWeight: 700,
                        height: 20,
                        '& .MuiChip-label': {
                          px: 0.75,
                          fontSize: '12px',
                        },
                      }}
                    />
                  )}
                  <Box className="controls" sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    sx={{
                      width: 22,
                      height: 22,
                      fontSize: '10px',
                      border: '1px solid var(--line)',
                      backgroundColor: currentSize === 'large' ? '#e3f2fd' : 'transparent',
                      color: currentSize === 'large' ? '#1976d2' : 'var(--muted)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' },
                    }}
                    title="Groß/Normal umschalten"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSize = currentSize === 'large' ? '' : 'large';
                      updateCard({ Collapsed: newSize });
                    }}
                  >
                    ↕
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      width: 22,
                      height: 22,
                      fontSize: '9px',
                      border: '1px solid var(--line)',
                      backgroundColor: hasLKEscalation ? '#ef6c00' : 'transparent',
                      color: hasLKEscalation ? 'white' : 'var(--muted)',
                      '&:hover': {
                        backgroundColor: hasLKEscalation ? '#e65100' : 'rgba(0,0,0,0.06)',
                      },
                    }}
                    title="Leitungskreis"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newEskalation = hasLKEscalation ? '' : 'LK';
                      const newAmpel = newEskalation ? 'rot' : 'grün';
                      updateCard({
                        Eskalation: newEskalation,
                        Ampel: newAmpel,
                      });
                    }}
                  >
                    LK
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      width: 22,
                      height: 22,
                      fontSize: '9px',
                      border: '1px solid var(--line)',
                      backgroundColor: hasSKEscalation ? '#c62828' : 'transparent',
                      color: hasSKEscalation ? 'white' : 'var(--muted)',
                      '&:hover': {
                        backgroundColor: hasSKEscalation ? '#b71c1c' : 'rgba(0,0,0,0.06)',
                      },
                    }}
                    title="Strategiekreis"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newEskalation = hasSKEscalation ? '' : 'SK';
                      const newAmpel = newEskalation ? 'rot' : 'grün';
                      updateCard({
                        Eskalation: newEskalation,
                        Ampel: newAmpel,
                      });
                    }}
                  >
                    SK
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      width: 22,
                      height: 22,
                      fontSize: '10px',
                      border: '1px solid var(--line)',
                      backgroundColor: 'transparent',
                      color: 'var(--muted)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' },
                    }}
                    title="Bearbeiten"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit();
                    }}
                  >
                    ✎
                  </IconButton>
                  </Box>
                </Box>
              </Box>

              {card['Teil'] && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '12px',
                    lineHeight: 1.3,
                    color: 'var(--muted)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    mb: 1,
                  }}
                >
                  {card['Teil']}
                </Typography>
              )}

              {statusKurz && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '12px',
                    color: 'var(--muted)',
                    overflow: 'hidden',
                    textOverflow: currentSize === 'large' ? 'clip' : 'ellipsis',
                    whiteSpace: currentSize === 'large' ? 'pre-wrap' : 'nowrap',
                    display: currentSize === 'large' ? '-webkit-box' : 'block',
                    WebkitLineClamp: currentSize === 'large' ? 6 : undefined,
                    WebkitBoxOrient: currentSize === 'large' ? 'vertical' : undefined,
                    mb: 0.5,
                    wordBreak: currentSize === 'large' ? 'break-word' : 'normal',
                  }}
                >
                  {statusKurz}
                </Typography>
              )}

              {currentSize === 'large' && card['Bild'] && (
                <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={card['Bild']}
                    alt="Projektbild"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '60px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                    }}
                  />
                </Box>
              )}

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 'auto',
                  fontSize: '10px',
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '10px', color: 'var(--muted)' }}>
                  {card['Verantwortlich'] || ''}
                </Typography>

                {dueDate && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '9px',
                      color: isOverdue ? '#d32f2f' : 'var(--muted)',
                      fontWeight: isOverdue ? 600 : 400,
                      backgroundColor: isOverdue ? '#ffebee' : 'transparent',
                      padding: isOverdue ? '2px 4px' : '0',
                      borderRadius: isOverdue ? '4px' : '0',
                    }}
                  >
                    {dueDate.toLocaleDateString('de-DE')}
                  </Typography>
                )}
              </Box>

              {(card['TR_Datum'] || card['TR_Neu'] || sopDate) && (
                <Box
                  sx={{
                    mt: 1,
                    pt: 1,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: sopDate ? 'space-between' : 'center',
                    gap: 0.5,
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {renderTRChip(
                      'TR',
                      card['TR_Datum'],
                      '#2e7d32',
                      '1px solid #c8e6c9',
                      '#e8f5e8',
                    )}
                    {renderTRChip(
                      'TR neu',
                      card['TR_Neu'],
                      '#1976d2',
                      '1px solid #bbdefb',
                      '#e3f2fd',
                    )}
                  </Box>
                  {sopDate && (
                    <Chip
                      label={`SOP: ${sopDate.toLocaleDateString('de-DE')}`}
                      size="small"
                      sx={{
                        fontSize: '10px',
                        height: '18px',
                        backgroundColor: '#f3e5f5',
                        color: '#6a1b9a',
                        border: '1px solid #e1bee7',
                        '& .MuiChip-label': {
                          px: 0.8,
                          py: 0,
                        },
                      }}
                    />
                  )}
                </Box>
              )}

              {(card['TR_Neu'] || card['TR_Datum']) && trCompleted && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Chip label="✓ TR erledigt" size="small" color="success" />
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: '#2e7d32', fontWeight: 500 }}
                  >
                    Abschluss: {trCompletedDate ? trCompletedDate.toLocaleDateString('de-DE') : 'Datum unbekannt'}
                    {trCompletionDiff !== null ? ` (${trCompletionDiff >= 0 ? '+' : ''}${trCompletionDiff} Tage)` : ''}
                  </Typography>
                </Box>
              )}

              {currentSize === 'large' &&
                card['Team'] &&
                Array.isArray(card['Team']) &&
                card['Team'].length > 0 && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid var(--line)' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '10px',
                        color: 'var(--muted)',
                        fontWeight: 600,
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      Team ({card['Team'].filter((m: any) => m.userId || m.name).length}):
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {card['Team']
                        .filter((member: any) => member.userId || member.name)
                        .map((member: any, idx: number) => {
                          const roleColors: Record<string, string> = {
                            entwickler: '#2196f3',
                            designer: '#9c27b0',
                            manager: '#ff9800',
                            tester: '#4caf50',
                          };
                          const roleKey = String(member.role || '').toLowerCase();
                          const roleColor = roleColors[roleKey] || '#757575';

                          const lookupUser = member.userId
                            ? usersById.get(String(member.userId))
                            : undefined;
                          const resolvedName =
                            (lookupUser?.full_name || lookupUser?.name || '').trim() ||
                            (member.name || '').trim();
                          const fallbackEmail = lookupUser?.email || member.email || '';
                          const displayName =
                            resolvedName ||
                            (fallbackEmail ? fallbackEmail.split('@')[0] : 'Unbekannt');
                          const department =
                            lookupUser?.department ||
                            lookupUser?.company ||
                            member.department ||
                            member.company ||
                            '';
                          const labelParts = [displayName];
                          if (department) {
                            labelParts.push(`– ${department}`);
                          }
                          if (member.role) {
                            labelParts.push(`(${member.role})`);
                          }
                          const label = labelParts.join(' ');

                          return (
                            <Chip
                              key={idx}
                              label={label}
                              size="small"
                              sx={{
                                fontSize: '8px',
                                height: 18,
                                backgroundColor: `${roleColor}20`,
                                color: roleColor,
                                border: `1px solid ${roleColor}`,
                                '& .MuiChip-label': {
                                  px: 1,
                                  py: 0,
                                  fontWeight: 500,
                                },
                              }}
                            />
                          );
                        })}
                    </Box>
                  </Box>
                )}
            </>
          )}
        </Box>
      )}
    </Draggable>
  );
}
