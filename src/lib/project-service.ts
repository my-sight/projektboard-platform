import { prisma } from "@/lib/prisma";
import type { Role, SubColumnName } from "@prisma/client";
import { ensureBoardAccess, ensureProjectCardAccess } from "@/lib/access";

interface Actor {
  id: string;
  role: Role;
}

export async function createProjectCard(actor: Actor, boardId: string, input: {
  phaseId: string;
  number: string;
  title: string;
  position?: number;
  statusShort?: string;
  phaseTargetDate?: Date | null;
}) {
  await ensureBoardAccess(boardId, actor);
  const position = input.position ?? (await nextPositionForPhase(input.phaseId));
  return prisma.projectCard.create({
    data: {
      boardId,
      phaseId: input.phaseId,
      number: input.number,
      title: input.title,
      position,
      statusShort: input.statusShort ?? "",
      phaseTargetDate: input.phaseTargetDate ?? null,
    },
  });
}

async function nextPositionForPhase(phaseId: string) {
  const lastCard = await prisma.projectCard.findFirst({
    where: { phaseId },
    orderBy: { position: "desc" },
  });
  if (!lastCard) {
    return 1;
  }
  return lastCard.position + 1;
}

export async function updateProjectCard(actor: Actor, cardId: string, input: {
  title?: string;
  statusShort?: string;
  phaseTargetDate?: Date | null;
  statusDot?: string;
  batchSK?: boolean;
  batchLK?: boolean;
  sop?: string | null;
  imageUrl?: string | null;
  trDate?: Date | null;
  trPlanDateAppend?: Date | null;
  trActualDate?: Date | null;
  projectOwnerId?: string | null;
}) {
  const card = await ensureProjectCardAccess(cardId, actor);

  let trDate = card.trDate;
  if (input.trDate) {
    if (card.trDate && card.trDate.getTime() !== input.trDate.getTime()) {
      throw Object.assign(new Error("TR-Datum kann nicht überschrieben werden"), { status: 400 });
    }
    trDate = card.trDate ?? input.trDate;
  }

  const trPlanDatesArray: string[] = Array.isArray(card.trPlanDates)
    ? (card.trPlanDates as unknown[]).map(String)
    : [];
  if (input.trPlanDateAppend) {
    trPlanDatesArray.push(input.trPlanDateAppend.toISOString());
  }

  const nextBatchSK = input.batchSK ?? card.batchSK;
  const nextBatchLK = input.batchLK ?? card.batchLK;
  let nextStatusDot = input.statusDot ?? card.statusDot;
  if (!nextBatchSK && !nextBatchLK && !input.statusDot) {
    nextStatusDot = "green";
  }
  if (nextBatchSK || nextBatchLK) {
    nextStatusDot = "red";
  }

  return prisma.projectCard.update({
    where: { id: cardId },
    data: {
      title: input.title ?? card.title,
      statusShort: input.statusShort ?? card.statusShort,
      phaseTargetDate: input.phaseTargetDate ?? card.phaseTargetDate,
      statusDot: nextStatusDot,
      batchSK: nextBatchSK,
      batchLK: nextBatchLK,
      sop: input.sop ?? card.sop,
      imageUrl: input.imageUrl ?? card.imageUrl,
      trDate,
      trPlanDates: trPlanDatesArray,
      trActualDate: input.trActualDate ?? card.trActualDate,
      projectOwnerId: input.projectOwnerId ?? card.projectOwnerId,
    },
  });
}

export async function moveProjectCard(actor: Actor, cardId: string, phaseId: string, position: number) {
  const card = await ensureProjectCardAccess(cardId, actor);
  return prisma.projectCard.update({
    where: { id: card.id },
    data: {
      phaseId,
      position,
    },
  });
}

