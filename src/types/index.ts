/* ===================================================
 * Leona Projetos — Tipos Centralizados
 * ===================================================*/

/** Perfil de membro da equipe */
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string | null;
  cargo: string | null;
  role: 'admin' | 'operacao';
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Board / Projeto */
export interface Board {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  created_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Coluna do Kanban */
export interface BoardColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
  created_at: string;
}

/** Prioridade da tarefa */
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

/** Tarefa */
export interface Task {
  id: string;
  board_id: string;
  column_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority | null;
  task_type: string | null;
  assigned_to: string | null;
  created_by: string | null;
  position: number;
  color: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Populated via join */
  assignee?: Profile | null;
  attachments?: TaskAttachment[];
}

/** Anexo de tarefa */
export interface TaskAttachment {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Comentário de tarefa */
export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  /** Populated via join */
  author?: Profile | null;
}

/** Configuração de prioridade para UI */
export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; emoji: string }> = {
  baixa: { label: 'Baixa', color: 'gray', emoji: '⬇️' },
  media: { label: 'Média', color: 'blue', emoji: '➡️' },
  alta: { label: 'Alta', color: 'orange', emoji: '🔼' },
  urgente: { label: 'Urgente', color: 'red', emoji: '🔥' },
};

/** Tipo de tarefa (vindo do banco) */
export interface TaskType {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

/** Filtros de tarefa (persistidos na sessão) */
export interface TaskFilters {
  search: string;
  assignedTo: string | null;
  priority: TaskPriority | null;
  taskType: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

/** Filtros padrão (vazio) */
export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  assignedTo: null,
  priority: null,
  taskType: null,
  dateFrom: null,
  dateTo: null,
};
