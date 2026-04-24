import { Drawer, Select, Button, Group, Stack, Text, Badge } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter, IconX } from '@tabler/icons-react';
import type { Profile, TaskType, TaskFilters, TaskPriority } from '@/types';
import { PRIORITY_CONFIG, DEFAULT_FILTERS } from '@/types';

interface FilterDrawerProps {
  opened: boolean;
  onClose: () => void;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  members: Profile[];
  taskTypes: TaskType[];
}

export default function FilterDrawer({ opened, onClose, filters, onFiltersChange, members, taskTypes }: FilterDrawerProps) {
  const updateFilter = (key: keyof TaskFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
  };

  const activeCount = [
    filters.assignedTo,
    filters.priority,
    filters.taskType,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFilter size={18} />
          <Text fw={600}>Filtros</Text>
          {activeCount > 0 && (
            <Badge size="sm" variant="filled" color="violet" circle>{activeCount}</Badge>
          )}
        </Group>
      }
      position="right"
      size="sm"
      styles={{
        content: { backgroundColor: 'var(--bg-surface)' },
        header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' },
      }}
    >
      <Stack gap="md" mt="sm">
        {/* Responsável */}
        <Select
          label="Responsável"
          placeholder="Todos"
          data={members.map((m) => ({ value: m.id, label: m.full_name }))}
          value={filters.assignedTo}
          onChange={(val) => updateFilter('assignedTo', val)}
          clearable
          searchable
          size="sm"
        />

        {/* Prioridade */}
        <Select
          label="Prioridade"
          placeholder="Todas"
          data={Object.entries(PRIORITY_CONFIG).map(([key, val]) => ({
            value: key,
            label: `${val.emoji} ${val.label}`,
          }))}
          value={filters.priority}
          onChange={(val) => updateFilter('priority', val)}
          clearable
          size="sm"
        />

        {/* Tipo de Tarefa */}
        <Select
          label="Tipo de Tarefa"
          placeholder="Todos"
          data={taskTypes.map((t) => ({ value: t.name, label: `${t.icon} ${t.name}` }))}
          value={filters.taskType}
          onChange={(val) => updateFilter('taskType', val)}
          clearable
          searchable
          size="sm"
        />

        {/* Período */}
        <Text size="sm" fw={500} c="var(--text-primary)">Período</Text>
        <Group grow>
          <DatePickerInput
            label="De"
            placeholder="Início"
            value={filters.dateFrom ? new Date(filters.dateFrom) : null}
            onChange={(val: any) => updateFilter('dateFrom', val ? new Date(val).toISOString() : null)}
            clearable
            size="sm"
            valueFormat="DD/MM/YYYY"
          />
          <DatePickerInput
            label="Até"
            placeholder="Fim"
            value={filters.dateTo ? new Date(filters.dateTo) : null}
            onChange={(val: any) => updateFilter('dateTo', val ? new Date(val).toISOString() : null)}
            clearable
            size="sm"
            valueFormat="DD/MM/YYYY"
          />
        </Group>

        {/* Presets de período */}
        <Group gap="xs">
          <Button
            variant="light" color="gray" size="xs"
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              updateFilter('dateFrom', today.toISOString());
              updateFilter('dateTo', new Date().toISOString());
            }}
          >
            Hoje
          </Button>
          <Button
            variant="light" color="gray" size="xs"
            onClick={() => {
              const from = new Date();
              from.setDate(from.getDate() - 7);
              from.setHours(0, 0, 0, 0);
              onFiltersChange({ ...filters, dateFrom: from.toISOString(), dateTo: new Date().toISOString() });
            }}
          >
            7 dias
          </Button>
          <Button
            variant="light" color="gray" size="xs"
            onClick={() => {
              const from = new Date();
              from.setDate(from.getDate() - 30);
              from.setHours(0, 0, 0, 0);
              onFiltersChange({ ...filters, dateFrom: from.toISOString(), dateTo: new Date().toISOString() });
            }}
          >
            30 dias
          </Button>
          <Button
            variant="light" color="gray" size="xs"
            onClick={() => {
              const from = new Date();
              from.setDate(1);
              from.setHours(0, 0, 0, 0);
              onFiltersChange({ ...filters, dateFrom: from.toISOString(), dateTo: new Date().toISOString() });
            }}
          >
            Este mês
          </Button>
        </Group>

        {/* Ações */}
        <Group justify="space-between" mt="md" pt="md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<IconX size={14} />}
            onClick={clearAll}
            disabled={activeCount === 0}
          >
            Limpar filtros
          </Button>
          <Button color="violet" size="sm" onClick={onClose}>
            Aplicar
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
