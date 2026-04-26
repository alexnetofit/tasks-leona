import { IconPaperclip } from '@tabler/icons-react';
import type { Task, TaskPriority } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import dayjs from 'dayjs';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const TYPE_ICON: Record<string, string> = {
  bug: '🐛',
  feature: '✨',
  melhoria: '⬆️',
  documentação: '📄',
  documentacao: '📄',
  design: '🎨',
  infraestrutura: '⚙️',
  pesquisa: '🔍',
  outro: '📌',
};

/** Inferir emoji a partir do task_type ou de palavras-chave no título */
function getCardIcon(task: Task): string {
  if (task.task_type) {
    const key = task.task_type.toLowerCase().trim();
    if (TYPE_ICON[key]) return TYPE_ICON[key];
  }
  const t = task.title.toLowerCase();
  if (/\b(bug|erro|fix|corre[cç][aã]o)\b/.test(t)) return '🐛';
  if (/\b(api|webhook|integra[cç][aã]o)\b/.test(t)) return '🔌';
  if (/\b(chat|mensagem|lead|whatsapp)\b/.test(t)) return '💬';
  if (/\b(ia|gpt|ai)\b/.test(t)) return '🤖';
  if (/\b(mobile|app)\b/.test(t)) return '📱';
  if (/\b(pdf|arquivo|upload)\b/.test(t)) return '📎';
  if (/\b(p[aá]gina|tela|ui|design|layout)\b/.test(t)) return '🖼️';
  if (/\b(notifica|alerta)\b/.test(t)) return '🔔';
  if (/\b(dash|m[eé]trica|estat)\b/.test(t)) return '📊';
  if (/\b(ideia|sugest[aã]o)\b/.test(t)) return '💡';
  if (/\b(performance|lent|otimiz|demora)\b/.test(t)) return '⚡';
  return '📌';
}

/** Extrair primeiro nome do responsável e gerar inicial */
function getAssigneeShort(name: string): { initial: string; first: string } {
  const parts = name.trim().split(/\s+/);
  return { initial: parts[0][0]?.toUpperCase() || '?', first: parts[0] };
}

/** Pegar só a descrição limpa (sem o sufixo Tags:/Branch: que adicionamos no import) */
function cleanDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  // Remove blocos do tipo "Tags: ..." ou "Branch: ..." que adicionamos durante o import
  const cleaned = desc
    .split(/\n\s*\n/)
    .filter((block) => !/^(Tags|Branch):/i.test(block.trim()))
    .join('\n\n')
    .trim();
  return cleaned;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityConf = task.priority
    ? PRIORITY_CONFIG[task.priority as TaskPriority]
    : null;

  const isOverdue = task.due_date && !task.completed_at && dayjs(task.due_date).isBefore(dayjs(), 'day');

  const attachmentCount = task.attachments?.length || 0;
  const icon = getCardIcon(task);
  const cleanDesc = cleanDescription(task.description);
  const dateStr = task.updated_at
    ? dayjs(task.updated_at).format('MMMM D, YYYY h:mm A')
    : '';

  const hasAccent = !!task.color;

  return (
    <div
      className={`task-card ${hasAccent ? 'has-accent' : ''}`}
      onClick={onClick}
      style={hasAccent ? ({ ['--card-accent' as any]: task.color } as React.CSSProperties) : undefined}
    >
      <div className="task-card-title-row">
        <span className="task-card-icon" aria-hidden>{icon}</span>
        <div className="task-card-title">{task.title}</div>
      </div>

      {task.assignee && (
        <div className="task-card-assignee-chip" title={task.assignee.full_name}>
          <span className="task-card-assignee-chip-avatar">
            {getAssigneeShort(task.assignee.full_name).initial}
          </span>
          <span>{getAssigneeShort(task.assignee.full_name).first}</span>
        </div>
      )}

      {dateStr && (
        <div className="task-card-meta">
          <span className="task-card-date">{dateStr}</span>
        </div>
      )}

      {cleanDesc && (
        <div className="task-card-description-preview">{cleanDesc}</div>
      )}

      {(priorityConf || isOverdue || attachmentCount > 0) && (
        <div className="task-card-footer">
          <div className="task-card-footer-left">
            {priorityConf && task.priority && (
              <span className={`task-card-priority ${task.priority}`}>
                {priorityConf.label}
              </span>
            )}
            {isOverdue && (
              <span className="task-card-priority alta">Em Atraso</span>
            )}
          </div>
          {attachmentCount > 0 && (
            <span className="task-card-attachment-count">
              <IconPaperclip size={12} />
              {attachmentCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
