import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertAuthenticated, errorResponse } from "@/lib/utils";
import { requireCsrf } from "@/lib/csrf";
import { assertRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { completeFlowTask } from "@/lib/project-service";

const completeSchema = z.object({
  taskId: z.string(),
});

export async function GET() {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    const tasks = await prisma.subTaskCard.findMany({
      where: {
        archivedAt: null,
        column: { name: "FLOW" },
        lane: { userId: user.id },
      },
      include: {
        subBoard: {
          include: {
            projectCard: {
              include: {
                board: true,
              },
            },
            columns: true,
          },
        },
        lane: true,
      },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = assertAuthenticated(session);
    requireCsrf(request, session);
    assertRateLimit(`me:tasks:${user.id}`);
    const { taskId } = completeSchema.parse(await request.json());
    await completeFlowTask({ id: user.id, role: user.role }, taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
