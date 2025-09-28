import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

interface Actor {
  id: string;
  role: Role;
}

export async function listBoards(actor: Actor) {
  return prisma.board.findMany({
    where:
      actor.role === "ADMIN"
        ? {}
        : {
            OR: [
              { ownerId: actor.id },
              {
                projectCards: {
                  some: {
                    teamMembers: {
                      some: {
                        OR: [
                          { userId: actor.id },
                          { projectCard: { board: { ownerId: actor.id } } },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
    include: {
      phases: {
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBoardDetail(actor: Actor, boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      phases: {
        orderBy: { displayOrder: "asc" },
      },
      projectCards: {
        include: {
          phase: true,
          teamMembers: true,
          statusEntries: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          subBoard: {
            include: {
              lanes: { orderBy: { sortOrder: "asc" } },
              columns: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
}

export async function createBoard(actor: Actor, data: { name: string; settingsJson?: unknown; phases: { name: string; checklistTemplateJson?: unknown }[]; }) {
  return prisma.board.create({
    data: {
      name: data.name,
      ownerId: actor.id,
      settingsJson: data.settingsJson ?? {},
      phases: {
        create: data.phases.map((phase, index) => ({
          name: phase.name,
          displayOrder: index,
          checklistTemplateJson: phase.checklistTemplateJson ?? [],
        })),
      },
    },
    include: {
      phases: true,
    },
  });
}

export async function updateBoard(actor: Actor, boardId: string, data: { name?: string; settingsJson?: unknown; phases?: { id?: string; name: string; checklistTemplateJson?: unknown; displayOrder: number }[]; }) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw Object.assign(new Error("Board nicht gefunden"), { status: 404 });
  }
  if (actor.role !== "ADMIN" && board.ownerId !== actor.id) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: {
      name: data.name ?? board.name,
      settingsJson: data.settingsJson ?? board.settingsJson,
    },
  });

  if (data.phases) {
    for (const phase of data.phases) {
      if (phase.id) {
        await prisma.boardPhase.update({
          where: { id: phase.id },
          data: {
            name: phase.name,
            displayOrder: phase.displayOrder,
            checklistTemplateJson: phase.checklistTemplateJson ?? [],
          },
        });
      } else {
        await prisma.boardPhase.create({
          data: {
            boardId,
            name: phase.name,
            displayOrder: phase.displayOrder,
            checklistTemplateJson: phase.checklistTemplateJson ?? [],
          },
        });
      }
    }
  }

  return updated;
}

export async function deleteBoard(actor: Actor, boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw Object.assign(new Error("Board nicht gefunden"), { status: 404 });
  }
  if (actor.role !== "ADMIN" && board.ownerId !== actor.id) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }
  await prisma.board.delete({ where: { id: boardId } });
}
