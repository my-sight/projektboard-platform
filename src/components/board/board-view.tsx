"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSecureFetch } from "@/hooks/use-secure-fetch";
import { useCsrfToken } from "@/hooks/use-csrf-token";
import { BoardCardSortable } from "@/components/board/boardcard-sortable";
import { CardDetailSheet } from "@/components/board/card-detail-sheet";

interface BoardPhaseDto {
  id: string;
  name: string;
  displayOrder: number;
}

interface BoardCardDto {
  id: string;
  number: string;
  title: string;
  statusDot: string;
  batchSK: boolean;
  batchLK: boolean;
  statusShort: string;
  position: number;
  phaseId: string;
  phaseTargetDate: string | null;
  imageUrl: string | null;
  sop: string | null;
  trDate: string | null;
  trPlanDates: string[];
  trActualDate: string | null;
  projectOwnerId: string | null;
  teamMembers: { id: string; displayName: string; roleText: string | null; userId: string | null }[];
  statusEntries: { id: string; createdAt: string; summary: string; quality: string; cost: string; schedule: string }[];
  subBoard: {
    id: string;
    lanes: { id: string; displayName: string; userId: string | null; sortOrder: number }[];
    columns: { id: string; name: string; order: number }[];
    tasks: {
      id: string;
      text: string;
      laneId: string;
      columnId: string;
      statusDot: string;
      planDate: string | null;
      sortOrder: number;
      projectNumberBadge: string | null;
      archivedAt: string | null;
    }[];
  } | null;
}

interface BoardResponse {
  board: {
    id: string;
    name: string;
    phases: BoardPhaseDto[];
    projectCards: BoardCardDto[];
  };
}

type CardSize = "ultra" | "compact" | "large";

