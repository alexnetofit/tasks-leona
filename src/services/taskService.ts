import { supabase } from '@/config/supabase';
import type { Task, TaskComment, TaskAttachment } from '@/types';

/** Buscar tarefas de um board com assignee */
export async function getTasks(boardId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url, email),
      attachments:task_attachments(id, file_url, file_name, file_type, file_size, created_at)
    `)
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    assignee: t.assignee || null,
    attachments: t.attachments || [],
  })) as Task[];
}

/** Criar tarefa */
export async function createTask(task: Partial<Task>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

/** Atualizar tarefa */
export async function updateTask(id: string, updates: Partial<Task>) {
  // Limpar campos de join antes de salvar
  const cleanPayload = { ...updates };
  delete (cleanPayload as any).assignee;
  delete (cleanPayload as any).attachments;

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...cleanPayload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

/** Excluir tarefa */
export async function deleteTask(id: string) {
  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Sem permissão ou tarefa não encontrada.');
  }
}

/** Mover tarefa para outra coluna e/ou posição */
export async function moveTask(taskId: string, columnId: string, position: number) {
  const { error } = await supabase
    .from('tasks')
    .update({
      column_id: columnId,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw error;
}

/** Reordenar tarefas dentro de uma coluna (batch) */
export async function reorderTasks(tasks: { id: string; position: number; column_id: string }[]) {
  const promises = tasks.map((t) =>
    supabase
      .from('tasks')
      .update({ position: t.position, column_id: t.column_id })
      .eq('id', t.id)
  );
  await Promise.all(promises);
}

/** Buscar comentários de uma tarefa */
export async function getTaskComments(taskId: string) {
  const { data, error } = await supabase
    .from('task_comments')
    .select(`
      *,
      author:profiles!task_comments_author_id_fkey(id, full_name, avatar_url)
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((c: any) => ({
    ...c,
    author: c.author || null,
  })) as TaskComment[];
}

/** Criar comentário */
export async function createComment(comment: Partial<TaskComment>) {
  const { data, error } = await supabase
    .from('task_comments')
    .insert(comment)
    .select(`
      *,
      author:profiles!task_comments_author_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as TaskComment;
}

/** Buscar anexos de uma tarefa */
export async function getTaskAttachments(taskId: string) {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as TaskAttachment[];
}
