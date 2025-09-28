import { createHmac, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { env } from "@/lib/env";

const CSRF_COOKIE_NAME = "mysight.csrf";

export function createCsrfToken(sessionId: string) {
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", env.CSRF_SECRET).update(`${sessionId}:${nonce}`).digest("hex");
  const token = `${nonce}.${signature}`;
  return {
    token,
    cookieValue: token,
  };
}

export function verifyCsrfToken(sessionId: string, token?: string | null, cookieToken?: string | null) {
  if (!token || !cookieToken) {
    return false;
  }
  if (token !== cookieToken) {
    return false;
  }
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) {
    return false;
  }
  const expected = createHmac("sha256", env.CSRF_SECRET).update(`${sessionId}:${nonce}`).digest("hex");
  return expected === signature;
}

export function csrfCookieName() {
  return CSRF_COOKIE_NAME;
}

export function requireCsrf(request: NextRequest, session: Session) {
  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!verifyCsrfToken(session.user.id, headerToken, cookieToken)) {
    throw Object.assign(new Error("CSRF Prüfung fehlgeschlagen"), { status: 419 });
  }
}
