import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";
import { ensureProjectCardAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { addTeamMember, updateTeamMember, removeTeamMember } from "@/lib/project-service";

const createSchema = z.object({
  displayName: z.string().min(1),
  roleText: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  roleText: z.string().nullable().optional(),
});

const deleteSchema = z.object({
  id: z.string(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { cardId: string } },
) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    await ensureProjectCardAccess(params.cardId, { id: user.id, role: user.role });
    const members = await prisma.projectTeamMember.findMany({
      where: { projectCardId: params.cardId },
      include: { user: true },
    });
    return NextResponse.json({ members });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:team:${user.id}`);
    const data = createSchema.parse(await request.json());
    const member = await addTeamMember({ id: user.id, role: user.role }, params.cardId, data);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:team:${user.id}`);
    const data = updateSchema.parse(await request.json());
    await ensureProjectCardAccess(params.cardId, { id: user.id, role: user.role });
    const member = await updateTeamMember({ id: user.id, role: user.role }, data.id, data);
    return NextResponse.json({ member });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:team:${user.id}`);
    const data = deleteSchema.parse(await request.json());
    await ensureProjectCardAccess(params.cardId, { id: user.id, role: user.role });
    await removeTeamMember({ id: user.id, role: user.role }, data.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
