import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  createSubTask,
  moveSubTask,
  toggleSubTaskStatus,
  archiveSubTask,
} from "@/lib/project-service";
import { prisma } from "@/lib/prisma";
import { ensureProjectCardAccess } from "@/lib/access";
import type { SubColumnName } from "@prisma/client";

const createSchema = z.object({
  laneId: z.string(),
  columnName: z.enum(["WAIT", "USER", "NEXT_FLOW", "FLOW", "DONE"] as [SubColumnName, ...SubColumnName[]]),
  text: z.string().min(1),
  planDate: z.string().datetime().nullable().optional(),
  projectNumberBadge: z.string().nullable().optional(),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    taskId: z.string(),
    laneId: z.string(),
    columnId: z.string(),
    sortOrder: z.number(),
  }),
  z.object({ type: z.literal("toggle"), taskId: z.string() }),
  z.object({ type: z.literal("archive"), taskId: z.string() }),
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { subBoardId: string } },
) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    const subBoard = await prisma.subBoard.findUnique({
      where: { id: params.subBoardId },
      include: {
        tasks: true,
        projectCard: { select: { id: true, boardId: true } },
      },
    });
    if (!subBoard) {
      throw Object.assign(new Error("Unterboard nicht gefunden"), { status: 404 });
    }
    await ensureProjectCardAccess(subBoard.projectCardId, { id: user.id, role: user.role });
    const tasks = await prisma.subTaskCard.findMany({
      where: { subBoardId: params.subBoardId },
      orderBy: [
        { column: { order: "asc" } },
        { sortOrder: "asc" },
      ],
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { subBoardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`subboard:task:${user.id}`);
    const data = createSchema.parse(await request.json());
    const task = await createSubTask(
      { id: user.id, role: user.role },
      params.subBoardId,
      {
        laneId: data.laneId,
        columnName: data.columnName,
        text: data.text,
        planDate: data.planDate ? new Date(data.planDate) : null,
        projectNumberBadge: data.projectNumberBadge ?? null,
      },
    );
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { subBoardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`subboard:task:${user.id}`);
    const action = actionSchema.parse(await request.json());
    switch (action.type) {
      case "move": {
        const task = await moveSubTask(
          { id: user.id, role: user.role },
          action.taskId,
          {
            laneId: action.laneId,
            columnId: action.columnId,
            sortOrder: action.sortOrder,
          },
        );
        return NextResponse.json({ task });
      }
      case "toggle": {
        const task = await toggleSubTaskStatus({ id: user.id, role: user.role }, action.taskId);
        return NextResponse.json({ task });
      }
      case "archive": {
        const task = await archiveSubTask({ id: user.id, role: user.role }, action.taskId);
        return NextResponse.json({ task });
      }
      default:
        throw Object.assign(new Error("Unbekannte Task-Aktion"), { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
