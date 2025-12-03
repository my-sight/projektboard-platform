'use client';

import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import { Draggable } from '@hello-pangea/dnd';
import { CheckCircle } from '@mui/icons-material'; 
import { keyframes } from '@mui/system';

import { nullableDate, toBoolean } from '@/utils/booleans';
import { ProjectBoardCard, LayoutDensity } from '@/types';

export type KanbanDensity = LayoutDensity;

const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); border-color: #ffc107; }
  50% { box-shadow: 0 0 0 10px rgba(25, 118, 210, 0); border-color: #ffc107; background-color: rgba(255, 249, 196, 0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
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
  onClick
}: KanbanCardProps) {
  const cardId = idFor(card);
  const isDragDisabled = !canModify;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [highlighted]);

  const usersById = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach((user) => { if (user && user.id) map.set(String(user.id), user); });
    return map;
  }, [users]);

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

  let backgroundColor = 'white';
  if (isYellow) backgroundColor = '#fff3e0'; 
  if (isRed) backgroundColor = '#ffebee';    
  
  let borderColor = 'rgba(0,0,0,0.12)'; 
  if (isYellow) borderColor = '#ef6c00'; 
  if (isRed) borderColor = '#c62828';    
  
  const ampelColor = isYellow || isRed ? '#ff5a5a' : '#14c38e';

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

  // Hilfsfunktion für TR Chips
  const renderTRChip = (label: string, value: string | Date | undefined, type: 'original' | 'new'): ReactNode => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;

    // Farben: TR=Blau, TRneu=Grün
    const colors = type === 'original' 
        ? { bg: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9' } 
        : { bg: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }; 

    return (
        <Chip 
            label={`${label}: ${date.toLocaleDateString('de-DE')}`} 
            size="small" 
            sx={{ 
                fontSize: '10px', 
                height: '18px', 
                backgroundColor: colors.bg, 
                color: colors.color, 
                border: colors.border, 
                '& .MuiChip-label': { px: 0.8, py: 0 } 
            }} 
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
          className={`card ${isYellow ? 'esk-lk' : ''} ${isRed ? 'esk-sk' : ''}`}
          onClick={(e) => { 
              if (!canModify) return; 
              if (!(e.target as HTMLElement).closest('.controls')) { 
                  if(onClick) onClick(); 
                  else { setSelectedCard(card); setEditModalOpen(true); setEditTabValue(0); }
              } 
          }}
          sx={{
            backgroundColor, border: `1px solid ${borderColor}`, borderRadius: currentSize === 'xcompact' ? '4px' : '4px', padding: currentSize === 'xcompact' ? '4px' : '10px',
            cursor: 'pointer', transition: 'transform 0.12s ease, box-shadow 0.12s ease', opacity: snapshot.isDragging ? 0.96 : 1,
            transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'none',
            boxShadow: snapshot.isDragging ? '0 14px 28px rgba(0,0,0,0.30)' : '0 3px 8px rgba(0,0,0,0.06)',
            minHeight: currentSize === 'xcompact' ? '18px' : currentSize === 'large' ? '150px' : '80px',
            display: 'flex', flexDirection: 'column', position: 'relative',
            '&:hover': { transform: snapshot.isDragging ? 'rotate(2deg) scale(1.03)' : 'translateY(-2px)', boxShadow: '0 6px 14px rgba(0,0,0,0.18)' },
            animation: highlighted ? `${blinkAnimation} 1s 5` : 'none', borderColor: highlighted ? '#ffc107' : borderColor,
          }}
        >
          {currentSize === 'xcompact' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', gap: 0.5, padding: '2px' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: ampelColor, border: '1px solid var(--line)', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--ink)', fontSize: '10px', whiteSpace: 'nowrap' }}>{card.Nummer}</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: ampelColor, border: '1px solid var(--line)', flexShrink: 0 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>{card.Nummer}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {hasChecklist && (
                    <Chip label={`${doneChecklist}/${totalChecklist}`} size="small" sx={{ height: 18, fontSize: '10px', backgroundColor: doneChecklist===totalChecklist ? '#e8f5e9' : '#f5f5f5', color: doneChecklist===totalChecklist ? '#2e7d32' : 'inherit' }} />
                  )}
                  {hasPriority && <Chip label="!" size="small" color="error" sx={{ fontWeight: 700, height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '12px' } }} />}
                  <Box className="controls" sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" sx={{ width: 22, height: 22, fontSize: '10px', border: '1px solid var(--line)', backgroundColor: currentSize === 'large' ? '#e3f2fd' : 'transparent', color: currentSize === 'large' ? '#1976d2' : 'var(--muted)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' } }} 
                        aria-label="Größe umschalten" 
                        disabled={!canModify} 
                        onClick={(e) => { e.stopPropagation(); handleUpdateCard({ Collapsed: currentSize === 'large' ? '' : 'large' }); }}>↕</IconButton>
                    
                    <IconButton 
                        size="small" 
                        sx={{ width: 22, height: 22, fontSize: '9px', border: '1px solid var(--line)', backgroundColor: isYellow ? '#ef6c00' : 'transparent', color: isYellow ? 'white' : 'var(--muted)', '&:hover': { backgroundColor: isYellow ? '#e65100' : 'rgba(0,0,0,0.06)' } }} 
                        aria-label="Yellow Escalation" 
                        disabled={!canModify} 
                        onClick={(e) => { e.stopPropagation(); handleUpdateCard({ Eskalation: isYellow ? '' : 'Y', Ampel: isYellow ? 'grün' : 'rot' }); }}
                    >Y</IconButton>

                    <IconButton 
                        size="small" 
                        sx={{ width: 22, height: 22, fontSize: '9px', border: '1px solid var(--line)', backgroundColor: isRed ? '#c62828' : 'transparent', color: isRed ? 'white' : 'var(--muted)', '&:hover': { backgroundColor: isRed ? '#b71c1c' : 'rgba(0,0,0,0.06)' } }} 
                        aria-label="Red Escalation" 
                        disabled={!canModify} 
                        onClick={(e) => { e.stopPropagation(); handleUpdateCard({ Eskalation: isRed ? '' : 'R', Ampel: isRed ? 'grün' : 'rot' }); }}
                    >R</IconButton>

                    <IconButton size="small" sx={{ width: 22, height: 22, fontSize: '10px', border: '1px solid var(--line)', backgroundColor: 'transparent', color: 'var(--muted)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' } }} aria-label="Bearbeiten" disabled={!canModify} onClick={(e) => { e.stopPropagation(); setSelectedCard(card); setEditModalOpen(true); setEditTabValue(0); }}>✎</IconButton>
                  </Box>
                </Box>
              </Box>

              {card.Teil && (
                 <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.3, color: 'var(--muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', mb: 1 }}>
                    {card.Teil}
                 </Typography>
              )}
              
              {statusKurz && (
                 // ✅ FIX: Kein MUI-Tooltip mehr, nur normaler Text mit nativem Browser-Tooltip bei Bedarf (durch Ellipsis)
                 <Typography variant="caption" sx={{ 
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
                    cursor: 'help' 
                 }}>
                    {statusKurz}
                 </Typography>
              )}
              
              {currentSize === 'large' && card.Bild && (<Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}><img src={card.Bild} alt="Projektbild" style={{ maxWidth: '100%', maxHeight: '60px', borderRadius: '6px', objectFit: 'cover' }} /></Box>)}

               <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', fontSize: '10px' }}>
                <Typography variant="caption" sx={{ fontSize: '10px', color: 'var(--muted)' }}>{card.Verantwortlich || ''}</Typography>
                {dueDate && <Typography variant="caption" sx={{ fontSize: '9px', color: isOverdue ? '#d32f2f' : 'var(--muted)', fontWeight: isOverdue ? 600 : 400, backgroundColor: isOverdue ? '#ffebee' : 'transparent', padding: isOverdue ? '2px 4px' : '0', borderRadius: isOverdue ? '4px' : '0' }}>{dueDate.toLocaleDateString('de-DE')}</Typography>}
              </Box>
              
              {(card.TR_Datum || card.TR_Neu || sopDate) && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: sopDate ? 'space-between' : 'center', gap: 0.5, alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                       {renderTRChip('TR', card.TR_Datum, 'original')}
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {renderTRChip('TR neu', card.TR_Neu, 'new')}
                          {trCompleted && <CheckCircle sx={{ fontSize: '16px', color: '#2e7d32' }} />}
                          {trDiff !== null && <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 600, color: trDiff > 0 ? '#d32f2f' : '#2e7d32' }}>{trDiff > 0 ? `+${trDiff}` : trDiff}</Typography>}
                       </Box>
                    </Box>
                    {sopDate && <Chip label={`SOP: ${sopDate.toLocaleDateString('de-DE')}`} size="small" variant="outlined" sx={{ fontSize: '10px', height: '18px', color: '#6a1b9a', borderColor: '#e1bee7', '& .MuiChip-label': { px: 0.8, py: 0 } }} />}
                  </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Draggable>
  );
}