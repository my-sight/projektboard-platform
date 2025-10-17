import { createClient, User } from '@supabase/supabase-js';
import { Board, BoardColumn, Card } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const boardService = {
  async getBoards(): Promise<Board[]> {
    try {
      console.log('Loading boards...');
      
      const { data: boardsData, error: boardsError } = await supabase
        .from('boards')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (boardsError) {
        console.error('Boards error:', boardsError);
        throw new Error(`Failed to load boards: ${boardsError.message}`);
      }

      console.log('Loaded boards:', boardsData);

      // Load columns and cards for each board
      const boardsWithData = await Promise.all(
        (boardsData || []).map(async (board) => {
          const { data: columnsData, error: columnsError } = await supabase
            .from('board_columns')
            .select('*')
            .eq('board_id', board.id)
            .order('position');

          if (columnsError) {
            console.error('Columns error for board', board.id, ':', columnsError);
            return { ...board, columns: [] };
          }

          // Load cards for all columns
          const columnsWithCards = await Promise.all(
            (columnsData || []).map(async (column) => {
              const { data: cardsData, error: cardsError } = await supabase
                .from('cards')
                .select(`
                  *,
                  assignee:assigned_to (
                    id,
                    email,
                    display_name
                  )
                `)
                .eq('column_id', column.id)
                .is('archived_at', null)
                .order('position');

              if (cardsError) {
                console.error('Cards error for column', column.id, ':', cardsError);
                return { ...column, cards: [] };
              }

              return { ...column, cards: cardsData || [] };
            })
          );

          return { ...board, columns: columnsWithCards };
        })
      );

      return boardsWithData;
    } catch (error) {
      console.error('Error in getBoards:', error);
      throw error;
    }
  },

  async getBoard(boardId: string): Promise<Board> {
    try {
      console.log('Loading board:', boardId);
      
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

      if (boardError) {
        console.error('Board error:', boardError);
        throw new Error(`Board not found: ${boardError.message}`);
      }

      const { data: columnsData, error: columnsError } = await supabase
        .from('board_columns')
        .select('*')
        .eq('board_id', boardId)
        .order('position');

      if (columnsError) {
        console.error('Columns error:', columnsError);
        throw new Error(`Failed to load columns: ${columnsError.message}`);
      }

      const columnsWithCards = await Promise.all(
        (columnsData || []).map(async (column) => {
          const { data: cardsData, error: cardsError } = await supabase
            .from('cards')
            .select(`
              *,
              assignee:assigned_to (
                id,
                email,
                display_name
              )
            `)
            .eq('column_id', column.id)
            .is('archived_at', null)
            .order('position');

          if (cardsError) {
            console.error('Cards error:', cardsError);
            return { ...column, cards: [] };
          }

          return { ...column, cards: cardsData || [] };
        })
      );

      return { ...boardData, columns: columnsWithCards };
    } catch (error) {
      console.error('Error in getBoard:', error);
      throw error;
    }
  },

  async createBoard(name: string, description?: string): Promise<Board> {
    try {
      console.log('Creating board:', { name, description });
      
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .insert([
          {
            name,
            description,
            settings: {
              view_mode: 'columns',
              density: 'normal'
            }
          }
        ])
        .select()
        .single();

      if (boardError) {
        console.error('Create board error:', boardError);
        throw new Error(`Failed to create board: ${boardError.message}`);
      }

      // Create default columns
      const defaultColumns = [
        { name: 'Backlog', position: 0, is_done: false, color: '#6b7280' },
        { name: 'In Bearbeitung', position: 1, is_done: false, color: '#3b82f6' },
        { name: 'Review', position: 2, is_done: false, color: '#f59e0b' },
        { name: 'Fertig', position: 3, is_done: true, color: '#10b981' }
      ];

      const { data: columnsData, error: columnsError } = await supabase
        .from('board_columns')
        .insert(
          defaultColumns.map(col => ({
            ...col,
            board_id: boardData.id
          }))
        )
        .select();

      if (columnsError) {
        console.error('Error creating columns:', columnsError);
        throw new Error(`Failed to create columns: ${columnsError.message}`);
      }

      return {
        ...boardData,
        columns: (columnsData || []).map(col => ({ ...col, cards: [] }))
      };
    } catch (error) {
      console.error('Error in createBoard:', error);
      throw error;
    }
  },

  async moveCard(cardId: string, columnId: string, position: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('cards')
        .update({
          column_id: columnId,
          position,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (error) {
        console.error('Move card error:', error);
        throw new Error(`Failed to move card: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in moveCard:', error);
      throw error;
    }
  },

  async updateCard(cardId: string, updates: Partial<Card>): Promise<void> {
    try {
      const { error } = await supabase
        .from('cards')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (error) {
        console.error('Update card error:', error);
        throw new Error(`Failed to update card: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in updateCard:', error);
      throw error;
    }
  },

  async createCard(card: Omit<Card, 'id' | 'created_at' | 'updated_at'>): Promise<Card> {
    try {
      const { data, error } = await supabase
        .from('cards')
        .insert([card])
        .select()
        .single();

      if (error) {
        console.error('Create card error:', error);
        throw new Error(`Failed to create card: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error in createCard:', error);
      throw error;
    }
  }
};

export const authService = {
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user as User | null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
};
