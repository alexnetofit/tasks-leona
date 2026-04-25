import { Badge, Group } from '@mantine/core';
import { IconCalendar, IconPaperclip } from '@tabler/icons-react';
import type { Task, TaskPriority } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import dayjs from 'dayjs';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityConf = task.priority
    ? PRIORITY_CONFIG[task.priority as TaskPriority]
    : null;

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const isOverdue = task.due_date && !task.completed_at && dayjs(task.due_date).isBefore(dayjs(), 'day');
  const isDueSoon = task.due_date && !task.completed_at &&
    dayjs(task.due_date).diff(dayjs(), 'day') <= 2 &&
    dayjs(task.due_date).isAfter(dayjs());

  const attachmentCount = task.attachments?.length || 0;

  return (
    <div
      className="task-card"
      onClick={onClick}
      style={{
        borderLeftColor: task.color || undefined,
        borderLeftWidth: task.color ? 3 : undefined,
      }}
    >
      <div className="task-card-title">{task.title}</div>

      <div className="task-card-meta">
        {priorityConf && (
          <Badge size="xs" variant="light" color={priorityConf.color}>
            {priorityConf.emoji} {priorityConf.label}
          </Badge>
        )}
        {task.task_type && (
          <Badge size="xs" variant="outline" color="gray">
            {task.task_type}
          </Badge>
        )}
        {isOverdue && (
          <Badge size="xs" variant="filled" color="red">
            Em Atraso
          </Badge>
        )}
      </div>

      <div className="task-card-footer">
        <Group gap={8}>
          {task.due_date ? (
            <span
              className="task-card-date"
              style={{
                color: isOverdue ? '#ef4444' : isDueSoon ? '#f59e0b' : 'var(--text-muted)',
              }}
            >
              <IconCalendar size={12} />
              {dayjs(task.due_date).format('DD MMM')}
            </span>
          ) : (
            <span />
          )}

          {attachmentCount > 0 && (
            <span className="task-card-attachment-count">
              <IconPaperclip size={12} />
              {attachmentCount}
            </span>
          )}
        </Group>

        {task.assignee && (
          <div
            className="task-card-assignee"
            title={task.assignee.full_name}
          >
            {getInitials(task.assignee.full_name)}
          </div>
        )}
      </div>
    </div>
  );
}
