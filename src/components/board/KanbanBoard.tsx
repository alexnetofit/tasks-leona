import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, TextInput, ColorInput, Modal, ActionIcon, Menu, Badge, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconDots, IconPencil, IconTrash, IconFilter, IconSearch, IconSettings, IconX,
} from '@tabler/icons-react';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/contexts/AuthContext';
import * as boardService from '@/services/boardService';
import * as taskService from '@/services/taskService';
import { getTaskTypes } from '@/services/taskTypeService';
import { getActiveMembers } from '@/services/memberService';
import type { Board, BoardColumn, Task, Profile, TaskType, TaskFilters } from '@/types';
import { DEFAULT_FILTERS } from '@/types';
import TaskCard from './TaskCard';
import FilterDrawer from './FilterDrawer';
import TaskDrawer from '../task/TaskDrawer';
import TaskTypeManager from '../shared/TaskTypeManager';
import dayjs from 'dayjs';

const FILTERS_KEY = 'leona_projetos_filters';

function loadFilters(): TaskFilters {
  try {
    const raw = sessionStorage.getItem(FILTERS_KEY);
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_FILTERS };
}

function saveFilters(filters: TaskFilters) {
  try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); } catch {}
}

/** Sortable Task Card wrapper */
function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task', task } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}

export default function KanbanBoard() {
  const { user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros (persistidos na sessão)
  const [filters, setFilters] = useState<TaskFilters>(loadFilters);
  const [filterDrawerOpened, { open: openFilterDrawer, close: closeFilterDrawer }] = useDisclosure();

  // Task type manager
  const [typeManagerOpened, { open: openTypeManager, close: closeTypeManager }] = useDisclosure();

  // Column modal
  const [columnModalOpened, { open: openColumnModal, close: closeColumnModal }] = useDisclosure();
  const [editingColumn, setEditingColumn] = useState<BoardColumn | null>(null);
  const [columnTitle, setColumnTitle] = useState('');
  const [columnColor, setColumnColor] = useState('#7c3aed');

  // Task drawer
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure();

  // Drag state
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Persist filters
  useEffect(() => { saveFilters(filters); }, [filters]);

  const handleFiltersChange = (newFilters: TaskFilters) => {
    setFilters(newFilters);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let boards = await boardService.getBoards();
      let currentBoard: Board;

      if (boards.length === 0) {
        currentBoard = await boardService.createBoard({
          title: 'Projeto Principal',
          description: 'Board principal da equipe',
          icon: '🚀',
          created_by: user?.id,
        });
        const defaultColumns = [
          { title: 'Ideias', color: '#6366f1', position: 0 },
          { title: 'A fazer', color: '#f59e0b', position: 1 },
          { title: 'Em andamento', color: '#3b82f6', position: 2 },
          { title: 'Revisão', color: '#8b5cf6', position: 3 },
          { title: 'Concluído', color: '#22c55e', position: 4 },
        ];
        for (const col of defaultColumns) {
          await boardService.createColumn({ ...col, board_id: currentBoard.id });
        }
      } else {
        currentBoard = boards[0];
      }

      setBoard(currentBoard);

      const [cols, tsks, mems, types] = await Promise.all([
        boardService.getColumns(currentBoard.id),
        taskService.getTasks(currentBoard.id),
        getActiveMembers(),
        getTaskTypes(),
      ]);

      setColumns(cols);
      setTasks(tsks);
      setMembers(mems);
      setTaskTypes(types);
    } catch (err) {
      console.error('[KanbanBoard] Erro:', err);
      notifications.show({ title: 'Erro', message: 'Erro ao carregar o board', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtrar tarefas
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      // Assigned
      if (filters.assignedTo && task.assigned_to !== filters.assignedTo) return false;
      // Priority
      if (filters.priority && task.priority !== filters.priority) return false;
      // Task type
      if (filters.taskType && task.task_type !== filters.taskType) return false;
      // Date range (created_at)
      if (filters.dateFrom && dayjs(task.created_at).isBefore(dayjs(filters.dateFrom), 'day')) return false;
      if (filters.dateTo && dayjs(task.created_at).isAfter(dayjs(filters.dateTo), 'day')) return false;
      return true;
    });
  }, [tasks, filters]);

  const activeFilterCount = [filters.assignedTo, filters.priority, filters.taskType, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  // Column CRUD
  const handleSaveColumn = async () => {
    if (!columnTitle.trim() || !board) return;
    try {
      if (editingColumn) {
        await boardService.updateColumn(editingColumn.id, { title: columnTitle, color: columnColor });
      } else {
        await boardService.createColumn({ board_id: board.id, title: columnTitle, color: columnColor, position: columns.length });
      }
      await loadData();
      closeColumnModal();
      setEditingColumn(null);
      setColumnTitle('');
      setColumnColor('#7c3aed');
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao salvar coluna', color: 'red' });
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    try {
      await boardService.deleteColumn(colId);
      await loadData();
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao excluir coluna', color: 'red' });
    }
  };

  const handleAddTask = async (columnId: string) => {
    if (!board) return;
    try {
      const colTasks = tasks.filter((t) => t.column_id === columnId);
      const newTask = await taskService.createTask({
        board_id: board.id,
        column_id: columnId,
        title: 'Nova tarefa',
        position: colTasks.length,
        created_by: user?.id,
      });
      setTasks((prev) => [...prev, newTask]);
      setSelectedTask(newTask);
      openDrawer();
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao criar tarefa', color: 'red' });
    }
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const at = tasks.find((t) => t.id === activeId);
    if (!at) return;

    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn && at.column_id !== overColumn.id) {
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, column_id: overColumn.id } : t));
      return;
    }
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && at.column_id !== overTask.column_id) {
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, column_id: overTask.column_id } : t));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const at = tasks.find((t) => t.id === activeId);
    if (!at) return;

    let targetColumnId = at.column_id;
    const overColumn = columns.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t.id === overId);
    if (overColumn) targetColumnId = overColumn.id;
    else if (overTask) targetColumnId = overTask.column_id;

    const columnTasks = tasks.filter((t) => t.column_id === targetColumnId).sort((a, b) => a.position - b.position);
    const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
    const newIndex = overTask ? columnTasks.findIndex((t) => t.id === overId) : columnTasks.length;

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(columnTasks, oldIndex, newIndex);
      const updates = reordered.map((t, i) => ({ id: t.id, position: i, column_id: targetColumnId! }));
      setTasks((prev) => {
        const other = prev.filter((t) => t.column_id !== targetColumnId);
        return [...other, ...reordered.map((t, i) => ({ ...t, position: i, column_id: targetColumnId! }))];
      });
      try { await taskService.reorderTasks(updates); } catch (err) { console.error('[Kanban] reorder err:', err); }
    } else if (targetColumnId !== active.data?.current?.task?.column_id) {
      try { await taskService.moveTask(activeId, targetColumnId!, 0); } catch (err) { console.error('[Kanban] move err:', err); }
    }
  };

  const handleTaskUpdate = async () => {
    if (board) {
      const [tsks, types] = await Promise.all([taskService.getTasks(board.id), getTaskTypes()]);
      setTasks(tsks);
      setTaskTypes(types);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Carregando board...</div></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="kanban-header">
        <div className="kanban-header-left">
          <span className="kanban-header-icon">{board?.icon || '📋'}</span>
          <div>
            <h1 className="kanban-header-title">{board?.title || 'Board'}</h1>
            {board?.description && <p className="kanban-header-desc">{board.description}</p>}
          </div>
        </div>
        <Group gap="xs">
          <Button leftSection={<IconSettings size={14} />} size="xs" variant="subtle" color="gray" onClick={openTypeManager}>
            Tipos
          </Button>
          <Button leftSection={<IconPlus size={16} />} size="sm" variant="light" color="violet"
            onClick={() => { setEditingColumn(null); setColumnTitle(''); setColumnColor('#7c3aed'); openColumnModal(); }}>
            Nova coluna
          </Button>
        </Group>
      </div>

      {/* Search + Filter Bar */}
      <div className="kanban-filters">
        <TextInput
          placeholder="Buscar tarefas..."
          leftSection={<IconSearch size={16} />}
          value={filters.search}
          onChange={(e) => handleFiltersChange({ ...filters, search: e.currentTarget.value })}
          size="xs"
          style={{ flex: 1, maxWidth: 320 }}
          rightSection={filters.search ? (
            <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => handleFiltersChange({ ...filters, search: '' })}>
              <IconX size={12} />
            </ActionIcon>
          ) : undefined}
          styles={{ input: { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' } }}
        />
        <ActionIcon
          variant={activeFilterCount > 0 ? 'filled' : 'subtle'}
          color={activeFilterCount > 0 ? 'violet' : 'gray'}
          size="lg"
          onClick={openFilterDrawer}
          title="Filtros"
          style={{ position: 'relative' }}
        >
          <IconFilter size={18} />
          {activeFilterCount > 0 && (
            <Badge size="xs" variant="filled" color="red" circle
              style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, fontSize: 10, padding: 0 }}>
              {activeFilterCount}
            </Badge>
          )}
        </ActionIcon>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="kanban-container">
          {columns.map((col) => {
            const colTasks = filteredTasks
              .filter((t) => t.column_id === col.id)
              .sort((a, b) => a.position - b.position);

            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title-group">
                    <div className="kanban-column-dot" style={{ backgroundColor: col.color }} />
                    <span className="kanban-column-title">{col.title}</span>
                    <span className="kanban-column-count">{colTasks.length}</span>
                  </div>
                  <Menu shadow="md" width={160}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />}
                        onClick={() => { setEditingColumn(col); setColumnTitle(col.title); setColumnColor(col.color); openColumnModal(); }}>
                        Editar
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDeleteColumn(col.id)}>
                        Excluir
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </div>

                <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy} id={col.id}>
                  <div className="kanban-column-body" id={col.id}>
                    {colTasks.map((task) => (
                      <SortableTaskCard key={task.id} task={task}
                        onClick={() => { setSelectedTask(task); openDrawer(); }} />
                    ))}
                  </div>
                </SortableContext>

                <button className="kanban-add-task" onClick={() => handleAddTask(col.id)}>
                  <IconPlus size={14} /> Adicionar tarefa
                </button>
              </div>
            );
          })}

          <button className="kanban-add-column"
            onClick={() => { setEditingColumn(null); setColumnTitle(''); setColumnColor('#7c3aed'); openColumnModal(); }}>
            <IconPlus size={16} /> Nova coluna
          </button>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Column Modal */}
      <Modal opened={columnModalOpened} onClose={closeColumnModal}
        title={editingColumn ? 'Editar Coluna' : 'Nova Coluna'} size="sm">
        <TextInput label="Nome da coluna" placeholder="Ex: Em andamento" value={columnTitle}
          onChange={(e) => setColumnTitle(e.currentTarget.value)} mb="md" />
        <ColorInput label="Cor" value={columnColor} onChange={setColumnColor} format="hex"
          swatches={['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']}
          mb="lg" />
        <Button fullWidth onClick={handleSaveColumn} color="violet">
          {editingColumn ? 'Salvar' : 'Criar Coluna'}
        </Button>
      </Modal>

      {/* Task Drawer */}
      <TaskDrawer task={selectedTask} opened={drawerOpened}
        onClose={() => { closeDrawer(); setSelectedTask(null); }}
        onUpdate={handleTaskUpdate} members={members} columns={columns}
        boardId={board?.id || ''} taskTypes={taskTypes} />

      {/* Filter Drawer */}
      <FilterDrawer opened={filterDrawerOpened} onClose={closeFilterDrawer}
        filters={filters} onFiltersChange={handleFiltersChange}
        members={members} taskTypes={taskTypes} />

      {/* Task Type Manager */}
      <TaskTypeManager opened={typeManagerOpened} onClose={closeTypeManager} onUpdate={handleTaskUpdate} />
    </>
  );
}
