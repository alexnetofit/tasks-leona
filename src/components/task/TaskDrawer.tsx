import { useState, useEffect, useCallback, useRef } from 'react';
import { Drawer, Select, ActionIcon, Text, Group, Stack, Badge, Textarea, Combobox, useCombobox, TextInput, InputBase, Menu, ColorInput, Loader } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconUser, IconTag, IconCalendar, IconFlame, IconTrash, IconColumns3,
  IconDots, IconLink, IconMaximize, IconMinimize, IconPalette,
  IconPaperclip, IconUpload, IconFile, IconX, IconDownload,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import * as taskService from '@/services/taskService';
import { getOrCreateTaskType } from '@/services/taskTypeService';
import { uploadTaskImage, uploadClipboardImage, registerAttachment, deleteAttachment } from '@/services/storageService';
import type { Task, BoardColumn, Profile, TaskComment, TaskType, TaskAttachment } from '@/types';
import { PRIORITY_CONFIG } from '@/types';
import RichEditor from '../shared/RichEditor';
import ImageLightbox from '../shared/ImageLightbox';
import dayjs from 'dayjs';

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
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Expand mode (fullscreen drawer)
  const [isExpanded, setIsExpanded] = useState(false);

  // File upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setCardColor(task.color || null);
      setDueDate(task.due_date ? new Date(task.due_date) : null);
      taskService.getTaskComments(task.id).then(setComments).catch(console.error);
    }
  }, [task?.id]);

  // Reset expanded state when drawer closes
  useEffect(() => {
    if (!opened) setIsExpanded(false);
  }, [opened]);

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
    } catch (err: any) {
      console.error('[TaskDrawer] paste error:', err);
      notifications.show({
        title: 'Erro no upload',
        message: err?.message || 'Falha no upload da imagem',
        color: 'red',
        autoClose: 8000,
      });
      return undefined;
    }
  };

  /** Upload de arquivos genéricos via botão */
  const handleFileUpload = async (files: File[]) => {
    if (!task || !boardId || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadTaskImage(boardId, task.id, file);
        await registerAttachment({ task_id: task.id, file_url: url, file_name: file.name, file_type: file.type, file_size: file.size, uploaded_by: user?.id });
      }
      onUpdate();
      notifications.show({ title: 'Arquivo(s) anexado(s)', message: `${files.length} arquivo(s) enviado(s)`, color: 'green' });
    } catch (err: any) {
      console.error('[TaskDrawer] Upload error:', err);
      notifications.show({
        title: 'Erro no upload',
        message: err?.message || 'Falha ao enviar arquivo(s)',
        color: 'red',
        autoClose: 8000,
      });
    } finally { setUploading(false); }
  };

  /** Deletar um anexo */
  const handleDeleteAttachment = async (att: TaskAttachment) => {
    if (!task) return;
    try {
      await deleteAttachment(att.id, att.file_url);
      onUpdate();
      notifications.show({ title: 'Removido', message: 'Anexo removido', color: 'gray' });
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao remover anexo', color: 'red' });
    }
  };

  const handleImageClick = (src: string) => {
    const images = task?.attachments?.filter((a) => a.file_type?.startsWith('image/')).map((a) => a.file_url) || [];
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

  /** Copiar link da tarefa para clipboard */
  const handleCopyLink = () => {
    if (!task) return;
    const url = `${window.location.origin}/board?task=${task.id}`;
    navigator.clipboard.writeText(url).then(() => {
      notifications.show({ title: 'Link copiado', message: 'O link da tarefa foi copiado', color: 'violet' });
    }).catch(() => {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      notifications.show({ title: 'Link copiado', message: 'O link da tarefa foi copiado', color: 'violet' });
    });
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  /** Verifica se o anexo é imagem */
  const isImageFile = (att: TaskAttachment) => {
    if (att.file_type?.startsWith('image/')) return true;
    const ext = att.file_name?.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  /** Formatar tamanho de arquivo */
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filtrar task types para o autocomplete
  const filteredTypes = typeSearch.trim()
    ? taskTypes.filter((t) => t.name.toLowerCase().includes(typeSearch.toLowerCase()))
    : taskTypes;

  const showCreateOption = typeSearch.trim() && !taskTypes.some((t) => t.name.toLowerCase() === typeSearch.toLowerCase());

  if (!task) return null;

  const attachments = task.attachments || [];
  const imageAttachments = attachments.filter(isImageFile);
  const fileAttachments = attachments.filter((a) => !isImageFile(a));

  const isOverdue = dueDate && !task.completed_at && dayjs(dueDate).isBefore(dayjs(), 'day');

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size={isExpanded ? '100%' : 'lg'}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.4, blur: 3 }}
        styles={{
          content: { backgroundColor: 'var(--bg-surface)', transition: 'width 300ms ease' },
          header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px' },
          body: { padding: 0 },
        }}
        title={
          <Group gap="xs" justify="space-between" w="100%">
            <Badge size="sm" variant="light" color="violet">Tarefa</Badge>

            <Group gap={4} ml="auto">
              {/* Expand / Minimize — ícones bem distintos */}
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Reduzir' : 'Expandir'}
              >
                {isExpanded ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
              </ActionIcon>

              {/* Actions dropdown */}
              <Menu shadow="md" width={180} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="sm" title="Ações">
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconLink size={14} />} onClick={handleCopyLink}>
                    Copiar Link
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={handleDelete}>
                    Excluir
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        }
      >
        {/* Title + Overdue Badge */}
        <div className="task-drawer-header">
          <input className="task-drawer-title-input" value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur} placeholder="Nome da tarefa..." />
          {isOverdue && (
            <Badge size="sm" variant="filled" color="red" mt={4}>🔥 Em Atraso</Badge>
          )}
        </div>

        {/* Properties — Grid 2 colunas */}
        <div className="task-drawer-properties">
          <div className="task-drawer-properties-grid">
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

            <div className="task-drawer-property">
              <div className="task-drawer-property-label"><IconPalette size={14} /> Cor</div>
              <div className="task-drawer-property-value">
                <ColorInput
                  value={cardColor || ''}
                  onChange={(val) => { setCardColor(val || null); saveField('color', val || null); }}
                  variant="unstyled" size="xs" placeholder="Sem cor"
                  format="hex"
                  swatches={['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']}
                  styles={{ input: { color: 'var(--text-primary)', fontSize: '13px' } }}
                />
              </div>
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

        {/* File Upload Area */}
        <div className="task-drawer-attachments">
          <div className="task-drawer-attachments-header">
            <Group gap="xs">
              <IconPaperclip size={15} />
              <Text size="sm" fw={600} c="var(--text-primary)">
                Anexos {attachments.length > 0 && `(${attachments.length})`}
              </Text>
            </Group>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    handleFileUpload(Array.from(files));
                    e.target.value = '';
                  }
                }}
              />
              <ActionIcon
                variant="light"
                color="violet"
                size="sm"
                loading={uploading}
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
              >
                <IconUpload size={14} />
              </ActionIcon>
            </div>
          </div>

          {/* Upload drop zone */}
          <div
            className="task-drawer-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              const files = e.dataTransfer?.files;
              if (files && files.length > 0) handleFileUpload(Array.from(files));
            }}
          >
            {uploading ? (
              <Group gap="xs" justify="center">
                <Loader size="xs" color="violet" />
                <Text size="xs" c="dimmed">Enviando...</Text>
              </Group>
            ) : (
              <Group gap="xs" justify="center">
                <IconUpload size={16} color="var(--text-muted)" />
                <Text size="xs" c="dimmed">Arraste arquivos ou clique para anexar</Text>
              </Group>
            )}
          </div>

          {/* Image thumbnails */}
          {imageAttachments.length > 0 && (
            <div className="task-drawer-image-grid">
              {imageAttachments.map((att) => (
                <div key={att.id} className="task-drawer-image-item">
                  <img
                    src={att.file_url}
                    alt={att.file_name || 'Imagem'}
                    onClick={() => handleImageClick(att.file_url)}
                  />
                  <ActionIcon
                    className="task-drawer-image-delete"
                    variant="filled"
                    color="dark"
                    size="xs"
                    radius="xl"
                    onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(att); }}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                </div>
              ))}
            </div>
          )}

          {/* File list (non-image) */}
          {fileAttachments.length > 0 && (
            <Stack gap={4} mt="xs">
              {fileAttachments.map((att) => (
                <div key={att.id} className="task-drawer-file-item">
                  <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <IconFile size={16} color="var(--accent-violet)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={500} c="var(--text-primary)" truncate>{att.file_name || 'Arquivo'}</Text>
                      <Text size="xs" c="dimmed">{formatFileSize(att.file_size)}</Text>
                    </div>
                  </Group>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" color="gray" size="xs" component="a" href={att.file_url} target="_blank" title="Baixar">
                      <IconDownload size={12} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="xs" onClick={() => handleDeleteAttachment(att)} title="Remover">
                      <IconX size={12} />
                    </ActionIcon>
                  </Group>
                </div>
              ))}
            </Stack>
          )}
        </div>

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
