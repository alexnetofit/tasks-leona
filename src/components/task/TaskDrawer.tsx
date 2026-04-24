import { useState, useEffect, useCallback } from 'react';
import { Drawer, Select, ActionIcon, Text, Group, Stack, Badge, Textarea, Combobox, useCombobox, TextInput, InputBase } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconUser, IconTag, IconCalendar, IconFlame, IconTrash, IconColumns3 } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import * as taskService from '@/services/taskService';
import { getOrCreateTaskType } from '@/services/taskTypeService';
import { uploadClipboardImage, registerAttachment } from '@/services/storageService';
import type { Task, BoardColumn, Profile, TaskComment, TaskType } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import RichEditor from '../shared/RichEditor';
import ImageLightbox from '../shared/ImageLightbox';

interface TaskDrawerProps {
  task: Task | null;
  opened: boolean;
  onClose: () => void;
  onUpdate: () => void;
  members: Profile[];
  columns: BoardColumn[];
  boardId: string;
  taskTypes: TaskType[];
}

export default function TaskDrawer({ task, opened, onClose, onUpdate, members, columns, boardId, taskTypes }: TaskDrawerProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Autocomplete task type
  const [typeSearch, setTypeSearch] = useState('');
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority || null);
      setTaskType(task.task_type || null);
      setTypeSearch(task.task_type || '');
      setAssignedTo(task.assigned_to || null);
      setColumnId(task.column_id || null);
      setDueDate(task.due_date ? new Date(task.due_date) : null);
      taskService.getTaskComments(task.id).then(setComments).catch(console.error);
    }
  }, [task?.id]);

  const saveField = useCallback(async (field: string, value: any) => {
    if (!task) return;
    try { await taskService.updateTask(task.id, { [field]: value }); onUpdate(); } catch (err) { console.error(`[TaskDrawer] save ${field}:`, err); }
  }, [task, onUpdate]);

  const handleTitleBlur = () => { if (title.trim() && title !== task?.title) saveField('title', title.trim()); };

  const handleDescriptionChange = (html: string) => setDescription(html);
  const handleDescriptionBlur = () => { if (description !== task?.description) saveField('description', description); };

  const handleTaskTypeSelect = async (typeName: string) => {
    setTaskType(typeName);
    setTypeSearch(typeName);
    combobox.closeDropdown();
    // Criar se não existe
    try {
      await getOrCreateTaskType(typeName);
      saveField('task_type', typeName);
    } catch (err) {
      console.error('[TaskDrawer] Erro ao salvar tipo:', err);
    }
  };

  const handleImagePaste = async (file: File) => {
    if (!task || !boardId) return;
    try {
      const url = await uploadClipboardImage(boardId, task.id, file);
      await registerAttachment({ task_id: task.id, file_url: url, file_name: file.name, file_type: file.type, file_size: file.size, uploaded_by: user?.id });
      onUpdate();
      notifications.show({ title: 'Imagem adicionada', message: 'A imagem foi salva na tarefa', color: 'green' });
      return url;
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Falha no upload da imagem', color: 'red' });
      return undefined;
    }
  };

  const handleImageClick = (src: string) => {
    const images = task?.attachments?.map((a) => a.file_url) || [];
    if (images.length === 0) images.push(src);
    setLightboxImages(images);
    setLightboxIndex(Math.max(0, images.indexOf(src)));
    setLightboxOpen(true);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      const comment = await taskService.createComment({ task_id: task.id, author_id: user?.id, content: newComment.trim() });
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao adicionar comentário', color: 'red' });
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await taskService.deleteTask(task.id);
      onUpdate(); onClose();
      notifications.show({ title: 'Excluído', message: 'Tarefa excluída', color: 'gray' });
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao excluir tarefa', color: 'red' });
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // Filtrar task types para o autocomplete
  const filteredTypes = typeSearch.trim()
    ? taskTypes.filter((t) => t.name.toLowerCase().includes(typeSearch.toLowerCase()))
    : taskTypes;

  const showCreateOption = typeSearch.trim() && !taskTypes.some((t) => t.name.toLowerCase() === typeSearch.toLowerCase());

  if (!task) return null;

  return (
    <>
      <Drawer opened={opened} onClose={onClose} position="right" size="lg" withCloseButton
        overlayProps={{ backgroundOpacity: 0.4, blur: 3 }}
        styles={{
          content: { backgroundColor: 'var(--bg-surface)' },
          header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' },
          body: { padding: 0 },
        }}
        title={
          <Group gap="xs">
            <Badge size="sm" variant="light" color="violet">Tarefa</Badge>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={handleDelete} title="Excluir tarefa">
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        }
      >
        {/* Title */}
        <div className="task-drawer-header">
          <input className="task-drawer-title-input" value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur} placeholder="Nome da tarefa..." />
        </div>

        {/* Properties */}
        <div className="task-drawer-properties">
          <div className="task-drawer-property">
            <div className="task-drawer-property-label"><IconColumns3 size={14} /> Status</div>
            <div className="task-drawer-property-value">
              <Select data={columns.map((c) => ({ value: c.id, label: c.title }))} value={columnId}
                onChange={(val) => { setColumnId(val); if (val) saveField('column_id', val); }}
                variant="unstyled" size="xs" styles={{ input: { color: 'var(--text-primary)', fontSize: '13px' } }} />
            </div>
          </div>

          <div className="task-drawer-property">
            <div className="task-drawer-property-label"><IconUser size={14} /> Responsável</div>
            <div className="task-drawer-property-value">
              <Select data={members.map((m) => ({ value: m.id, label: m.full_name }))} value={assignedTo}
                onChange={(val) => { setAssignedTo(val); saveField('assigned_to', val || null); }}
                variant="unstyled" size="xs" placeholder="Selecionar..." clearable
                styles={{ input: { color: 'var(--text-primary)', fontSize: '13px' } }} />
            </div>
          </div>

          <div className="task-drawer-property">
            <div className="task-drawer-property-label"><IconFlame size={14} /> Prioridade</div>
            <div className="task-drawer-property-value">
              <Select
                data={Object.entries(PRIORITY_CONFIG).map(([key, val]) => ({ value: key, label: `${val.emoji} ${val.label}` }))}
                value={priority} onChange={(val) => { setPriority(val); saveField('priority', val || null); }}
                variant="unstyled" size="xs" placeholder="Selecionar..." clearable
                styles={{ input: { color: 'var(--text-primary)', fontSize: '13px' } }} />
            </div>
          </div>

          {/* Tipo — Autocomplete Creatable */}
          <div className="task-drawer-property">
            <div className="task-drawer-property-label"><IconTag size={14} /> Tipo</div>
            <div className="task-drawer-property-value">
              <Combobox store={combobox} onOptionSubmit={handleTaskTypeSelect}>
                <Combobox.Target>
                  <InputBase
                    rightSection={<Combobox.Chevron />}
                    rightSectionPointerEvents="none"
                    value={typeSearch}
                    onChange={(e) => { setTypeSearch(e.currentTarget.value); combobox.openDropdown(); combobox.updateSelectedOptionIndex(); }}
                    onClick={() => combobox.openDropdown()}
                    onFocus={() => combobox.openDropdown()}
                    onBlur={() => combobox.closeDropdown()}
                    placeholder="Selecionar ou criar..."
                    variant="unstyled"
                    size="xs"
                    styles={{ input: { color: 'var(--text-primary)', fontSize: '13px' } }}
                  />
                </Combobox.Target>
                <Combobox.Dropdown>
                  <Combobox.Options>
                    {filteredTypes.map((t) => (
                      <Combobox.Option key={t.id} value={t.name}>
                        <Group gap="xs">
                          <span style={{ fontSize: 14 }}>{t.icon}</span>
                          <span>{t.name}</span>
                        </Group>
                      </Combobox.Option>
                    ))}
                    {showCreateOption && (
                      <Combobox.Option value={typeSearch.trim()}>
                        <Group gap="xs">
                          <span style={{ color: 'var(--accent-violet)' }}>+ Criar</span>
                          <span style={{ fontWeight: 600 }}>"{typeSearch.trim()}"</span>
                        </Group>
                      </Combobox.Option>
                    )}
                    {filteredTypes.length === 0 && !showCreateOption && (
                      <Combobox.Empty>Nenhum tipo encontrado</Combobox.Empty>
                    )}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>
            </div>
          </div>

          <div className="task-drawer-property">
            <div className="task-drawer-property-label"><IconCalendar size={14} /> Prazo</div>
            <div className="task-drawer-property-value">
              <DatePickerInput value={dueDate}
                onChange={(val: any) => { const d = val ? new Date(val) : null; setDueDate(d); saveField('due_date', d ? d.toISOString() : null); }}
                variant="unstyled" size="xs" placeholder="Selecionar..." clearable valueFormat="DD/MM/YYYY"
                styles={{ input: { color: 'var(--text-primary)', fontSize: '13px' } }} />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="task-drawer-editor">
          <div className="task-drawer-editor-title">Descrição</div>
          <RichEditor value={description} onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur} onImagePaste={handleImagePaste}
            onImageClick={handleImageClick} placeholder="Descreva a tarefa... Cole imagens com Ctrl+V" />
        </div>

        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div style={{ padding: '0 24px 16px' }}>
            <Text size="sm" fw={600} mb="xs" c="var(--text-primary)">Anexos ({task.attachments.length})</Text>
            <Group gap="xs">
              {task.attachments.map((att) => (
                <img key={att.id} src={att.file_url} alt={att.file_name || 'Anexo'}
                  style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
                  onClick={() => handleImageClick(att.file_url)} />
              ))}
            </Group>
          </div>
        )}

        {/* Comments */}
        <div style={{ padding: '0 24px 24px' }}>
          <Text size="sm" fw={600} mb="sm" c="var(--text-primary)">Comentários</Text>
          <Stack gap="sm" mb="md">
            {comments.map((comment) => (
              <div key={comment.id} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
                <Group gap="xs" mb={4}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-violet), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 600 }}>
                    {comment.author ? getInitials(comment.author.full_name) : '?'}
                  </div>
                  <Text size="xs" fw={500} c="var(--text-primary)">{comment.author?.full_name || 'Anônimo'}</Text>
                  <Text size="xs" c="dimmed">{new Date(comment.created_at).toLocaleDateString('pt-BR')}</Text>
                </Group>
                <Text size="sm" c="var(--text-secondary)">{comment.content}</Text>
              </div>
            ))}
          </Stack>
          <Textarea value={newComment} onChange={(e) => setNewComment(e.currentTarget.value)}
            placeholder="Adicionar comentário..." autosize minRows={1} maxRows={4}
            styles={{ input: { backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }} />
        </div>
      </Drawer>

      <ImageLightbox images={lightboxImages} currentIndex={lightboxIndex} opened={lightboxOpen}
        onClose={() => setLightboxOpen(false)} onIndexChange={setLightboxIndex} />
    </>
  );
}
