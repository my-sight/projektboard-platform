import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

interface Actor {
  id: string;
  role: Role;
}

export async function ensureBoardAccess(boardId: string, actor: Actor) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
  });
  if (!board) {
    throw Object.assign(new Error("Board nicht gefunden"), { status: 404 });
  }

  if (actor.role === "ADMIN" || board.ownerId === actor.id) {
    return board;
  }

  const membership = await prisma.projectTeamMember.findFirst({
    where: {
      projectCard: {
        boardId,
      },
      userId: actor.id,
    },
  });

  if (!membership) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }

  return board;
}

export async function ensureProjectCardAccess(cardId: string, actor: Actor) {
  const card = await prisma.projectCard.findUnique({
    where: { id: cardId },
    include: {
      board: true,
    },
  });

  if (!card) {
    throw Object.assign(new Error("Projektkarte nicht gefunden"), { status: 404 });
  }

  if (actor.role === "ADMIN" || card.board.ownerId === actor.id) {
    return card;
  }

  const membership = await prisma.projectTeamMember.findFirst({
    where: {
      projectCardId: cardId,
      OR: [
        { userId: actor.id },
        {
          projectCard: {
            board: {
              ownerId: actor.id,
            },
          },
        },
      ],
    },
  });

  if (!membership) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }

  return card;
}
