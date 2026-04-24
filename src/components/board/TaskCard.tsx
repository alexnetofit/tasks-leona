import { Badge } from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
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

  const isOverdue = task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day');
  const isDueSoon = task.due_date &&
    dayjs(task.due_date).diff(dayjs(), 'day') <= 2 &&
    dayjs(task.due_date).isAfter(dayjs());

  return (
    <div className="task-card" onClick={onClick}>
      <div className="task-card-title">{task.title}</div>

      <div className="task-card-meta">
        {priorityConf && (
          <Badge
            size="xs"
            variant="light"
            color={priorityConf.color}
          >
            {priorityConf.emoji} {priorityConf.label}
          </Badge>
        )}
        {task.task_type && (
          <Badge size="xs" variant="outline" color="gray">
            {task.task_type}
          </Badge>
        )}
      </div>

      {/* Images preview */}
      {task.attachments && task.attachments.length > 0 && (
        <div className="task-card-images">
          {task.attachments.slice(0, 3).map((att) => (
            <img
              key={att.id}
              src={att.file_url}
              alt={att.file_name || 'Imagem'}
              className="task-card-image-thumb"
              onClick={(e) => e.stopPropagation()}
            />
          ))}
          {task.attachments.length > 3 && (
            <Badge size="xs" variant="filled" color="dark">
              +{task.attachments.length - 3}
            </Badge>
          )}
        </div>
      )}

      <div className="task-card-footer">
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
