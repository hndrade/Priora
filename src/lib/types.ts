export type Priority = 'urgent' | 'high' | 'normal' | 'low' | 'none';
export type ColumnKind = 'todo' | 'in_progress' | 'done' | 'custom';
export type ViewType = 'board' | 'list' | 'table' | 'calendar';
export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'url';
export type RelationType = 'related' | 'blocks' | 'blocked_by' | 'duplicates' | 'parent' | 'subtask';
export type NotificationType = 'assigned' | 'comment' | 'due_soon' | 'mention';
export type GroupBy = 'status' | 'priority' | 'assignee' | 'due_date' | 'tag' | `field:${string}`;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  created_at: string;
}

export interface List {
  id: string;
  workspace_id: string;
  name: string;
  icon: string;
  color: string;
  position: number;
  archived: boolean;
  created_at: string;
}

export interface Column {
  id: string;
  list_id: string;
  workspace_id: string;
  name: string;
  color: string;
  kind: ColumnKind;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface SelectOption {
  label: string;
  color: string;
}

export interface CustomField {
  id: string;
  workspace_id: string;
  list_id: string | null;
  name: string;
  type: FieldType;
  options: SelectOption[];
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  list_id: string;
  column_id: string | null;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  start_date: string | null;
  assignees: string[];
  tag_ids: string[];
  custom_values: Record<string, unknown>;
  position: number;
  archived: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRelation {
  id: string;
  workspace_id: string;
  task_id: string;
  related_task_id: string;
  relation_type: RelationType;
  created_at: string;
}

export type RollupOp = 'count' | 'count_done' | 'percent_done' | 'sum' | 'avg' | 'min' | 'max';

export interface RollupConfig {
  op: RollupOp;
  fieldId?: string; // required for sum/avg/min/max over a number custom field
  label?: string;
}

export interface ViewFilters {
  statuses?: string[];
  priorities?: Priority[];
  assignees?: string[];
  tagIds?: string[];
  due?: 'overdue' | 'today' | 'week' | 'none' | 'any';
  search?: string;
  includeArchived?: boolean;
}

export interface ViewConfig {
  groupBy?: GroupBy;
  filters?: ViewFilters;
  sortBy?: 'position' | 'due_date' | 'priority' | 'title' | 'created_at';
  sortDir?: 'asc' | 'desc';
  rollups?: RollupConfig[];
  visibleFieldIds?: string[];
}

export interface View {
  id: string;
  workspace_id: string;
  list_id: string;
  name: string;
  type: ViewType;
  config: ViewConfig;
  position: number;
  created_at: string;
}

export interface TaskTemplatePayload {
  title: string;
  description?: string;
  priority?: Priority;
  tag_names?: string[];
  due_in_days?: number;
  custom_values?: Record<string, unknown>;
  subtasks?: { title: string; priority?: Priority }[];
}

export interface ListTemplatePayload {
  columns: { name: string; color: string; kind: ColumnKind }[];
  tasks: TaskTemplatePayload[];
}

export interface Template {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  type: 'task' | 'list';
  payload: TaskTemplatePayload | ListTemplatePayload;
  created_by: string | null;
  created_at: string;
}

export interface Doc {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  content: string;
  linked_task_ids: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  workspace_id: string | null;
  task_id: string | null;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;
}

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: '#e0413e' },
  { value: 'high', label: 'High', color: '#f8ae00' },
  { value: 'normal', label: 'Normal', color: '#4f9bff' },
  { value: 'low', label: 'Low', color: '#87909e' },
  { value: 'none', label: 'No priority', color: '#b9bec7' },
];

export const COLUMN_COLORS = ['#87909e', '#4f9bff', '#f8ae00', '#00b884', '#e0413e', '#7b68ee', '#ff7fab', '#00a8b5'];
