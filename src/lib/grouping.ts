import type {
  Column,
  CustomField,
  GroupBy,
  Profile,
  RollupConfig,
  Tag,
  Task,
  ViewFilters,
} from './types';
import { PRIORITIES } from './types';
import { displayName, dueState, isSameDay } from './utils';

export interface TaskGroup {
  key: string;
  label: string;
  color: string;
  /** for status groups, the backing column id (drop target) */
  columnId?: string;
  tasks: Task[];
}

export function applyFilters(
  tasks: Task[],
  filters: ViewFilters | undefined,
  columnsById: Map<string, Column>,
): Task[] {
  if (!filters) return tasks.filter((t) => !t.archived);
  return tasks.filter((t) => {
    if (t.archived && !filters.includeArchived) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    if (filters.statuses?.length && (!t.column_id || !filters.statuses.includes(t.column_id))) return false;
    if (filters.priorities?.length && !filters.priorities.includes(t.priority)) return false;
    if (filters.assignees?.length && !filters.assignees.some((a) => t.assignees.includes(a))) return false;
    if (filters.tagIds?.length && !filters.tagIds.some((id) => t.tag_ids.includes(id))) return false;
    if (filters.due && filters.due !== 'any') {
      const state = dueState(t);
      if (filters.due === 'overdue' && state !== 'overdue') return false;
      if (filters.due === 'today' && state !== 'today') return false;
      if (filters.due === 'none' && t.due_date) return false;
      if (filters.due === 'week') {
        if (!t.due_date) return false;
        const due = new Date(t.due_date).getTime();
        const weekOut = Date.now() + 7 * 86_400_000;
        if (due > weekOut) return false;
      }
    }
    void columnsById;
    return true;
  });
}

