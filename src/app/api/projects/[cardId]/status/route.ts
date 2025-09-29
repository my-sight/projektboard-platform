import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";
import { listStatusEntries, createStatusEntry } from "@/lib/project-service";

const createSchema = z.object({
  summary: z.string().min(1),
  quality: z.string().min(1),
  cost: z.string().min(1),
  schedule: z.string().min(1),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { cardId: string } },
) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    const entries = await listStatusEntries({ id: user.id, role: user.role }, params.cardId);
    return NextResponse.json({ entries });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { cardId: string } }) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`project:status:${user.id}`);
    const data = createSchema.parse(await request.json());
    const entry = await createStatusEntry({ id: user.id, role: user.role }, params.cardId, data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
