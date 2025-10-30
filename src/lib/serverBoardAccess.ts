import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

import { isSuperuserEmail } from '@/constants/superuser';
import { getServerSessionUser, resolveAdminSupabaseClient } from './supabaseServer';
import type { AnySupabaseClient } from './supabaseServer';
import type { SessionTokenHeaders } from './apiTokens';

interface BoardRow {
  id: string;
  owner_id: string | null;
  board_admin_id: string | null;
}

interface BoardAccessSuccess {
  client: AnySupabaseClient;
  user: User;
  board: BoardRow;
}

type BoardAccessResult = BoardAccessSuccess | { response: NextResponse };

interface BoardAccessOptions {
  allowViewer?: boolean;
}

export async function ensureBoardMemberAccess(
  boardId: string,
  tokens: SessionTokenHeaders = {},
  options: BoardAccessOptions = {},
): Promise<BoardAccessResult> {
  const user = await getServerSessionUser(tokens);

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 }),
    } as const;
  }

  const { client } = await resolveAdminSupabaseClient(tokens);

  if (isSuperuserEmail(user.email ?? '')) {
    return { client, user, board: { id: boardId, owner_id: null, board_admin_id: null } } as const;
  }

  const { data: board, error: boardError } = await client
    .from('kanban_boards')
    .select('id, owner_id, board_admin_id')
    .eq('id', boardId)
    .maybeSingle();

  if (boardError) {
    const message = boardError.message || 'Fehler beim Laden des Boards.';
    return { response: NextResponse.json({ error: message }, { status: 500 }) } as const;
  }

  if (!board) {
    return { response: NextResponse.json({ error: 'Board nicht gefunden.' }, { status: 404 }) } as const;
  }

  if (board.owner_id === user.id || board.board_admin_id === user.id) {
    return { client, user, board } as const;
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

  if (!membership && !options.allowViewer && board.board_admin_id !== user.id) {
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

  return { client, user, board } as const;
}
