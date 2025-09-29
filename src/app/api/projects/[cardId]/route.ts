import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { ensureProjectCardAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  updateProjectCard,
  moveProjectCard,
} from "@/lib/project-service";

const updateSchema = z.object({
  title: z.string().optional(),
  statusShort: z.string().optional(),
  phaseTargetDate: z.string().datetime().nullable().optional(),
  statusDot: z.string().optional(),
  batchSK: z.boolean().optional(),
  batchLK: z.boolean().optional(),
  sop: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  trDate: z.string().datetime().nullable().optional(),
  trPlanDateAppend: z.string().datetime().nullable().optional(),
  trActualDate: z.string().datetime().nullable().optional(),
  projectOwnerId: z.string().nullable().optional(),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    phaseId: z.string(),
    position: z.number(),
  }),
  z.object({ type: z.literal("toggleSK"), value: z.boolean() }),
  z.object({ type: z.literal("toggleLK"), value: z.boolean() }),
  z.object({ type: z.literal("statusDot"), statusDot: z.string() }),
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { cardId: string } },
) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    const card = await prisma.projectCard.findUnique({
      where: { id: params.cardId },
      include: {
        phase: true,
        board: true,
        teamMembers: true,
        statusEntries: {
          orderBy: { createdAt: "desc" },
        },
        subBoard: {
          include: {
            lanes: { orderBy: { sortOrder: "asc" } },
            columns: { orderBy: { order: "asc" } },
            tasks: true,
          },
        },
      },
    });
    if (!card) {
      throw Object.assign(new Error("Projektkarte nicht gefunden"), { status: 404 });
    }
    await ensureProjectCardAccess(params.cardId, { id: user.id, role: user.role });
    return NextResponse.json({ card });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:update:${user.id}`);
    const body = updateSchema.parse(await request.json());
    const card = await updateProjectCard(
      { id: user.id, role: user.role },
      params.cardId,
      {
        title: body.title,
        statusShort: body.statusShort,
        phaseTargetDate: body.phaseTargetDate ? new Date(body.phaseTargetDate) : null,
        statusDot: body.statusDot,
        batchSK: body.batchSK,
        batchLK: body.batchLK,
        sop: body.sop,
        imageUrl: body.imageUrl,
        trDate: body.trDate ? new Date(body.trDate) : null,
        trPlanDateAppend: body.trPlanDateAppend ? new Date(body.trPlanDateAppend) : null,
        trActualDate: body.trActualDate ? new Date(body.trActualDate) : null,
        projectOwnerId: body.projectOwnerId,
      },
    );
    return NextResponse.json({ card });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:action:${user.id}`);
    const action = actionSchema.parse(await request.json());
    switch (action.type) {
      case "move": {
        const card = await moveProjectCard({ id: user.id, role: user.role }, params.cardId, action.phaseId, action.position);
        return NextResponse.json({ card });
      }
      case "toggleSK": {
        const card = await updateProjectCard(
          { id: user.id, role: user.role },
          params.cardId,
          {
            batchSK: action.value,
            statusDot: action.value ? "red" : undefined,
          },
        );
        return NextResponse.json({ card });
      }
      case "toggleLK": {
        const card = await updateProjectCard(
          { id: user.id, role: user.role },
          params.cardId,
          {
            batchLK: action.value,
            statusDot: action.value ? "red" : undefined,
          },
        );
        return NextResponse.json({ card });
      }
      case "statusDot": {
        const card = await updateProjectCard(
          { id: user.id, role: user.role },
          params.cardId,
          {
            statusDot: action.statusDot,
          },
        );
        return NextResponse.json({ card });
      }
      default:
        throw Object.assign(new Error("Unbekannte Aktion"), { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:delete:${user.id}`);
    await ensureProjectCardAccess(params.cardId, { id: user.id, role: user.role });
    await prisma.projectCard.delete({ where: { id: params.cardId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
