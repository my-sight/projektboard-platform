"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";

interface Props {
  card: {
    id: string;
    number: string;
    title: string;
    statusDot: string;
    batchSK: boolean;
    batchLK: boolean;
    statusShort: string;
    phaseTargetDate: string | null;
    teamMembers: { id: string; displayName: string }[];
    imageUrl: string | null;
    position: number;
    phaseId: string;
  };
  cardSize: "ultra" | "compact" | "large";
  index: number;
  isDragging: boolean;
  onOpen: () => void;
  onToggleSK: (value: boolean) => void;
  onToggleLK: (value: boolean) => void;
}

export function BoardCardSortable({ card, cardSize, index, isDragging, onOpen, onToggleSK, onToggleLK }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({
    id: card.id,
    data: { type: "card", phaseId: card.phaseId, index },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleMouseEnter() {
    timeoutRef.current = setTimeout(() => setShowTooltip(true), 1000);
  }

  function handleMouseLeave() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const statusColor = card.batchSK || card.batchLK || card.statusDot === "red" ? "bg-rose-500" : "bg-emerald-400";
  const riskBorder = card.batchSK ? "border-rose-400" : card.batchLK ? "border-amber-300" : "border-slate-800";

  const baseClass = clsx(
    "relative flex cursor-grab flex-col gap-2 rounded-lg border bg-slate-900/80 p-3 text-sm text-slate-200 shadow transition",
    riskBorder,
    (sortableDragging || isDragging) && "border-primary/60 shadow-elevated",
  );

  const statusContent = useMemo(() => card.statusShort || "Kein Kurzstatus hinterlegt", [card.statusShort]);

  const planDate = card.phaseTargetDate ? new Date(card.phaseTargetDate).toLocaleDateString("de-DE") : "–";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={baseClass}
      data-testid="board-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={clsx("inline-flex h-3 w-3 rounded-full", statusColor)} />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.number}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
          <button
            onClick={() => onToggleSK(!card.batchSK)}
            className={clsx(
              "rounded px-2 py-1",
              card.batchSK ? "bg-rose-500/80 text-rose-950" : "bg-slate-800 text-slate-400",
            )}
          >
            SK
          </button>
          <button
            onClick={() => onToggleLK(!card.batchLK)}
            className={clsx(
              "rounded px-2 py-1",
              card.batchLK ? "bg-amber-300/80 text-amber-900" : "bg-slate-800 text-slate-400",
            )}
          >
            LK
          </button>
          <button
            onClick={onOpen}
            className="rounded bg-slate-800 px-2 py-1 text-slate-300 transition hover:bg-primary/30 hover:text-primary"
          >
            ✎
          </button>
        </div>
      </div>

      {cardSize !== "ultra" ? (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-100">{card.title}</h4>
            <span className="text-xs text-slate-400">Ziel: {planDate}</span>
          </div>
          <p
            className="relative cursor-help text-xs text-slate-400"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {statusContent}
            {showTooltip ? (
              <span className="absolute left-0 top-full z-40 mt-2 w-64 rounded-md border border-slate-800 bg-slate-900/95 p-3 text-[11px] text-slate-200 shadow-lg">
                {statusContent}
              </span>
            ) : null}
          </p>
        </>
      ) : null}

      {cardSize === "large" ? (
        <div className="space-y-3 text-xs text-slate-300">
          {card.imageUrl ? (
            <img src={card.imageUrl} alt={card.title} className="h-24 w-full rounded object-cover" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {card.teamMembers.map((member) => (
              <span key={member.id} className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200">
                {member.displayName}
              </span>
            ))}
            {!card.teamMembers.length ? (
              <span className="text-[11px] text-slate-500">Kein Team zugewiesen</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {cardSize === "ultra" ? (
        <div className="flex flex-wrap gap-1 text-[11px] text-slate-400">
          <span>{planDate}</span>
        </div>
      ) : null}
    </div>
  );
}
