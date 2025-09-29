import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";
import { getOrCreateSubBoard } from "@/lib/project-service";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { cardId: string } },
) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    const subBoard = await getOrCreateSubBoard({ id: user.id, role: user.role }, params.cardId);
    return NextResponse.json({ subBoard });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:subboard:${user.id}`);
    const body = updateSchema.parse(await request.json());
    const subBoard = await getOrCreateSubBoard({ id: user.id, role: user.role }, params.cardId);
    if (body.name && subBoard.name !== body.name) {
      await prisma.subBoard.update({ where: { id: subBoard.id }, data: { name: body.name } });
      subBoard.name = body.name;
    }
    return NextResponse.json({ subBoard });
  } catch (error) {
    return errorResponse(error);
  }
}