export function sortTasks(
  tasks: Task[],
  sortBy: 'position' | 'due_date' | 'priority' | 'title' | 'created_at' = 'position',
  dir: 'asc' | 'desc' = 'asc',
): Task[] {
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 };
  const sorted = [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'due_date': {
        const av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return av - bv;
      }
      case 'priority':
        return priorityRank[a.priority] - priorityRank[b.priority];
      case 'title':
        return a.title.localeCompare(b.title);
      case 'created_at':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      default:
        return a.position - b.position;
    }
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export function groupTasks(
  tasks: Task[],
  groupBy: GroupBy,
  ctx: {
    columns: Column[];
    tags: Tag[];
    fields: CustomField[];
    profiles: Map<string, Profile>;
  },
): TaskGroup[] {
  if (groupBy === 'status') {
    const groups: TaskGroup[] = ctx.columns
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ key: c.id, label: c.name, color: c.color, columnId: c.id, tasks: [] }));
    const noStatus: TaskGroup = { key: '__none', label: 'No status', color: '#87909e', tasks: [] };
    const byId = new Map(groups.map((g) => [g.key, g]));
    for (const t of tasks) {
      (t.column_id && byId.get(t.column_id) ? byId.get(t.column_id)! : noStatus).tasks.push(t);
    }
    if (noStatus.tasks.length) groups.push(noStatus);
    return groups;
  }

  if (groupBy === 'priority') {
    const groups = PRIORITIES.map((p) => ({ key: p.value, label: p.label, color: p.color, tasks: [] as Task[] }));
    const byKey = new Map(groups.map((g) => [g.key, g]));
    for (const t of tasks) byKey.get(t.priority)?.tasks.push(t);
    return groups.filter((g) => g.tasks.length > 0 || g.key !== 'none');
  }

  if (groupBy === 'assignee') {
    const groups = new Map<string, TaskGroup>();
    const unassigned: TaskGroup = { key: '__none', label: 'Unassigned', color: '#87909e', tasks: [] };
    for (const t of tasks) {
      if (t.assignees.length === 0) {
        unassigned.tasks.push(t);
        continue;
      }
      for (const uid of t.assignees) {
        if (!groups.has(uid)) {
          groups.set(uid, {
            key: uid,
            label: displayName(ctx.profiles.get(uid)),
            color: '#7b68ee',
            tasks: [],
          });
        }
        groups.get(uid)!.tasks.push(t);
      }
    }
    const out = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (unassigned.tasks.length) out.push(unassigned);
    return out;
  }

  if (groupBy === 'due_date') {
    const buckets: TaskGroup[] = [
      { key: 'overdue', label: 'Overdue', color: '#e0413e', tasks: [] },
      { key: 'today', label: 'Today', color: '#f8ae00', tasks: [] },
      { key: 'week', label: 'Next 7 days', color: '#4f9bff', tasks: [] },
      { key: 'later', label: 'Later', color: '#00b884', tasks: [] },
      { key: 'none', label: 'No due date', color: '#87909e', tasks: [] },
    ];
    const now = new Date();
    for (const t of tasks) {
      if (!t.due_date) {
        buckets[4].tasks.push(t);
        continue;
      }
      const due = new Date(t.due_date);
      if (isSameDay(due, now)) buckets[1].tasks.push(t);
      else if (due.getTime() < now.getTime()) buckets[0].tasks.push(t);
      else if (due.getTime() < now.getTime() + 7 * 86_400_000) buckets[2].tasks.push(t);
      else buckets[3].tasks.push(t);
    }
    return buckets.filter((b) => b.tasks.length > 0);
  }

  if (groupBy === 'tag') {
    const groups = new Map<string, TaskGroup>();
    const untagged: TaskGroup = { key: '__none', label: 'No tags', color: '#87909e', tasks: [] };
    for (const t of tasks) {
      if (t.tag_ids.length === 0) {
        untagged.tasks.push(t);
        continue;
      }
      for (const tagId of t.tag_ids) {
        const tag = ctx.tags.find((x) => x.id === tagId);
        if (!tag) continue;
        if (!groups.has(tagId)) groups.set(tagId, { key: tagId, label: tag.name, color: tag.color, tasks: [] });
        groups.get(tagId)!.tasks.push(t);
      }
    }
    const out = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (untagged.tasks.length) out.push(untagged);
    return out;
  }

  if (groupBy.startsWith('field:')) {
    const fieldId = groupBy.slice('field:'.length);
    const field = ctx.fields.find((f) => f.id === fieldId);
    const groups = new Map<string, TaskGroup>();
    const empty: TaskGroup = { key: '__none', label: `No ${field?.name ?? 'value'}`, color: '#87909e', tasks: [] };
    for (const t of tasks) {
      const value = t.custom_values[fieldId];
      if (value === undefined || value === null || value === '') {
        empty.tasks.push(t);
        continue;
      }
      const key = String(value);
      if (!groups.has(key)) {
        const optColor = field?.options.find((o) => o.label === key)?.color ?? '#7b68ee';
        groups.set(key, { key, label: key, color: optColor, tasks: [] });
      }
      groups.get(key)!.tasks.push(t);
    }
    const out = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (empty.tasks.length) out.push(empty);
    return out;
  }

  return [{ key: 'all', label: 'All tasks', color: '#7b68ee', tasks }];
}

/** Notion-style rollup/aggregation over a set of tasks. */
export function computeRollup(tasks: Task[], rollup: RollupConfig, fields: CustomField[]): string {
  switch (rollup.op) {
    case 'count':
      return String(tasks.length);
    case 'count_done':
      return String(tasks.filter((t) => t.completed_at).length);
    case 'percent_done': {
      if (tasks.length === 0) return '0%';
      return `${Math.round((tasks.filter((t) => t.completed_at).length / tasks.length) * 100)}%`;
    }
    case 'sum':
    case 'avg':
    case 'min':
    case 'max': {
      const field = fields.find((f) => f.id === rollup.fieldId);
      if (!field) return '—';
      const values = tasks
        .map((t) => Number(t.custom_values[field.id]))
        .filter((v) => Number.isFinite(v));
      if (values.length === 0) return '—';
      const result =
        rollup.op === 'sum'
          ? values.reduce((a, b) => a + b, 0)
          : rollup.op === 'avg'
            ? values.reduce((a, b) => a + b, 0) / values.length
            : rollup.op === 'min'
              ? Math.min(...values)
              : Math.max(...values);
      return Number.isInteger(result) ? String(result) : result.toFixed(2);
    }
    default:
      return '—';
  }
}

export function rollupLabel(rollup: RollupConfig, fields: CustomField[]): string {
  if (rollup.label) return rollup.label;
  const fieldName = fields.find((f) => f.id === rollup.fieldId)?.name ?? '';
  switch (rollup.op) {
    case 'count':
      return 'Tasks';
    case 'count_done':
      return 'Done';
    case 'percent_done':
      return '% Done';
    default:
      return `${rollup.op}(${fieldName})`;
  }
}
