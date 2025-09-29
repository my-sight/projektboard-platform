"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useSecureFetch } from "@/hooks/use-secure-fetch";
import { useCsrfToken } from "@/hooks/use-csrf-token";

interface Props {
  boardId: string;
  cardId: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface CardDetail {
  id: string;
  number: string;
  title: string;
  statusShort: string;
  phaseTargetDate: string | null;
  statusDot: string;
  batchSK: boolean;
  batchLK: boolean;
  sop: string | null;
  imageUrl: string | null;
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

type TabKey = "general" | "status" | "team";

export function CardDetailSheet({ boardId, cardId, onClose, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const secureFetch = useSecureFetch();
  useCsrfToken();

  const cardQuery = useQuery({
    queryKey: ["card", cardId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${cardId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Karte konnte nicht geladen werden");
      }
      const data = (await res.json()) as { card: CardDetail };
      return {
        ...data.card,
        trPlanDates: Array.isArray(data.card.trPlanDates) ? data.card.trPlanDates : [],
      };
    },
  });

  const card = cardQuery.data;

  const [title, setTitle] = useState("");
  const [statusShort, setStatusShort] = useState("");
  const [phaseTargetDate, setPhaseTargetDate] = useState<string | null>(null);
  const [sop, setSop] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [trDate, setTrDate] = useState<string | null>(null);
  const [trPlanInput, setTrPlanInput] = useState<string>("");
  const [trActualDate, setTrActualDate] = useState<string | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setStatusShort(card.statusShort ?? "");
      setPhaseTargetDate(card.phaseTargetDate);
      setSop(card.sop ?? "");
      setImageUrl(card.imageUrl ?? "");
      setTrDate(card.trDate ?? null);
      setTrActualDate(card.trActualDate ?? null);
      setProjectOwnerId(card.projectOwnerId ?? "");
    }
  }, [card]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!card) return;
      await secureFetch(`/api/projects/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          statusShort,
          phaseTargetDate: phaseTargetDate,
          sop,
          imageUrl,
          trDate: card.trDate ? undefined : trDate,
          trPlanDateAppend: trPlanInput ? trPlanInput : undefined,
          trActualDate,
          projectOwnerId: projectOwnerId ? projectOwnerId : null,
        }),
      });
    },
    onSuccess: () => {
      cardQuery.refetch();
      setTrPlanInput("");
      onUpdated();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { summary: string; quality: string; cost: string; schedule: string }) => {
      await secureFetch(`/api/projects/${cardId}/status`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      cardQuery.refetch();
      onUpdated();
    },
  });

  const teamCreateMutation = useMutation({
    mutationFn: async (payload: { displayName: string; roleText?: string; userId?: string | null }) => {
      await secureFetch(`/api/projects/${cardId}/team`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      cardQuery.refetch();
      onUpdated();
    },
  });

  const teamUpdateMutation = useMutation({
    mutationFn: async (payload: { id: string; displayName?: string; roleText?: string | null }) => {
      await secureFetch(`/api/projects/${cardId}/team`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      cardQuery.refetch();
      onUpdated();
    },
  });

  const teamDeleteMutation = useMutation({
    mutationFn: async (payload: { id: string }) => {
      await secureFetch(`/api/projects/${cardId}/team`, {
        method: "DELETE",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      cardQuery.refetch();
      onUpdated();
    },
  });

  const subboardMutation = useMutation({
    mutationFn: async () => {
      await secureFetch(`/api/projects/${cardId}/subboard`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      cardQuery.refetch();
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (payload: { laneId: string; columnName: string; text: string; planDate?: string | null }) => {
      if (!card?.subBoard?.id) throw new Error("Kein Unterboard vorhanden");
      await secureFetch(`/api/subboards/${card.subBoard.id}/tasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => cardQuery.refetch(),
  });

  const taskActionMutation = useMutation({
    mutationFn: async (payload: { type: string; taskId: string; laneId?: string; columnId?: string; sortOrder?: number }) => {
      if (!card?.subBoard?.id) throw new Error("Kein Unterboard vorhanden");
      await secureFetch(`/api/subboards/${card.subBoard.id}/tasks`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => cardQuery.refetch(),
  });

  const lanes = useMemo(() => card?.subBoard?.lanes.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [], [card]);
  const columns = useMemo(() => card?.subBoard?.columns.slice().sort((a, b) => a.order - b.order) ?? [], [card]);

  function nextColumnId(columnId: string) {
    const index = columns.findIndex((col) => col.id === columnId);
    if (index === -1) return columnId;
    return columns[Math.min(columns.length - 1, index + 1)].id;
  }

  if (!card) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-slate-950/80 backdrop-blur">
      <div className="h-full w-full" onClick={onClose} />
      <aside className="h-full w-full max-w-4xl overflow-y-auto border-l border-slate-800 bg-slate-900/95 p-8 text-sm text-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Projekt {card.number}</p>
            <h2 className="text-2xl font-semibold text-slate-100">{card.title}</h2>
          </div>
          <button onClick={onClose} className="rounded bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
            Schließen
          </button>
        </div>

        <nav className="mt-6 flex gap-4 text-xs uppercase tracking-wide">
          {[
            { key: "general", label: "Allgemein" },
            { key: "status", label: "Status" },
            { key: "team", label: "Team & Unterboard" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={clsx(
                "rounded px-3 py-2",
                activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-400",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "general" ? (
          <section className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">Titel</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">Phase Zieltermin</span>
                <input
                  type="date"
                  value={phaseTargetDate ?? ""}
                  onChange={(event) => setPhaseTargetDate(event.target.value || null)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase text-slate-400">Kurzstatus</span>
              <textarea
                value={statusShort}
                onChange={(event) => setStatusShort(event.target.value)}
                rows={3}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">SOP / Hinweise</span>
                <textarea
                  value={sop ?? ""}
                  onChange={(event) => setSop(event.target.value)}
                  rows={3}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">Bild URL</span>
                <input
                  value={imageUrl ?? ""}
                  onChange={(event) => setImageUrl(event.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">TR Datum (write once)</span>
                <input
                  type="date"
                  value={trDate ?? ""}
                  onChange={(event) => setTrDate(event.target.value)}
                  disabled={Boolean(card.trDate)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">TR Plantermin anhängen</span>
                <input
                  type="date"
                  value={trPlanInput}
                  onChange={(event) => setTrPlanInput(event.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-slate-400">TR Ist</span>
                <input
                  type="date"
                  value={trActualDate ?? ""}
                  onChange={(event) => setTrActualDate(event.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              {card.trPlanDates.map((date, index) => (
                <span key={index} className="rounded bg-slate-800 px-2 py-1">
                  Plan {new Date(date).toLocaleDateString("de-DE")}
                </span>
              ))}
              {!card.trPlanDates.length ? <span className="text-slate-500">Keine TR Plantermine</span> : null}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase text-slate-400">Projektverantwortlicher (User-ID)</span>
              <input
                value={projectOwnerId ?? ""}
                onChange={(event) => setProjectOwnerId(event.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
              />
            </label>
            <div className="pt-4">
              <button
                onClick={() => updateMutation.mutate()}
                className="rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900"
              >
                Änderungen speichern
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "status" ? (
          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Neuer Statusblock</h3>
              <StatusForm onSubmit={statusMutation.mutate} />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Historie</h3>
              <div className="space-y-3">
                {card.statusEntries.map((entry) => (
                  <article key={entry.id} className="rounded border border-slate-800 bg-slate-900/60 p-4">
                    <header className="flex items-center justify-between text-xs text-slate-400">
                      <span>{new Date(entry.createdAt).toLocaleString("de-DE")}</span>
                      <span className="rounded bg-slate-800 px-2 py-1">{entry.schedule}</span>
                    </header>
                    <p className="mt-2 text-sm text-slate-200">{entry.summary}</p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                      <div>
                        <dt>Qualität</dt>
                        <dd className="text-slate-200">{entry.quality}</dd>
                      </div>
                      <div>
                        <dt>Kosten</dt>
                        <dd className="text-slate-200">{entry.cost}</dd>
                      </div>
                      <div>
                        <dt>Termine</dt>
                        <dd className="text-slate-200">{entry.schedule}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
                {!card.statusEntries.length ? <p className="text-sm text-slate-500">Noch keine Statusmeldungen.</p> : null}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "team" ? (
          <section className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Team</h3>
              <div className="mt-3 space-y-3">
                {card.teamMembers.map((member) => (
                  <TeamMemberRow
                    key={member.id}
                    member={member}
                    onSave={(payload) => teamUpdateMutation.mutate({ id: member.id, ...payload })}
                    onRemove={() => teamDeleteMutation.mutate({ id: member.id })}
                  />
                ))}
                {!card.teamMembers.length ? <p className="text-sm text-slate-500">Noch kein Team hinzugefügt.</p> : null}
              </div>
              <TeamMemberForm onSubmit={(payload) => teamCreateMutation.mutate(payload)} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Unterboard</h3>
                {!card.subBoard ? (
                  <button
                    onClick={() => subboardMutation.mutate()}
                    className="rounded bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900"
                  >
                    Unterboard erstellen
                  </button>
                ) : null}
              </div>
              {card.subBoard ? (
                <div className="mt-4 space-y-4">
                  {lanes.map((lane) => (
                    <div key={lane.id} className="rounded-lg border border-slate-800 bg-slate-900/60">
                      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs uppercase text-slate-400">
                        <span>{lane.displayName}</span>
                      </header>
                      <div className="grid gap-3 px-3 py-4 md:grid-cols-5">
                        {columns.map((column) => {
                          const tasks = card.subBoard?.tasks
                            .filter((task) => task.laneId === lane.id && task.columnId === column.id && !task.archivedAt)
                            .sort((a, b) => a.sortOrder - b.sortOrder);
                          return (
                            <div key={column.id} className="rounded border border-slate-800/60 bg-slate-900/70 p-3">
                              <h4 className="text-[11px] uppercase tracking-wide text-slate-400">{column.name}</h4>
                              <div className="mt-2 space-y-2">
                                {tasks?.map((task) => (
                                  <div key={task.id} className="rounded border border-slate-800 bg-slate-900/80 p-2 text-xs text-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span>{task.text}</span>
                                      <span
                                        className={clsx(
                                          "inline-flex h-2 w-2 rounded-full",
                                          task.statusDot === "green" ? "bg-emerald-400" : "bg-rose-500",
                                        )}
                                      />
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-400">
                                      {task.planDate ? new Date(task.planDate).toLocaleDateString("de-DE") : "–"}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                                      <button
                                        className="rounded bg-slate-800 px-2 py-1"
                                        onClick={() =>
                                          taskActionMutation.mutate({
                                            type: "toggle",
                                            taskId: task.id,
                                          })
                                        }
                                      >
                                        Status
                                      </button>
                                      <button
                                        className="rounded bg-slate-800 px-2 py-1"
                                        onClick={() =>
                                          taskActionMutation.mutate({
                                            type: "move",
                                            taskId: task.id,
                                            laneId: lane.id,
                                            columnId: nextColumnId(task.columnId),
                                            sortOrder: Date.now(),
                                          })
                                        }
                                      >
                                        →
                                      </button>
                                      <button
                                        className="rounded bg-slate-800 px-2 py-1"
                                        onClick={() => taskActionMutation.mutate({ type: "archive", taskId: task.id })}
                                      >
                                        Archiv
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <TaskInlineForm
                                  onSubmit={(text, planDate) =>
                                    addTaskMutation.mutate({
                                      laneId: lane.id,
                                      columnName: column.name,
                                      text,
                                      planDate,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Noch kein Unterboard vorhanden.</p>
              )}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function StatusForm({
  onSubmit,
}: {
  onSubmit: (payload: { summary: string; quality: string; cost: string; schedule: string }) => void;
}) {
  const [summary, setSummary] = useState("");
  const [quality, setQuality] = useState("grün");
  const [cost, setCost] = useState("grün");
  const [schedule, setSchedule] = useState("grün");

  return (
    <div className="space-y-3">
      <textarea
        rows={4}
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        placeholder="Kurzbeschreibung"
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
      />
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span>Qualität</span>
          <input value={quality} onChange={(event) => setQuality(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Kosten</span>
          <input value={cost} onChange={(event) => setCost(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Termine</span>
          <input value={schedule} onChange={(event) => setSchedule(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
        </label>
      </div>
      <button
        onClick={() => {
          onSubmit({ summary, quality, cost, schedule });
          setSummary("");
        }}
        className="rounded bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900"
      >
        Statusblock anlegen
      </button>
    </div>
  );
}

function TeamMemberForm({
  onSubmit,
}: {
  onSubmit: (payload: { displayName: string; roleText?: string; userId?: string | null }) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [roleText, setRoleText] = useState("");
  const [userId, setUserId] = useState("");

  return (
    <form
      className="mt-4 grid gap-2 rounded border border-slate-800 bg-slate-900/60 p-4 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ displayName, roleText, userId: userId || null });
        setDisplayName("");
        setRoleText("");
        setUserId("");
      }}
    >
      <div className="grid gap-2 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span>Name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Rolle</span>
          <input value={roleText} onChange={(event) => setRoleText(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span>User-ID (optional)</span>
          <input value={userId} onChange={(event) => setUserId(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
        </label>
      </div>
      <button className="mt-2 w-max rounded bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
        Mitglied hinzufügen
      </button>
    </form>
  );
}

function TeamMemberRow({
  member,
  onSave,
  onRemove,
}: {
  member: { id: string; displayName: string; roleText: string | null };
  onSave: (payload: { displayName?: string; roleText?: string | null }) => void;
  onRemove: () => void;
}) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [roleText, setRoleText] = useState(member.roleText ?? "");

  return (
    <div className="grid gap-2 rounded border border-slate-800 bg-slate-900/60 p-4 text-xs md:grid-cols-3">
      <label className="flex flex-col gap-1">
        <span>Name</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span>Rolle</span>
        <input value={roleText} onChange={(event) => setRoleText(event.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1" />
      </label>
      <div className="flex items-end justify-end gap-2">
        <button
          onClick={() => onSave({ displayName, roleText })}
          className="rounded bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900"
        >
          Speichern
        </button>
        <button onClick={onRemove} className="rounded bg-slate-800 px-3 py-2 text-xs uppercase tracking-wide text-slate-300">
          Entfernen
        </button>
      </div>
    </div>
  );
}

function TaskInlineForm({
  onSubmit,
}: {
  onSubmit: (text: string, planDate?: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [planDate, setPlanDate] = useState("");

  return (
    <form
      className="rounded border border-dashed border-slate-700 p-2 text-[10px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text) return;
        onSubmit(text, planDate || undefined);
        setText("");
        setPlanDate("");
      }}
    >
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Neuer Task"
        className="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
      />
      <input
        type="date"
        value={planDate}
        onChange={(event) => setPlanDate(event.target.value)}
        className="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
      />
      <button className="w-full rounded bg-primary/40 px-2 py-1 text-xs uppercase tracking-wide text-primary">
        Hinzufügen
      </button>
    </form>
  );
}
