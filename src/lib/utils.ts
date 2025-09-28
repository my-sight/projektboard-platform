import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

export function assertAuthenticated(session: Session | null) {
  if (!session?.user?.id) {
    throw Object.assign(new Error("Nicht autorisiert"), { status: 401 });
  }
  return session.user;
}

export function assertRole(user: { role: Role }, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error("Keine Berechtigung"), { status: 403 });
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  return NextResponse.json({ error: message }, { status: status > 0 ? status : 500 });
}
