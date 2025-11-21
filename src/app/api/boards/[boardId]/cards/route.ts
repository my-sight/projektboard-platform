import { NextRequest, NextResponse } from 'next/server';
import { readSessionTokens } from '@/lib/apiTokens';
import { ensureBoardMemberAccess } from '@/lib/serverBoardAccess';

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

// POST: Bulk-Upsert (für Drag & Drop / Initialisierung)
export async function POST(request: NextRequest, { params }: { params: { boardId: string } }) {
  const boardId = params.boardId;
  if (!boardId) return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardMemberAccess(boardId, tokens);
  if ('response' in auth) return auth.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
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

  // Wir nutzen UPSERT statt DELETE+INSERT für mehr Datensicherheit
  if (normalizedCards.length > 0) {
    const { error: upsertError } = await client
      .from('kanban_cards')
      .upsert(normalizedCards, { onConflict: 'board_id, card_id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

// PATCH: Einzelne oder partielle Updates (für Statusänderungen, Text-Edits)
export async function PATCH(request: NextRequest, { params }: { params: { boardId: string } }) {
  const boardId = params.boardId;
  if (!boardId) return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardMemberAccess(boardId, tokens);
  if ('response' in auth) return auth.response;

  let payload: { card_id: string; updates: Record<string, any> } | null = null;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Ungültiges JSON.' }, { status: 400 });
  }

  if (!payload || !payload.card_id || !payload.updates) {
    return NextResponse.json({ error: 'card_id und updates erforderlich.' }, { status: 400 });
  }

  const { client } = auth;
  
  // Wir müssen unterscheiden: Ist es ein Update der SQL-Spalten oder des JSONB?
  // Supabase merged JSONB bei update() leider nicht automatisch tief, 
  // aber wir können das card_data komplett ersetzen, da der Client den aktuellen Stand hat.
  
  const updateData: any = { 
    updated_at: new Date().toISOString() 
  };

  // Mapping: Wenn Top-Level Felder wie 'stage' geändert werden, update die Spalte
  if (payload.updates.stage !== undefined) updateData.stage = payload.updates.stage;
  if (payload.updates.position !== undefined) updateData.position = payload.updates.position;
  
  // Alles andere geht in card_data
  // HINWEIS: Wir gehen davon aus, dass der Client das VOLLE card_data Objekt sendet,
  // wenn er JSON-Inhalte ändert.
  if (payload.updates.card_data) {
    updateData.card_data = payload.updates.card_data;
  }

  const { error } = await client
    .from('kanban_cards')
    .update(updateData)
    .eq('board_id', boardId)
    .eq('card_id', payload.card_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { boardId: string } }) {
  const boardId = params.boardId;
  if (!boardId) return NextResponse.json({ error: 'Board-ID fehlt.' }, { status: 400 });

  const searchParams = request.nextUrl.searchParams;
  const cardId = searchParams.get('cardId');

  if (!cardId) return NextResponse.json({ error: 'cardId ist erforderlich.' }, { status: 400 });

  const tokens = readSessionTokens(request);
  const auth = await ensureBoardMemberAccess(boardId, tokens);
  if ('response' in auth) return auth.response;

  const { client } = auth;
  const { error } = await client
    .from('kanban_cards')
    .delete()
    .eq('board_id', boardId)
    .eq('card_id', cardId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}