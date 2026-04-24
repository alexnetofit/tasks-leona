import { supabase } from '@/config/supabase';
import type { TaskType } from '@/types';

/** Buscar todos os tipos de tarefa ativos */
export async function getTaskTypes() {
  const { data, error } = await supabase
    .from('task_types')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as TaskType[];
}

/** Buscar todos os tipos (incluindo inativos, para admin) */
export async function getAllTaskTypes() {
  const { data, error } = await supabase
    .from('task_types')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as TaskType[];
}

/** Criar novo tipo de tarefa */
export async function createTaskType(taskType: { name: string; color?: string; icon?: string }) {
  const { data, error } = await supabase
    .from('task_types')
    .insert({
      name: taskType.name.trim(),
      color: taskType.color || '#6366f1',
      icon: taskType.icon || '📌',
    })
    .select()
    .single();

  if (error) throw error;
  return data as TaskType;
}

/** Atualizar tipo de tarefa */
export async function updateTaskType(id: string, updates: Partial<TaskType>) {
  const { data, error } = await supabase
    .from('task_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TaskType;
}

/** Desativar tipo de tarefa (soft-delete) */
export async function deactivateTaskType(id: string) {
  return updateTaskType(id, { is_active: false });
}

/** Reativar tipo de tarefa */
export async function reactivateTaskType(id: string) {
  return updateTaskType(id, { is_active: true });
}

/** Criar tipo de tarefa inline (autocomplete) — retorna existente se já houver */
export async function getOrCreateTaskType(name: string): Promise<TaskType> {
  const trimmed = name.trim();
  
  // Tentar buscar existente
  const { data: existing } = await supabase
    .from('task_types')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle();

  if (existing) {
    // Reativar se estava inativo
    if (!existing.is_active) {
      await updateTaskType(existing.id, { is_active: true });
    }
    return existing as TaskType;
  }

  // Criar novo
  return createTaskType({ name: trimmed });
}
