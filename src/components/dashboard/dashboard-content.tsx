"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSecureFetch } from "@/hooks/use-secure-fetch";
import { useCsrfToken } from "@/hooks/use-csrf-token";
import { useEffect } from "react";

interface BoardSummary {
  id: string;
  name: string;
  phases: { id: string; name: string }[];
}

interface FlowTask {
  id: string;
  text: string;
  planDate: string | null;
  statusDot: string;
  projectNumberBadge: string | null;
  subBoard: {
    projectCard: {
      id: string;
      number: string;
      title: string;
      board: { id: string; name: string };
    };
  };
}

export function DashboardContent() {
  const secureFetch = useSecureFetch();
  const queryClient = useQueryClient();
  const { refetch: refetchCsrf } = useCsrfToken();

  useEffect(() => {
    refetchCsrf();
  }, [refetchCsrf]);

  const boardsQuery = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const res = await fetch("/api/boards", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Boards konnten nicht geladen werden");
      }
      const data = (await res.json()) as { boards: BoardSummary[] };
      return data.boards;
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["my-flow-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/me/tasks", { credentials: "include" });
      if (!res.ok) {
        throw new Error("FLOW-Tasks konnten nicht geladen werden");
      }
      const data = (await res.json()) as { tasks: FlowTask[] };
      return data.tasks;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await secureFetch<{ success: boolean }>("/api/me/tasks", {
        method: "POST",
        body: JSON.stringify({ taskId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-flow-tasks"] });
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-100">Meine Boards</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {boardsQuery.data?.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 transition hover:border-primary hover:shadow-elevated"
            >
              <h3 className="text-base font-semibold text-primary">{board.name}</h3>
              <p className="mt-2 text-sm text-slate-400">
                {board.phases.map((phase) => phase.name).join(" • ")}
              </p>
            </Link>
          ))}
          {boardsQuery.isLoading ? <p className="text-sm text-slate-400">Lade Boards...</p> : null}
          {boardsQuery.isError ? <p className="text-sm text-danger">{(boardsQuery.error as Error).message}</p> : null}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-100">Meine Tasks im FLOW</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Projekt</th>
                <th className="px-4 py-3">Plan-Datum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {tasksQuery.data?.map((task) => (
                <tr key={task.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-3 w-3 rounded-full ${task.statusDot === "green" ? "bg-emerald-400" : "bg-rose-500"}`}
                      />
                      <span>{task.text}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase text-slate-500">{task.subBoard.projectCard.board.name}</span>
                      <span className="font-medium text-slate-100">
                        {task.subBoard.projectCard.number} – {task.subBoard.projectCard.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {task.planDate ? new Date(task.planDate).toLocaleDateString("de-DE") : "–"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => completeMutation.mutate(task.id)}
                      className="rounded bg-emerald-500/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-950 transition hover:bg-emerald-400"
                    >
                      Abschließen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasksQuery.isLoading ? (
            <p className="px-4 py-3 text-sm text-slate-400">Lade Tasks...</p>
          ) : null}
          {tasksQuery.isError ? (
            <p className="px-4 py-3 text-sm text-danger">{(tasksQuery.error as Error).message}</p>
          ) : null}
          {!tasksQuery.isLoading && !tasksQuery.data?.length ? (
            <p className="px-4 py-3 text-sm text-slate-400">Aktuell keine Tasks im FLOW.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