export function BoardView({ boardId }: { boardId: string }) {
  const [cardSize, setCardSize] = useState<CardSize>("compact");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const secureFetch = useSecureFetch();
  const queryClient = useQueryClient();
  const { refetch: refetchCsrf } = useCsrfToken();

  useEffect(() => {
    refetchCsrf();
  }, [refetchCsrf]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Board konnte nicht geladen werden");
      }
      const data = (await res.json()) as BoardResponse;
      const cards = data.board.projectCards.map((card) => ({
        ...card,
        trPlanDates: Array.isArray(card.trPlanDates) ? card.trPlanDates : [],
      }));
      return { ...data.board, projectCards: cards };
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ cardId, phaseId, position }: { cardId: string; phaseId: string; position: number }) => {
      await secureFetch(`/api/projects/${cardId}`, {
        method: "POST",
        body: JSON.stringify({ type: "move", phaseId, position }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const toggleSkMutation = useMutation({
    mutationFn: async ({ cardId, value }: { cardId: string; value: boolean }) => {
      await secureFetch(`/api/projects/${cardId}`, {
        method: "POST",
        body: JSON.stringify({ type: "toggleSK", value }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const toggleLkMutation = useMutation({
    mutationFn: async ({ cardId, value }: { cardId: string; value: boolean }) => {
      await secureFetch(`/api/projects/${cardId}`, {
        method: "POST",
        body: JSON.stringify({ type: "toggleLK", value }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
  });

  const board = boardQuery.data;

  const phases = useMemo(() => {
    return board?.phases.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? [];
  }, [board]);

  const cardsByPhase = useMemo(() => {
    const map = new Map<string, BoardCardDto[]>();
    if (!board) return map;
    for (const phase of phases) {
      map.set(
        phase.id,
        board.projectCards
          .filter((card) => card.phaseId === phase.id)
          .slice()
          .sort((a, b) => a.position - b.position),
      );
    }
    return map;
  }, [board, phases]);

  function handleDragStart(event: DragStartEvent) {
    setDraggingCardId(String(event.active.id));
  }

  function computePosition(cards: BoardCardDto[], index: number) {
    if (!cards.length) {
      return 1;
    }
    const previous = cards[index - 1];
    const next = cards[index];
    if (!previous && !next) {
      return cards[0].position;
    }
    if (!previous && next) {
      return Math.max(next.position - 1, next.position / 2);
    }
    if (previous && !next) {
      return previous.position + 1;
    }
    if (previous && next) {
      return (previous.position + next.position) / 2;
    }
    return index + 1;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingCardId(null);
    if (!over || !board) {
      return;
    }
    const activeId = String(active.id);
    const activeCard = board.projectCards.find((card) => card.id === activeId);
    if (!activeCard) {
      return;
    }

    const overData = over.data.current as { type?: string; phaseId?: string; index?: number } | undefined;
    const activeData = active.data.current as { phaseId?: string } | undefined;

    let targetPhaseId = overData?.phaseId ?? activeCard.phaseId;
    let targetIndex = overData?.index ?? cardsByPhase.get(targetPhaseId)?.length ?? 0;

    if (overData?.type === "card" && typeof overData.index === "number") {
      targetIndex = overData.index;
    } else if (overData?.type === "column") {
      targetIndex = cardsByPhase.get(targetPhaseId)?.length ?? 0;
    }

    if (activeData?.phaseId === targetPhaseId && targetIndex === overData?.index) {
      return;
    }

    const cardsTarget = (cardsByPhase.get(targetPhaseId) ?? []).filter((card) => card.id !== activeId);
    const position = computePosition(cardsTarget, targetIndex);
    moveMutation.mutate({ cardId: activeId, phaseId: targetPhaseId, position });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{board?.name ?? "Board"}</h1>
          <p className="text-sm text-slate-400">Phasenbasierte Übersicht mit Drag & Drop und Statusmanagement.</p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
          <button
            onClick={() => setCardSize("ultra")}
            className={`rounded px-3 py-1 ${cardSize === "ultra" ? "bg-primary/30 text-primary" : "bg-slate-800 text-slate-300"}`}
          >
            Ultrakompakt
          </button>
          <button
            onClick={() => setCardSize("compact")}
            className={`rounded px-3 py-1 ${cardSize === "compact" ? "bg-primary/30 text-primary" : "bg-slate-800 text-slate-300"}`}
          >
            Kompakt
          </button>
          <button
            onClick={() => setCardSize("large")}
            className={`rounded px-3 py-1 ${cardSize === "large" ? "bg-primary/30 text-primary" : "bg-slate-800 text-slate-300"}`}
          >
            Groß
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div className="board-scrollbar grid grid-cols-1 gap-4 overflow-x-auto md:grid-cols-3 xl:grid-cols-4">
          {phases.map((phase) => (
            <PhaseColumn
              key={phase.id}
              phase={phase}
              cards={cardsByPhase.get(phase.id) ?? []}
              cardSize={cardSize}
              draggingCardId={draggingCardId}
              onOpen={(cardId) => setActiveCardId(cardId)}
              onToggleSK={(cardId, value) => toggleSkMutation.mutate({ cardId, value })}
              onToggleLK={(cardId, value) => toggleLkMutation.mutate({ cardId, value })}
            />
          ))}
        </div>
      </DndContext>

      {activeCardId && board ? (
        <CardDetailSheet
          cardId={activeCardId}
          boardId={boardId}
          onClose={() => setActiveCardId(null)}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ["board", boardId] })}
        />
      ) : null}
    </div>
  );
}

interface PhaseColumnProps {
  phase: BoardPhaseDto;
  cards: BoardCardDto[];
  cardSize: CardSize;
  draggingCardId: string | null;
  onOpen: (cardId: string) => void;
  onToggleSK: (cardId: string, value: boolean) => void;
  onToggleLK: (cardId: string, value: boolean) => void;
}

function PhaseColumn({ phase, cards, cardSize, draggingCardId, onOpen, onToggleSK, onToggleLK }: PhaseColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `column-${phase.id}`,
    data: { type: "column", phaseId: phase.id },
  });

  return (
    <div className="flex min-h-[400px] flex-col rounded-lg border border-slate-800 bg-slate-900/50">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{phase.name}</h3>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">{cards.length}</span>
      </header>
      <SortableContext id={`column-${phase.id}`} items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-3 p-3">
          {cards.map((card, index) => (
            <BoardCardSortable
              key={card.id}
              card={card}
              cardSize={cardSize}
              index={index}
              isDragging={draggingCardId === card.id}
              onOpen={() => onOpen(card.id)}
              onToggleSK={(value) => onToggleSK(card.id, value)}
              onToggleLK={(value) => onToggleLK(card.id, value)}
            />
          ))}
          {!cards.length ? (
            <p className="rounded border border-dashed border-slate-700 py-8 text-center text-xs text-slate-500">
              Karten können hierher gezogen werden
            </p>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}
