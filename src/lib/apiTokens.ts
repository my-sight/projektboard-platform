import type { NextRequest } from 'next/server';

export interface SessionTokenHeaders {
  accessToken?: string;
  refreshToken?: string;
}

export function readSessionTokens(request: NextRequest): SessionTokenHeaders {
  const accessToken = request.headers.get('x-supabase-access-token') ?? undefined;
  const refreshToken = request.headers.get('x-supabase-refresh-token') ?? undefined;

  return { accessToken, refreshToken };
}
