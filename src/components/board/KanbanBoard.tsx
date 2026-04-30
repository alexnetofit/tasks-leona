import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, TextInput, ColorInput, Modal, ActionIcon, Menu, Badge, Group, Switch, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconDots, IconPencil, IconTrash, IconFilter, IconSearch, IconX,
  IconSettings, IconEye, IconEyeOff, IconArrowsSort, IconTag, IconGripVertical,
} from '@tabler/icons-react';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
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
const HIDDEN_COLS_KEY = 'leona_projetos_hidden_cols';

function loadFilters(): TaskFilters {
  try { const r = sessionStorage.getItem(FILTERS_KEY); if (r) return { ...DEFAULT_FILTERS, ...JSON.parse(r) }; } catch {}
  return { ...DEFAULT_FILTERS };
}
function saveFilters(f: TaskFilters) { try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(f)); } catch {} }
function loadHiddenCols(): string[] {
  try { const r = sessionStorage.getItem(HIDDEN_COLS_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveHiddenCols(ids: string[]) { try { sessionStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(ids)); } catch {} }

/** Sortable Task Card wrapper
 *
 * Estratégia: o drag handle (ícone ≡) recebe os listeners do dnd-kit; o
 * restante do card fica livre para tap/click (abrir drawer). Isso separa
 * claramente "arrastar" de "tocar" — especialmente importante no mobile,
 * onde long-press do card inteiro confundia com scroll.
 */
function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task', task, columnId: task.column_id } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="sortable-task-wrapper">
      <button
        type="button"
        className="task-card-drag-handle"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical size={16} />
      </button>
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}

/** Droppable Column wrapper — registra a coluna como drop target */
function DroppableColumn({ columnId, children }: { columnId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${columnId}`,
    data: { type: 'column', columnId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`kanban-column-body${isOver ? ' is-over' : ''}`}
      style={{ minHeight: 60 }}
    >
      {children}
    </div>
  );
}

export default function KanbanBoard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<TaskFilters>(loadFilters);
  const [filterDrawerOpened, { open: openFilterDrawer, close: closeFilterDrawer }] = useDisclosure();

  // Hidden columns
  const [hiddenCols, setHiddenCols] = useState<string[]>(loadHiddenCols);

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

  // Ref com tasks sempre atualizada — usada dentro dos handlers de DnD
  // para evitar ler state stale do closure (bug do "card volta ao recarregar").
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Drag é iniciado só pelo handle (ícone ≡ do card), então distance pequeno
  // basta: mouse ou touch precisam mover 5px para começar arrasto, o que
  // diferencia de toques acidentais sem prejudicar o gesto.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Persist filters & hidden cols
  useEffect(() => { saveFilters(filters); }, [filters]);
  useEffect(() => { saveHiddenCols(hiddenCols); }, [hiddenCols]);

  const toggleColumnVisibility = (colId: string) => {
    setHiddenCols((prev) => prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let boards = await boardService.getBoards();
      let currentBoard: Board;
      if (boards.length === 0) {
        currentBoard = await boardService.createBoard({ title: 'Projeto Principal', description: 'Board principal da equipe', icon: '🚀', created_by: user?.id });
        const defaultColumns = [
          { title: 'Ideias', color: '#6366f1', position: 0 },
          { title: 'A fazer', color: '#f59e0b', position: 1 },
          { title: 'Em andamento', color: '#3b82f6', position: 2 },
          { title: 'Revisão', color: '#8b5cf6', position: 3 },
          { title: 'Concluído', color: '#22c55e', position: 4 },
        ];
        for (const col of defaultColumns) await boardService.createColumn({ ...col, board_id: currentBoard.id });
      } else { currentBoard = boards[0]; }
      setBoard(currentBoard);
      const [cols, tsks, mems, types] = await Promise.all([
        boardService.getColumns(currentBoard.id), taskService.getTasks(currentBoard.id),
        getActiveMembers(), getTaskTypes(),
      ]);
      setColumns(cols); setTasks(tsks); setMembers(mems); setTaskTypes(types);
    } catch (err) {
      console.error('[KanbanBoard] Erro:', err);
      notifications.show({ title: 'Erro', message: 'Erro ao carregar o board', color: 'red' });
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Deep-link: abrir tarefa via ?task=<id>
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.length > 0 && !drawerOpened) {
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        setSelectedTask(found);
        openDrawer();
        // Limpar o param da URL sem recarregar
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, tasks, drawerOpened]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      if (filters.assignedTo && task.assigned_to !== filters.assignedTo) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.taskType && task.task_type !== filters.taskType) return false;
      if (filters.dateFrom && dayjs(task.created_at).isBefore(dayjs(filters.dateFrom), 'day')) return false;
      if (filters.dateTo && dayjs(task.created_at).isAfter(dayjs(filters.dateTo), 'day')) return false;
      return true;
    });
  }, [tasks, filters]);

  const activeFilterCount = [filters.assignedTo, filters.priority, filters.taskType, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const visibleColumns = columns.filter((c) => !hiddenCols.includes(c.id));

  // --- Helpers para extrair columnId de um droppable/sortable ---
  const resolveColumnId = (id: string): string | null => {
    if (typeof id === 'string' && id.startsWith('column-')) {
      return id.replace('column-', '');
    }
    const task = tasksRef.current.find((t) => t.id === id);
    if (task) return task.column_id;
    const col = columns.find((c) => c.id === id);
    if (col) return col.id;
    return null;
  };

  // Column CRUD
  const handleSaveColumn = async () => {
    if (!columnTitle.trim() || !board) return;
    try {
      if (editingColumn) {
        await boardService.updateColumn(editingColumn.id, { title: columnTitle, color: columnColor });
      } else {
        await boardService.createColumn({ board_id: board.id, title: columnTitle, color: columnColor, position: columns.length });
      }
      await loadData(); closeColumnModal(); setEditingColumn(null); setColumnTitle(''); setColumnColor('#7c3aed');
    } catch { notifications.show({ title: 'Erro', message: 'Erro ao salvar coluna', color: 'red' }); }
  };

  const handleDeleteColumn = async (colId: string) => {
    try { await boardService.deleteColumn(colId); await loadData(); } catch { notifications.show({ title: 'Erro', message: 'Erro ao excluir coluna', color: 'red' }); }
  };

  const handleAddTask = async (columnId: string) => {
    if (!board) return;
    try {
      const colTasks = tasks.filter((t) => t.column_id === columnId);
      const newTask = await taskService.createTask({ board_id: board.id, column_id: columnId, title: 'Nova tarefa', position: colTasks.length, created_by: user?.id });
      setTasks((prev) => [...prev, newTask]); setSelectedTask(newTask); openDrawer();
    } catch { notifications.show({ title: 'Erro', message: 'Erro ao criar tarefa', color: 'red' }); }
  };

  // ======================================================
  // DnD Handlers — Reescritos para suportar cross-column
  // ======================================================

  const handleDragStart = (event: DragStartEvent) => {
    const t = tasks.find((t) => t.id === event.active.id);
    if (t) setActiveTask(t);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determinar a coluna de origem e destino
    const activeColumnId = active.data?.current?.columnId || tasks.find((t) => t.id === activeId)?.column_id;
    const overColumnId = resolveColumnId(overId);

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) return;

    // Mover o card visualmente para a nova coluna (state local)
    setTasks((prev) => {
      const activeTaskData = prev.find((t) => t.id === activeId);
      if (!activeTaskData) return prev;

      // Remover da coluna de origem e calcular novas posições
      const sourceTasks = prev.filter((t) => t.column_id === activeColumnId && t.id !== activeId);
      const destTasks = prev.filter((t) => t.column_id === overColumnId);

      // Encontrar a posição de inserção no destino
      const overTask = prev.find((t) => t.id === overId);
      let insertIndex = destTasks.length; // padrão: final da coluna
      if (overTask && overTask.column_id === overColumnId) {
        insertIndex = destTasks.findIndex((t) => t.id === overId);
        if (insertIndex < 0) insertIndex = destTasks.length;
      }

      // Inserir na posição correta
      const newDestTasks = [...destTasks];
      newDestTasks.splice(insertIndex, 0, { ...activeTaskData, column_id: overColumnId });

      // Recalcular positions para source e dest
      const updatedSource = sourceTasks.map((t, i) => ({ ...t, position: i }));
      const updatedDest = newDestTasks.map((t, i) => ({ ...t, position: i }));

      // Reconstruir a lista completa
      const otherTasks = prev.filter((t) => t.column_id !== activeColumnId && t.column_id !== overColumnId);
      return [...otherTasks, ...updatedSource, ...updatedDest];
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // IMPORTANTE: usar tasksRef.current (sempre atualizado) ao invés de `tasks`
    // do closure, que pode estar stale após setTasks em handleDragOver.
    const currentTasks = tasksRef.current;

    const originalColumnId = (active.data?.current as any)?.columnId as string | undefined;
    const targetColumnId = resolveColumnId(overId);
    if (!targetColumnId) return;

    const activeTaskData = currentTasks.find((t) => t.id === activeId);
    if (!activeTaskData) return;

    // Construímos a coluna de destino do zero, sem a task ativa, e então
    // inserimos a task ativa na posição correta. Isso torna o handler
    // idempotente: funciona tanto se o state já tiver sido atualizado pelo
    // handleDragOver quanto se ainda estiver com a task na coluna original.
    const destWithoutActive = currentTasks
      .filter((t) => t.column_id === targetColumnId && t.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let insertIndex = destWithoutActive.length;
    if (overId !== `column-${targetColumnId}`) {
      const overIdx = destWithoutActive.findIndex((t) => t.id === overId);
      if (overIdx !== -1) insertIndex = overIdx;
    }

    const finalDest = [...destWithoutActive];
    finalDest.splice(insertIndex, 0, { ...activeTaskData, column_id: targetColumnId });

    const destWithPositions = finalDest.map((t, i) => ({
      ...t,
      position: i,
      column_id: targetColumnId,
    }));

    // Se foi movimentação cross-column, recalcular source também.
    const sourceWithPositions =
      originalColumnId && originalColumnId !== targetColumnId
        ? currentTasks
            .filter((t) => t.column_id === originalColumnId && t.id !== activeId)
            .sort((a, b) => a.position - b.position)
            .map((t, i) => ({ ...t, position: i, column_id: originalColumnId }))
        : [];

    // Atualiza state local de forma consistente (garante que nada fique "pulando").
    setTasks((prev) => {
      const affectedColumns = new Set<string>([targetColumnId]);
      if (originalColumnId) affectedColumns.add(originalColumnId);
      const untouched = prev.filter((t) => !t.column_id || !affectedColumns.has(t.column_id));
      return [...untouched, ...sourceWithPositions, ...destWithPositions];
    });

    // Persistir no backend.
    const updates = [
      ...destWithPositions.map((t) => ({
        id: t.id,
        position: t.position,
        column_id: targetColumnId,
      })),
      ...sourceWithPositions.map((t) => ({
        id: t.id,
        position: t.position,
        column_id: originalColumnId as string,
      })),
    ];

    if (updates.length === 0) return;

    try {
      await taskService.reorderTasks(updates);
    } catch (err) {
      console.error('[KanbanBoard] Erro ao persistir movimentação:', err);
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível salvar a movimentação. Recarregando...',
        color: 'red',
      });
      // Recarregar para garantir consistência com o banco
      await loadData();
    }
  };

  const handleTaskUpdate = async () => {
    if (!board) return;
    const [tsks, types] = await Promise.all([taskService.getTasks(board.id), getTaskTypes()]);
    setTasks(tsks);
    setTaskTypes(types);
    // Mantém a task aberta no drawer sincronizada (anexos, comentários etc aparecem em tempo real)
    setSelectedTask((prev) => (prev ? tsks.find((t) => t.id === prev.id) || null : null));
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Carregando board...</div></div>
    </div>;
  }

  return (
    <>
      {/* Board Toolbar — tudo em UMA linha */}
      <div className="board-toolbar">
        <div className="board-toolbar-left">
          <span className="board-toolbar-icon">{board?.icon || '📋'}</span>
          <h1 className="board-toolbar-title">{board?.title || 'Board'}</h1>
        </div>

        <div className="board-toolbar-center">
          <TextInput
            placeholder="Buscar tarefas..."
            leftSection={<IconSearch size={15} />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.currentTarget.value })}
            size="xs"
            className="board-search"
            rightSection={filters.search ? (
              <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => setFilters({ ...filters, search: '' })}>
                <IconX size={12} />
              </ActionIcon>
            ) : undefined}
          />
        </div>

        <div className="board-toolbar-right">
          {/* Filter button */}
          <ActionIcon
            variant={activeFilterCount > 0 ? 'filled' : 'subtle'}
            color={activeFilterCount > 0 ? 'violet' : 'gray'}
            size="md"
            onClick={openFilterDrawer}
            title="Filtros"
            className="board-toolbar-btn"
          >
            <IconFilter size={16} />
            {activeFilterCount > 0 && (
              <Badge size="xs" variant="filled" color="red" circle
                style={{ position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, fontSize: 9, padding: 0 }}>
                {activeFilterCount}
              </Badge>
            )}
          </ActionIcon>

          {/* Add column */}
          <ActionIcon variant="subtle" color="gray" size="md" title="Nova coluna" className="board-toolbar-btn"
            onClick={() => { setEditingColumn(null); setColumnTitle(''); setColumnColor('#7c3aed'); openColumnModal(); }}>
            <IconPlus size={16} />
          </ActionIcon>

          {/* Settings dropdown */}
          <Menu shadow="lg" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="md" className="board-toolbar-btn">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Configurações</Menu.Label>
              <Menu.Item leftSection={<IconTag size={14} />} onClick={openTypeManager}>
                Tipos de Tarefa
              </Menu.Item>
              <Menu.Item leftSection={<IconPlus size={14} />}
                onClick={() => { setEditingColumn(null); setColumnTitle(''); setColumnColor('#7c3aed'); openColumnModal(); }}>
                Nova Coluna
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Colunas visíveis</Menu.Label>
              {columns.map((col) => (
                <Menu.Item key={col.id} leftSection={
                  hiddenCols.includes(col.id) ? <IconEyeOff size={14} color="var(--text-muted)" /> : <IconEye size={14} color={col.color} />
                } onClick={() => toggleColumnVisibility(col.id)}>
                  <Group gap="xs">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
                    <Text size="sm" c={hiddenCols.includes(col.id) ? 'dimmed' : undefined}>{col.title}</Text>
                  </Group>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="kanban-scroll">
          {visibleColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.column_id === col.id).sort((a, b) => a.position - b.position);
            return (
              <div
                key={col.id}
                className="kanban-column"
                style={{ ['--col-color' as any]: col.color } as React.CSSProperties}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title-group">
                    <div className="kanban-column-dot" />
                    <span className="kanban-column-title">{col.title}</span>
                    <span className="kanban-column-count">{colTasks.length}</span>
                  </div>
                  <Menu shadow="md" width={180}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="xs" className="kanban-column-actions"><IconDots size={14} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />}
                        onClick={() => { setEditingColumn(col); setColumnTitle(col.title); setColumnColor(col.color); openColumnModal(); }}>
                        Editar
                      </Menu.Item>
                      <Menu.Item leftSection={<IconEyeOff size={14} />} onClick={() => toggleColumnVisibility(col.id)}>
                        Ocultar
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDeleteColumn(col.id)}>
                        Excluir
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </div>

                <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn columnId={col.id}>
                    {colTasks.map((task) => (
                      <SortableTaskCard key={task.id} task={task} onClick={() => { setSelectedTask(task); openDrawer(); }} />
                    ))}
                  </DroppableColumn>
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

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}</DragOverlay>
      </DndContext>

      {/* Column Modal */}
      <Modal opened={columnModalOpened} onClose={closeColumnModal} title={editingColumn ? 'Editar Coluna' : 'Nova Coluna'} size="sm">
        <TextInput label="Nome" placeholder="Ex: Em andamento" value={columnTitle} onChange={(e) => setColumnTitle(e.currentTarget.value)} mb="md" />
        <ColorInput label="Cor" value={columnColor} onChange={setColumnColor} format="hex"
          swatches={['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']} mb="lg" />
        <Button fullWidth onClick={handleSaveColumn} color="violet">{editingColumn ? 'Salvar' : 'Criar Coluna'}</Button>
      </Modal>

      {/* Task Drawer */}
      <TaskDrawer task={selectedTask} opened={drawerOpened} onClose={() => { closeDrawer(); setSelectedTask(null); }}
        onUpdate={handleTaskUpdate} members={members} columns={columns} boardId={board?.id || ''} taskTypes={taskTypes} />

      {/* Filter Drawer */}
      <FilterDrawer opened={filterDrawerOpened} onClose={closeFilterDrawer} filters={filters}
        onFiltersChange={setFilters} members={members} taskTypes={taskTypes} />

      {/* Task Type Manager */}
      <TaskTypeManager opened={typeManagerOpened} onClose={closeTypeManager} onUpdate={handleTaskUpdate} />
    </>
  );
}
