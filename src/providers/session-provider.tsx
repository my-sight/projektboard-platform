"use client";

import { SessionProvider as NextSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode } from "react";

interface Props {
  session: Session | null;
  children: ReactNode;
}

export function SessionProvider({ session, children }: Props) {
  return <NextSessionProvider session={session}>{children}</NextSessionProvider>;
}
