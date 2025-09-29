import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { ensureBoardAccess } from "@/lib/access";
import { getBoardDetail, updateBoard, deleteBoard } from "@/lib/board-service";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";

const updateSchema = z.object({
  name: z.string().min(3).optional(),
  settingsJson: z.unknown().optional(),
  phases: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        checklistTemplateJson: z.unknown().optional(),
        displayOrder: z.number().int(),
      }),
    )
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { boardId: string } },
) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    await ensureBoardAccess(params.boardId, { id: user.id, role: user.role });
    const board = await getBoardDetail({ id: user.id, role: user.role }, params.boardId);
    return NextResponse.json({ board });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { boardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`board:update:${user.id}`);
    const data = updateSchema.parse(await request.json());
    const board = await updateBoard({ id: user.id, role: user.role }, params.boardId, data);
    return NextResponse.json({ board });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { boardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`board:delete:${user.id}`);
    await deleteBoard({ id: user.id, role: user.role }, params.boardId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
