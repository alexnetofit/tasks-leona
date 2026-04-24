import { useState, useEffect } from 'react';
import { Badge, Text, Group, Stack } from '@mantine/core';
import { IconCalendar, IconFlame } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';
import type { Task } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import dayjs from 'dayjs';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const fetchMyTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*, assignee:profiles!tasks_assigned_to_fkey(id, full_name)')
          .eq('assigned_to', profile.id)
          .is('completed_at', null)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTasks((data || []) as Task[]);
      } catch (err) {
        console.error('[Dashboard] Erro:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyTasks();
  }, [profile?.id]);

  const urgentTasks = tasks.filter((t) => t.priority === 'urgente' || t.priority === 'alta');
  const dueSoonTasks = tasks.filter((t) => t.due_date && dayjs(t.due_date).diff(dayjs(), 'day') <= 3 && dayjs(t.due_date).isAfter(dayjs()));
  const overdueTasks = tasks.filter((t) => t.due_date && dayjs(t.due_date).isBefore(dayjs(), 'day'));

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h1>{getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Usuário'} 👋</h1>
        <p>Aqui está um resumo das suas tarefas</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-card-label">Total de Tarefas</div>
          <div className="stat-card-value">{tasks.length}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#ef4444' }}>
          <div className="stat-card-label">🔥 Urgentes / Alta</div>
          <div className="stat-card-value" style={{ color: '#ef4444' }}>{urgentTasks.length}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#f59e0b' }}>
          <div className="stat-card-label">⏰ Prazo Próximo</div>
          <div className="stat-card-value" style={{ color: '#f59e0b' }}>{dueSoonTasks.length}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#ef4444' }}>
          <div className="stat-card-label">⚠️ Atrasadas</div>
          <div className="stat-card-value" style={{ color: '#ef4444' }}>{overdueTasks.length}</div>
        </div>
      </div>

      <Text size="lg" fw={600} mb="md" c="var(--text-primary)">Minhas Tarefas</Text>

      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Carregando...</div></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🎉</div><div className="empty-state-title">Tudo em dia!</div><div className="empty-state-desc">Nenhuma tarefa atribuída a você no momento</div></div>
      ) : (
        <Stack gap="xs">
          {tasks.map((task) => {
            const pri = task.priority ? PRIORITY_CONFIG[task.priority] : null;
            const isOverdue = task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day');
            return (
              <div key={task.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all 150ms ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500} c="var(--text-primary)">{task.title}</Text>
                    <Group gap="xs" mt={4}>
                      {pri && <Badge size="xs" variant="light" color={pri.color}>{pri.emoji} {pri.label}</Badge>}
                      {task.task_type && <Badge size="xs" variant="outline" color="gray">{task.task_type}</Badge>}
                    </Group>
                  </div>
                  {task.due_date && (
                    <Group gap={4}>
                      <IconCalendar size={12} color={isOverdue ? '#ef4444' : 'var(--text-muted)'} />
                      <Text size="xs" c={isOverdue ? 'red' : 'dimmed'}>{dayjs(task.due_date).format('DD/MM')}</Text>
                    </Group>
                  )}
                </Group>
              </div>
            );
          })}
        </Stack>
      )}
    </div>
  );
}
