import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { listBoards, createBoard } from "@/lib/board-service";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";

const createBoardSchema = z.object({
  name: z.string().min(3),
  settingsJson: z.unknown().optional(),
  phases: z
    .array(
      z.object({
        name: z.string().min(1),
        checklistTemplateJson: z.unknown().optional(),
      }),
    )
    .min(1),
});

export async function GET() {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    const boards = await listBoards({ id: user.id, role: user.role });
    return NextResponse.json({ boards });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`boards:create:${user.id}`);
    const body = await request.json();
    const parsed = createBoardSchema.parse(body);
    const board = await createBoard({ id: user.id, role: user.role }, parsed);
    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
