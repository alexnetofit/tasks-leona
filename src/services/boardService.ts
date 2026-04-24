import { supabase } from '@/config/supabase';
import type { Board, BoardColumn } from '@/types';

/** Buscar todos os boards ativos */
export async function getBoards() {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Board[];
}

/** Criar novo board */
export async function createBoard(board: Partial<Board>) {
  const { data, error } = await supabase
    .from('boards')
    .insert(board)
    .select()
    .single();

  if (error) throw error;
  return data as Board;
}

/** Atualizar board */
export async function updateBoard(id: string, updates: Partial<Board>) {
  const { data, error } = await supabase
    .from('boards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Board;
}

/** Buscar colunas de um board */
export async function getColumns(boardId: string) {
  const { data, error } = await supabase
    .from('board_columns')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data || []) as BoardColumn[];
}

/** Criar nova coluna */
export async function createColumn(column: Partial<BoardColumn>) {
  const { data, error } = await supabase
    .from('board_columns')
    .insert(column)
    .select()
    .single();

  if (error) throw error;
  return data as BoardColumn;
}

/** Atualizar coluna */
export async function updateColumn(id: string, updates: Partial<BoardColumn>) {
  const { data, error } = await supabase
    .from('board_columns')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as BoardColumn;
}

/** Excluir coluna */
export async function deleteColumn(id: string) {
  const { data, error } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Sem permissão ou coluna não encontrada.');
  }
}

/** Reordenar colunas (batch update positions) */
export async function reorderColumns(columns: { id: string; position: number }[]) {
  const promises = columns.map((col) =>
    supabase
      .from('board_columns')
      .update({ position: col.position })
      .eq('id', col.id)
  );
  await Promise.all(promises);
}
