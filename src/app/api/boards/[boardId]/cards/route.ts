import { NextRequest, NextResponse } from 'next/server';

import { isSuperuserEmail } from '@/constants/superuser';
import { getServerSessionUser, resolveAdminSupabaseClient } from '@/lib/supabaseServer';

interface PersistedCard {
  board_id: string;
  card_id: string;
  card_data: Record<string, unknown>;
  stage?: string | null;
  position?: number | null;
  project_number?: string | null;
  project_name?: string | null;
  updated_at?: string;
}

interface SessionTokenHeaders {
  accessToken?: string;
  refreshToken?: string;
}

function readSessionTokens(request: NextRequest): SessionTokenHeaders {
  const accessToken = request.headers.get('x-supabase-access-token') ?? undefined;
  const refreshToken = request.headers.get('x-supabase-refresh-token') ?? undefined;
  return { accessToken, refreshToken };
}

async function ensureBoardAccess(boardId: string, tokens: SessionTokenHeaders) {
  const user = await getServerSessionUser(tokens);

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 }),
    } as const;
  }

  const email = user.email ?? '';
  const { client } = await resolveAdminSupabaseClient(tokens);

  if (isSuperuserEmail(email)) {
    return { client, user } as const;
  }

  const { data: board, error: boardError } = await client
    .from('kanban_boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .maybeSingle();

  if (boardError) {
    const message = boardError.message || 'Fehler beim Laden des Boards.';
    return { response: NextResponse.json({ error: message }, { status: 500 }) } as const;
  }

  if (!board) {
    return { response: NextResponse.json({ error: 'Board nicht gefunden.' }, { status: 404 }) } as const;
  }

  if (board.owner_id === user.id) {
    return { client, user } as const;
  }

  const { data: membership, error: membershipError } = await client
    .from('board_members')
    .select('id')
    .eq('board_id', boardId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (membershipError) {
    const message = membershipError.message || 'Fehler beim Prüfen der Mitgliedschaft.';
    return { response: NextResponse.json({ error: message }, { status: 500 }) } as const;
  }

  if (!membership) {
    return {
      response: NextResponse.json(
        {
          error:
            'Du bist kein Mitglied dieses Boards. Bitte füge dich zuerst als Mitglied hinzu oder wende dich an eine:n Administrator:in.',
        },
        { status: 403 },
      ),
    } as const;
  }

  return { client, user } as const;
}

export async function POST(request: NextRequest, { params }: { params: { boardId: string } }) {
  const boardId = params.boardId;

  if (!boardId) {
    return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });
  }

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardAccess(boardId, tokens);
  if ('response' in auth) {
    return auth.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error('Ungültige Karten-Payload:', error);
    return NextResponse.json({ error: 'Ungültige JSON-Payload.' }, { status: 400 });
  }

  const cards = Array.isArray((payload as { cards?: PersistedCard[] }).cards)
    ? ((payload as { cards: PersistedCard[] }).cards ?? [])
    : [];

  const timestamp = new Date().toISOString();
  const normalizedCards = cards.map(card => ({
    ...card,
    board_id: boardId,
    updated_at: timestamp,
  }));

  const { client } = auth;

  const { error: deleteError } = await client.from('kanban_cards').delete().eq('board_id', boardId);

  if (deleteError) {
    const message = deleteError.message || 'Konnte bestehende Karten nicht löschen.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (normalizedCards.length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error: insertError } = await client.from('kanban_cards').insert(normalizedCards);

  if (insertError) {
    const message = insertError.message || 'Konnte Karten nicht speichern.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { boardId: string } }) {
  const boardId = params.boardId;

  if (!boardId) {
    return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('cardId');

  if (!cardId) {
    return NextResponse.json({ error: 'cardId ist erforderlich.' }, { status: 400 });
  }

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardAccess(boardId, tokens);
  if ('response' in auth) {
    return auth.response;
  }

  const { client } = auth;
  const { error } = await client
    .from('kanban_cards')
    .delete()
    .eq('board_id', boardId)
    .eq('card_id', cardId);

  if (error) {
    const message = error.message || 'Konnte Karte nicht löschen.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
