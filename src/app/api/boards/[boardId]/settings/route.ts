import { NextRequest, NextResponse } from 'next/server';

import { readSessionTokens } from '@/lib/apiTokens';
import { ensureBoardMemberAccess } from '@/lib/serverBoardAccess';

interface SettingsPayload {
  settings?: Record<string, unknown> | null;
  meta?: {
    name?: string | null;
    description?: string | null;
  } | null;
  userId?: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  if (!boardId) {
    return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });
  }

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardMemberAccess(boardId, tokens, { allowViewer: true });
  if ('response' in auth) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  const { client } = auth;
  let query = client
    .from('kanban_board_settings')
    .select('settings, user_id')
    .eq('board_id', boardId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.is('user_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== 'PGRST116') {
    const message = error.message || 'Konnte Board-Einstellungen nicht laden.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    settings: (data?.settings as Record<string, unknown> | null) ?? null,
    userId: data?.user_id ?? userId ?? null,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  if (!boardId) {
    return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });
  }

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardMemberAccess(boardId, tokens);
  if ('response' in auth) {
    return auth.response;
  }

  let payload: SettingsPayload;
  try {
    payload = (await request.json()) as SettingsPayload;
  } catch (error) {
    console.error('Ungültige Settings-Payload:', error);
    return NextResponse.json({ error: 'Ungültige JSON-Payload.' }, { status: 400 });
  }

  const { client } = auth;
  const now = new Date().toISOString();
  const settingsDefined = Object.prototype.hasOwnProperty.call(payload, 'settings');
  const settings = payload.settings ?? null;
  const targetUserId = payload.userId ?? null;
  let updatedMeta: { name?: string | null; description?: string | null; updated_at?: string | null } | null = null;

  if (settingsDefined) {
    const { error: upsertError } = await client.from('kanban_board_settings').upsert({
      board_id: boardId,
      user_id: targetUserId,
      settings,
      updated_at: now,
    });

    if (upsertError) {
      const message = upsertError.message || 'Konnte Board-Einstellungen nicht speichern.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (payload.meta) {
    const metaUpdates: Record<string, unknown> = {};
    if ('name' in payload.meta) {
      metaUpdates.name = payload.meta?.name ?? null;
    }
    if ('description' in payload.meta) {
      metaUpdates.description = payload.meta?.description ?? null;
    }

    if (Object.keys(metaUpdates).length) {
      const { data: boardRow, error: boardError } = await client
        .from('kanban_boards')
        .update({ ...metaUpdates, updated_at: now })
        .eq('id', boardId)
        .select('name, description, updated_at')
        .maybeSingle();

      if (boardError) {
        const message = boardError.message || 'Konnte Board-Metadaten nicht aktualisieren.';
        return NextResponse.json({ error: message }, { status: 500 });
      }

      if (boardRow) {
        updatedMeta = {
          name: boardRow.name,
          description: boardRow.description,
          updated_at: boardRow.updated_at,
        };
      } else {
        updatedMeta = {
          name: (metaUpdates.name as string | null | undefined) ?? null,
          description: (metaUpdates.description as string | null | undefined) ?? null,
          updated_at: now,
        };
      }
    }
  }

  return NextResponse.json({ success: true, meta: updatedMeta });
}
