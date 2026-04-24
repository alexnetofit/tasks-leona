import { useState, useEffect } from 'react';
import { Modal, TextInput, ColorInput, Button, ActionIcon, Group, Text, Stack, Badge, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconPencil, IconTrash, IconTag } from '@tabler/icons-react';
import * as taskTypeService from '@/services/taskTypeService';
import type { TaskType } from '@/types';

interface TaskTypeManagerProps {
  opened: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function TaskTypeManager({ opened, onClose, onUpdate }: TaskTypeManagerProps) {
  const [types, setTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<TaskType | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('📌');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadTypes = async () => {
    try {
      const data = await taskTypeService.getAllTaskTypes();
      setTypes(data);
    } catch (err) {
      console.error('[TaskTypeManager] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) loadTypes();
  }, [opened]);

  const resetForm = () => {
    setName('');
    setColor('#6366f1');
    setIcon('📌');
    setEditingType(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingType) {
        await taskTypeService.updateTaskType(editingType.id, { name: name.trim(), color, icon });
      } else {
        await taskTypeService.createTaskType({ name: name.trim(), color, icon });
      }
      await loadTypes();
      resetForm();
      onUpdate?.();
      notifications.show({ title: 'Sucesso', message: editingType ? 'Tipo atualizado' : 'Tipo criado', color: 'green' });
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err.message || 'Erro ao salvar', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (type: TaskType) => {
    try {
      if (type.is_active) {
        await taskTypeService.deactivateTaskType(type.id);
      } else {
        await taskTypeService.reactivateTaskType(type.id);
      }
      await loadTypes();
      onUpdate?.();
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao alterar status', color: 'red' });
    }
  };

  const handleEdit = (type: TaskType) => {
    setEditingType(type);
    setName(type.name);
    setColor(type.color);
    setIcon(type.icon);
    setShowForm(true);
  };

  return (
    <Modal opened={opened} onClose={() => { onClose(); resetForm(); }} title="Gerenciar Tipos de Tarefa" size="md">
      {/* Form */}
      {showForm ? (
        <Stack gap="sm" mb="lg" p="md" style={{ background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <Text size="sm" fw={600} c="var(--text-primary)">{editingType ? 'Editar Tipo' : 'Novo Tipo'}</Text>
          <TextInput label="Nome" placeholder="Ex: Hotfix, UX Research..." value={name} onChange={(e) => setName(e.currentTarget.value)} size="sm" />
          <Group grow>
            <ColorInput label="Cor" value={color} onChange={setColor} format="hex" size="sm"
              swatches={['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#6b7280']} />
            <TextInput label="Ícone (emoji)" placeholder="📌" value={icon} onChange={(e) => setIcon(e.currentTarget.value)} size="sm" maxLength={4} />
          </Group>
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" size="xs" onClick={resetForm}>Cancelar</Button>
            <Button size="xs" color="violet" loading={saving} onClick={handleSave}>{editingType ? 'Salvar' : 'Criar'}</Button>
          </Group>
        </Stack>
      ) : (
        <Button variant="light" color="violet" size="xs" leftSection={<IconPlus size={14} />} mb="md" onClick={() => setShowForm(true)}>
          Novo Tipo
        </Button>
      )}

      {/* Lista */}
      <Stack gap="xs">
        {loading ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">Carregando...</Text>
        ) : types.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">Nenhum tipo cadastrado</Text>
        ) : (
          types.map((type) => (
            <Group key={type.id} justify="space-between" p="xs" style={{
              background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)',
              opacity: type.is_active ? 1 : 0.5,
            }}>
              <Group gap="sm">
                <div style={{ width: 28, height: 28, borderRadius: 6, background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {type.icon}
                </div>
                <Text size="sm" fw={500} c="var(--text-primary)">{type.name}</Text>
              </Group>
              <Group gap="xs">
                <Switch size="xs" checked={type.is_active} onChange={() => handleToggle(type)} color="violet" />
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => handleEdit(type)}><IconPencil size={14} /></ActionIcon>
              </Group>
            </Group>
          ))
        )}
      </Stack>
    </Modal>
  );
}
