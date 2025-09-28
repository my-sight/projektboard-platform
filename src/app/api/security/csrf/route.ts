import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCsrfToken, csrfCookieName } from "@/lib/csrf";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { token, cookieValue } = createCsrfToken(session.user.id);
  const response = NextResponse.json({ token });
  response.cookies.set(csrfCookieName(), cookieValue, {
    httpOnly: false,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 30,
  });
  return response;
}