export async function createStatusEntry(actor: Actor, cardId: string, input: {
  summary: string;
  quality: string;
  cost: string;
  schedule: string;
}) {
  await ensureProjectCardAccess(cardId, actor);
  return prisma.projectStatusEntry.create({
    data: {
      projectCardId: cardId,
      summary: input.summary,
      quality: input.quality,
      cost: input.cost,
      schedule: input.schedule,
    },
  });
}

export async function listStatusEntries(actor: Actor, cardId: string) {
  await ensureProjectCardAccess(cardId, actor);
  return prisma.projectStatusEntry.findMany({
    where: { projectCardId: cardId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addTeamMember(actor: Actor, cardId: string, input: {
  userId?: string | null;
  displayName: string;
  roleText?: string | null;
}) {
  await ensureProjectCardAccess(cardId, actor);
  return prisma.projectTeamMember.create({
    data: {
      projectCardId: cardId,
      userId: input.userId ?? null,
      displayName: input.displayName,
      roleText: input.roleText ?? null,
    },
  });
}

export async function updateTeamMember(actor: Actor, memberId: string, input: {
  displayName?: string;
  roleText?: string | null;
}) {
  const member = await prisma.projectTeamMember.findUnique({
    where: { id: memberId },
    include: { projectCard: { include: { board: true } } },
  });
  if (!member) {
    throw Object.assign(new Error("Mitglied nicht gefunden"), { status: 404 });
  }
  if (actor.role !== "ADMIN" && member.projectCard.board.ownerId !== actor.id && member.projectCard.projectOwnerId !== actor.id) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }
  return prisma.projectTeamMember.update({
    where: { id: memberId },
    data: {
      displayName: input.displayName ?? member.displayName,
      roleText: input.roleText ?? member.roleText,
    },
  });
}

export async function removeTeamMember(actor: Actor, memberId: string) {
  const member = await prisma.projectTeamMember.findUnique({
    where: { id: memberId },
    include: { projectCard: { include: { board: true } } },
  });
  if (!member) {
    throw Object.assign(new Error("Mitglied nicht gefunden"), { status: 404 });
  }
  if (actor.role !== "ADMIN" && member.projectCard.board.ownerId !== actor.id) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }
  await prisma.projectTeamMember.delete({ where: { id: memberId } });
}

export async function getOrCreateSubBoard(actor: Actor, cardId: string) {
  await ensureProjectCardAccess(cardId, actor);
  const existing = await prisma.subBoard.findUnique({
    where: { projectCardId: cardId },
    include: {
      lanes: { orderBy: { sortOrder: "asc" } },
      columns: { orderBy: { order: "asc" } },
      tasks: true,
    },
  });
  if (existing) {
    return existing;
  }
  return prisma.subBoard.create({
    data: {
      projectCardId: cardId,
      name: "Unterprojekt",
      columns: {
        create: [
          { name: "WAIT", order: 0 },
          { name: "USER", order: 1 },
          { name: "NEXT_FLOW", order: 2 },
          { name: "FLOW", order: 3 },
          { name: "DONE", order: 4 },
        ],
      },
    },
    include: {
      lanes: true,
      columns: true,
      tasks: true,
    },
  });
}

export async function upsertSubLane(actor: Actor, subBoardId: string, input: {
  id?: string;
  userId?: string | null;
  displayName: string;
  sortOrder?: number;
}) {
  const subBoard = await prisma.subBoard.findUnique({
    where: { id: subBoardId },
    include: { projectCard: { include: { board: true } } },
  });
  if (!subBoard) {
    throw Object.assign(new Error("Unterboard nicht gefunden"), { status: 404 });
  }
  await ensureProjectCardAccess(subBoard.projectCardId, actor);
  if (input.id) {
    return prisma.subLane.update({
      where: { id: input.id },
      data: {
        displayName: input.displayName,
        userId: input.userId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }
  return prisma.subLane.create({
    data: {
      subBoardId,
      displayName: input.displayName,
      userId: input.userId ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function createSubTask(actor: Actor, subBoardId: string, input: {
  laneId: string;
  columnName: SubColumnName;
  text: string;
  planDate?: Date | null;
  projectNumberBadge?: string | null;
}) {
  const subBoard = await prisma.subBoard.findUnique({
    where: { id: subBoardId },
    include: {
      columns: true,
      projectCard: { include: { board: true } },
    },
  });
  if (!subBoard) {
    throw Object.assign(new Error("Unterboard nicht gefunden"), { status: 404 });
  }
  await ensureProjectCardAccess(subBoard.projectCardId, actor);
  const column = subBoard.columns.find((c) => c.name === input.columnName);
  if (!column) {
    throw Object.assign(new Error("Spalte nicht gefunden"), { status: 400 });
  }
  const nextPosition = await prisma.subTaskCard.findFirst({
    where: { columnId: column.id, laneId: input.laneId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = nextPosition ? nextPosition.sortOrder + 1 : 1;
  return prisma.subTaskCard.create({
    data: {
      subBoardId,
      laneId: input.laneId,
      columnId: column.id,
      text: input.text,
      planDate: input.planDate ?? null,
      projectNumberBadge: input.projectNumberBadge ?? null,
      sortOrder,
    },
  });
}

export async function moveSubTask(actor: Actor, taskId: string, input: {
  laneId: string;
  columnId: string;
  sortOrder: number;
}) {
  const task = await prisma.subTaskCard.findUnique({
    where: { id: taskId },
    include: {
      subBoard: {
        include: { projectCard: { include: { board: true } } },
      },
    },
  });
  if (!task) {
    throw Object.assign(new Error("Task nicht gefunden"), { status: 404 });
  }
  await ensureProjectCardAccess(task.subBoard.projectCardId, actor);
  return prisma.subTaskCard.update({
    where: { id: taskId },
    data: {
      laneId: input.laneId,
      columnId: input.columnId,
      sortOrder: input.sortOrder,
      archivedAt: input.columnId === task.columnId ? task.archivedAt : null,
    },
  });
}

export async function toggleSubTaskStatus(actor: Actor, taskId: string) {
  const task = await prisma.subTaskCard.findUnique({
    where: { id: taskId },
    include: {
      subBoard: {
        include: { projectCard: { include: { board: true } } },
      },
    },
  });
  if (!task) {
    throw Object.assign(new Error("Task nicht gefunden"), { status: 404 });
  }
  await ensureProjectCardAccess(task.subBoard.projectCardId, actor);
  const nextStatus = task.statusDot === "green" ? "red" : "green";
  return prisma.subTaskCard.update({
    where: { id: taskId },
    data: { statusDot: nextStatus },
  });
}

export async function archiveSubTask(actor: Actor, taskId: string) {
  const task = await prisma.subTaskCard.findUnique({
    where: { id: taskId },
    include: {
      subBoard: { include: { projectCard: { include: { board: true } } } },
    },
  });
  if (!task) {
    throw Object.assign(new Error("Task nicht gefunden"), { status: 404 });
  }
  await ensureProjectCardAccess(task.subBoard.projectCardId, actor);
  return prisma.subTaskCard.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });
}

export async function completeFlowTask(actor: Actor, taskId: string) {
  const task = await prisma.subTaskCard.findUnique({
    where: { id: taskId },
    include: {
      column: true,
      subBoard: {
        include: {
          columns: true,
          projectCard: {
            include: { phase: true },
          },
        },
      },
    },
  });
  if (!task) {
    throw Object.assign(new Error("Task nicht gefunden"), { status: 404 });
  }
  const projectCard = await ensureProjectCardAccess(task.subBoard.projectCardId, actor);
  const doneColumn = task.subBoard.columns.find((c) => c.name === "DONE");
  if (!doneColumn) {
    throw Object.assign(new Error("DONE-Spalte fehlt"), { status: 500 });
  }
  await prisma.subTaskCard.update({
    where: { id: taskId },
    data: {
      columnId: doneColumn.id,
      sortOrder: Date.now(),
    },
  });
  return projectCard;
}
