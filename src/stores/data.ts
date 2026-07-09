import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { pushOp } from '../lib/offline';
import { positionBetween, uuid } from '../lib/utils';
import type {
  Column,
  Comment,
  CustomField,
  Doc,
  List,
  ListTemplatePayload,
  Profile,
  Tag,
  Task,
  TaskRelation,
  TaskTemplatePayload,
  Template,
  View,
  ViewConfig,
  Workspace,
} from '../lib/types';
import { COLUMN_COLORS } from '../lib/types';

interface DataState {
  ready: boolean;
  offline: boolean;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  members: Profile[];
  lists: List[];
  columns: Column[];
  tasks: Task[];
  tags: Tag[];
  customFields: CustomField[];
  views: View[];
  templates: Template[];
  docs: Doc[];
  relations: TaskRelation[];
  comments: Record<string, Comment[]>;

  init: (userId: string) => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string, userId: string) => Promise<string>;
  inviteMember: (email: string) => Promise<string | null>;

  createList: (name: string, icon?: string, color?: string) => string;
  updateList: (id: string, patch: Partial<List>) => void;
  deleteList: (id: string) => void;

  createColumn: (listId: string, name: string, color?: string, kind?: Column['kind']) => string;
  updateColumn: (id: string, patch: Partial<Column>) => void;
  deleteColumn: (id: string) => void;

  createTask: (input: Partial<Task> & { list_id: string; title: string }) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, columnId: string | null, beforePos?: number, afterPos?: number) => void;
  toggleComplete: (id: string) => void;

  createTag: (name: string, color: string) => string;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  createField: (input: Omit<CustomField, 'id' | 'workspace_id' | 'created_at'>) => string;
  updateField: (id: string, patch: Partial<CustomField>) => void;
  deleteField: (id: string) => void;

  createView: (listId: string, name: string, type: View['type'], config?: ViewConfig) => string;
  updateView: (id: string, patch: Partial<View>) => void;
  deleteView: (id: string) => void;

  createTemplate: (input: Omit<Template, 'id' | 'workspace_id' | 'created_at'>) => string;
  deleteTemplate: (id: string) => void;
  applyTaskTemplate: (template: Template, listId: string, columnId: string | null) => string | null;
  applyListTemplate: (template: Template, name: string) => string | null;

  createDoc: (parentId?: string | null) => string;
  updateDoc: (id: string, patch: Partial<Doc>) => void;
  deleteDoc: (id: string) => void;

  addRelation: (taskId: string, relatedId: string, type: TaskRelation['relation_type']) => void;
  removeRelation: (id: string) => void;

  loadComments: (taskId: string) => Promise<void>;
  addComment: (taskId: string, body: string, authorId: string) => void;
  deleteComment: (taskId: string, commentId: string) => void;
}

const CACHE_KEY = 'priora-data-cache';
let channel: RealtimeChannel | null = null;
let cacheTimer: number | undefined;

type EntityKey =
  | 'lists'
  | 'columns'
  | 'tasks'
  | 'tags'
  | 'customFields'
  | 'views'
  | 'templates'
  | 'docs'
  | 'relations';

const TABLE_TO_KEY: Record<string, EntityKey> = {
  lists: 'lists',
  columns: 'columns',
  tasks: 'tasks',
  tags: 'tags',
  custom_fields: 'customFields',
  views: 'views',
  templates: 'templates',
  docs: 'docs',
  task_relations: 'relations',
};

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx === -1) return [...rows, row];
  const next = rows.slice();
  next[idx] = { ...next[idx], ...row };
  return next;
}

export const useData = create<DataState>((set, get) => {
  function persistCache() {
    window.clearTimeout(cacheTimer);
    cacheTimer = window.setTimeout(() => {
      const s = get();
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            workspaces: s.workspaces,
            currentWorkspaceId: s.currentWorkspaceId,
            members: s.members,
            lists: s.lists,
            columns: s.columns,
            tasks: s.tasks,
            tags: s.tags,
            customFields: s.customFields,
            views: s.views,
            templates: s.templates,
            docs: s.docs,
            relations: s.relations,
          }),
        );
      } catch {
        /* storage full — cache is best-effort */
      }
    }, 400);
  }

  function mutate(partial: Partial<DataState>) {
    set(partial);
    persistCache();
  }

  /** optimistic local upsert + queued remote write */
  function localInsert<T extends { id: string }>(key: EntityKey, table: string, row: T) {
    mutate({ [key]: upsert(get()[key] as unknown as T[], row) } as Partial<DataState>);
    void pushOp({ table, kind: 'insert', payload: row as unknown as Record<string, unknown> });
  }

  function localUpdate<T extends { id: string }>(key: EntityKey, table: string, id: string, patch: Partial<T>) {
    const rows = get()[key] as unknown as T[];
    mutate({ [key]: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } as Partial<DataState>);
    void pushOp({ table, kind: 'update', rowId: id, payload: patch as Record<string, unknown> });
  }

  function localDelete(key: EntityKey, table: string, id: string) {
    const rows = get()[key] as { id: string }[];
    mutate({ [key]: rows.filter((r) => r.id !== id) } as Partial<DataState>);
    void pushOp({ table, kind: 'delete', rowId: id });
  }

  function ws(): string {
    const id = get().currentWorkspaceId;
    if (!id) throw new Error('No workspace selected');
    return id;
  }

  function subscribeRealtime(workspaceId: string) {
    if (channel) void supabase.removeChannel(channel);
    channel = supabase.channel(`ws-${workspaceId}`);
    for (const [table, key] of Object.entries(TABLE_TO_KEY)) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const s = get();
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (!oldId) return;
            mutate({ [key]: (s[key] as { id: string }[]).filter((r) => r.id !== oldId) } as Partial<DataState>);
          } else {
            mutate({
              [key]: upsert(s[key] as { id: string }[], payload.new as { id: string }),
            } as Partial<DataState>);
          }
        },
      );
    }
    // Comments are keyed per task
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => {
        const c = payload.new as Comment;
        const s = get();
        const existing = s.comments[c.task_id] ?? [];
        if (existing.some((x) => x.id === c.id)) return;
        set({ comments: { ...s.comments, [c.task_id]: [...existing, c] } });
      },
    );
    channel.subscribe();
  }

  async function fetchWorkspaceData(workspaceId: string) {
    const [lists, columns, tasks, tags, fields, views, templates, docs, relations, memberRows] =
      await Promise.all([
        supabase.from('lists').select('*').eq('workspace_id', workspaceId).order('position'),
        supabase.from('columns').select('*').eq('workspace_id', workspaceId).order('position'),
        supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('position'),
        supabase.from('tags').select('*').eq('workspace_id', workspaceId),
        supabase.from('custom_fields').select('*').eq('workspace_id', workspaceId),
        supabase.from('views').select('*').eq('workspace_id', workspaceId).order('position'),
        supabase.from('templates').select('*').eq('workspace_id', workspaceId),
        supabase.from('docs').select('*').eq('workspace_id', workspaceId).order('position'),
        supabase.from('task_relations').select('*').eq('workspace_id', workspaceId),
        supabase.from('workspace_members').select('user_id, profiles(*)').eq('workspace_id', workspaceId),
      ]);

    const members = (memberRows.data ?? [])
      .map((r) => (r as unknown as { profiles: Profile }).profiles)
      .filter(Boolean);

    mutate({
      lists: (lists.data as List[]) ?? [],
      columns: (columns.data as Column[]) ?? [],
      tasks: (tasks.data as Task[]) ?? [],
      tags: (tags.data as Tag[]) ?? [],
      customFields: (fields.data as CustomField[]) ?? [],
      views: (views.data as View[]) ?? [],
      templates: (templates.data as Template[]) ?? [],
      docs: (docs.data as Doc[]) ?? [],
      relations: (relations.data as TaskRelation[]) ?? [],
      members,
      ready: true,
      offline: false,
    });
  }

  return {
    ready: false,
    offline: false,
    workspaces: [],
    currentWorkspaceId: null,
    members: [],
    lists: [],
    columns: [],
    tasks: [],
    tags: [],
    customFields: [],
    views: [],
    templates: [],
    docs: [],
    relations: [],
    comments: {},

    init: async (userId: string) => {
      try {
        const { data, error } = await supabase.from('workspaces').select('*').order('created_at');
        if (error) throw error;
        let workspaces = (data as Workspace[]) ?? [];
        if (workspaces.length === 0) {
          const id = await get().createWorkspace('My Workspace', userId);
          workspaces = get().workspaces;
          set({ workspaces });
          await get().selectWorkspace(id);
          return;
        }
        set({ workspaces });
        const preferred = localStorage.getItem('priora-current-ws');
        const target = workspaces.find((w) => w.id === preferred) ?? workspaces[0];
        await get().selectWorkspace(target.id);
      } catch {
        // Offline start: restore the last snapshot so the app remains usable
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
          if (cached) {
            set({ ...cached, ready: true, offline: true });
            return;
          }
        } catch {
          /* fall through */
        }
        set({ ready: true, offline: true });
      }
    },

    selectWorkspace: async (id: string) => {
      localStorage.setItem('priora-current-ws', id);
      set({ currentWorkspaceId: id, ready: false });
      try {
        await fetchWorkspaceData(id);
        subscribeRealtime(id);
        // Ask the server to materialize due-soon notifications for this user
        void supabase.rpc('generate_due_soon_notifications');
      } catch {
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
          if (cached && cached.currentWorkspaceId === id) {
            set({ ...cached, ready: true, offline: true });
            return;
          }
        } catch {
          /* ignore */
        }
        set({ ready: true, offline: true });
      }
    },

    createWorkspace: async (name: string, userId: string) => {
      const workspace: Workspace = {
        id: uuid(),
        name,
        color: '#7b68ee',
        owner_id: userId,
        created_at: new Date().toISOString(),
      };
      mutate({ workspaces: [...get().workspaces, workspace], currentWorkspaceId: workspace.id });
      const { error } = await supabase.from('workspaces').insert(workspace);
      if (error && !/fetch|network/i.test(error.message)) {
        set({ workspaces: get().workspaces.filter((w) => w.id !== workspace.id) });
        throw error;
      }
      // Seed a starter list so the workspace isn't empty
      set({ currentWorkspaceId: workspace.id, members: [], ready: true });
      const listId = get().createList('Getting Started', 'rocket', '#7b68ee');
      const todo = get().columns.find((c) => c.list_id === listId && c.kind === 'todo');
      if (todo) {
        get().createTask({
          list_id: listId,
          title: 'Welcome to Priora 👋 — drag me to another column',
          column_id: todo.id,
          priority: 'normal',
        });
      }
      subscribeRealtime(workspace.id);
      return workspace.id;
    },

    inviteMember: async (email: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', email.trim())
        .maybeSingle();
      if (!profile) return 'No user with that email has signed in yet. Ask them to log in once first.';
      const { error } = await supabase.from('workspace_members').insert({
        workspace_id: ws(),
        user_id: (profile as Profile).id,
        role: 'member',
      });
      if (error) {
        if (error.code === '23505') return 'That user is already a member.';
        return error.message;
      }
      mutate({ members: upsert(get().members, profile as Profile) });
      return null;
    },

    // ---------- Lists ----------
    createList: (name, icon = 'list', color = '#7b68ee') => {
      const positions = get().lists.map((l) => l.position);
      const list: List = {
        id: uuid(),
        workspace_id: ws(),
        name,
        icon,
        color,
        position: (positions.length ? Math.max(...positions) : 0) + 1000,
        archived: false,
        created_at: new Date().toISOString(),
      };
      localInsert('lists', 'lists', list);
      // Default kanban columns
      const defaults: { name: string; color: string; kind: Column['kind'] }[] = [
        { name: 'To Do', color: '#87909e', kind: 'todo' },
        { name: 'In Progress', color: '#4f9bff', kind: 'in_progress' },
        { name: 'Done', color: '#00b884', kind: 'done' },
      ];
      defaults.forEach((d) => get().createColumn(list.id, d.name, d.color, d.kind));
      // Default views (Notion-style: many views over the same tasks)
      get().createView(list.id, 'Board', 'board', { groupBy: 'status', rollups: [{ op: 'count' }] });
      get().createView(list.id, 'List', 'list', { groupBy: 'status' });
      get().createView(list.id, 'Table', 'table', {});
      get().createView(list.id, 'Calendar', 'calendar', {});
      return list.id;
    },
    updateList: (id, patch) => localUpdate<List>('lists', 'lists', id, patch),
    deleteList: (id) => {
      // cascade locally (server cascades via FK)
      mutate({
        tasks: get().tasks.filter((t) => t.list_id !== id),
        columns: get().columns.filter((c) => c.list_id !== id),
        views: get().views.filter((v) => v.list_id !== id),
      });
      localDelete('lists', 'lists', id);
    },

    // ---------- Columns ----------
    createColumn: (listId, name, color, kind = 'custom') => {
      const siblings = get().columns.filter((c) => c.list_id === listId);
      const column: Column = {
        id: uuid(),
        list_id: listId,
        workspace_id: ws(),
        name,
        color: color ?? COLUMN_COLORS[siblings.length % COLUMN_COLORS.length],
        kind,
        position: (siblings.length ? Math.max(...siblings.map((c) => c.position)) : 0) + 1000,
        created_at: new Date().toISOString(),
      };
      localInsert('columns', 'columns', column);
      return column.id;
    },
    updateColumn: (id, patch) => localUpdate<Column>('columns', 'columns', id, patch),
    deleteColumn: (id) => {
      // Detach tasks locally; server sets column_id null via FK
      const affected = get().tasks.filter((t) => t.column_id === id);
      affected.forEach((t) => {
        mutate({ tasks: get().tasks.map((x) => (x.id === t.id ? { ...x, column_id: null } : x)) });
      });
      localDelete('columns', 'columns', id);
    },

    // ---------- Tasks ----------
    createTask: (input) => {
      const siblings = get().tasks.filter((t) => t.list_id === input.list_id);
      const task: Task = {
        id: uuid(),
        workspace_id: ws(),
        list_id: input.list_id,
        column_id: input.column_id ?? null,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 'none',
        due_date: input.due_date ?? null,
        start_date: input.start_date ?? null,
        assignees: input.assignees ?? [],
        tag_ids: input.tag_ids ?? [],
        custom_values: input.custom_values ?? {},
        position: (siblings.length ? Math.max(...siblings.map((t) => t.position)) : 0) + 1000,
        archived: false,
        completed_at: null,
        created_by: input.created_by ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localInsert('tasks', 'tasks', task);
      return task.id;
    },
    updateTask: (id, patch) =>
      localUpdate<Task>('tasks', 'tasks', id, { ...patch, updated_at: new Date().toISOString() }),
    deleteTask: (id) => {
      mutate({ relations: get().relations.filter((r) => r.task_id !== id && r.related_task_id !== id) });
      localDelete('tasks', 'tasks', id);
    },
    moveTask: (id, columnId, beforePos, afterPos) => {
      const position = positionBetween(beforePos, afterPos);
      const task = get().tasks.find((t) => t.id === id);
      const done = columnId ? get().columns.find((c) => c.id === columnId)?.kind === 'done' : false;
      const patch: Partial<Task> = { column_id: columnId, position };
      if (done && !task?.completed_at) patch.completed_at = new Date().toISOString();
      if (!done && task?.completed_at) patch.completed_at = null;
      get().updateTask(id, patch);
    },
    toggleComplete: (id) => {
      const task = get().tasks.find((t) => t.id === id);
      if (!task) return;
      const nowDone = !task.completed_at;
      const patch: Partial<Task> = { completed_at: nowDone ? new Date().toISOString() : null };
      if (nowDone) {
        const doneCol = get().columns.find((c) => c.list_id === task.list_id && c.kind === 'done');
        if (doneCol) patch.column_id = doneCol.id;
      }
      get().updateTask(id, patch);
    },

    // ---------- Tags ----------
    createTag: (name, color) => {
      const tag: Tag = { id: uuid(), workspace_id: ws(), name, color, created_at: new Date().toISOString() };
      localInsert('tags', 'tags', tag);
      return tag.id;
    },
    updateTag: (id, patch) => localUpdate<Tag>('tags', 'tags', id, patch),
    deleteTag: (id) => {
      // strip the tag from tasks locally for immediate UI consistency
      get()
        .tasks.filter((t) => t.tag_ids.includes(id))
        .forEach((t) =>
          get().updateTask(t.id, { tag_ids: t.tag_ids.filter((x) => x !== id) }),
        );
      localDelete('tags', 'tags', id);
    },

    // ---------- Custom fields ----------
    createField: (input) => {
      const field: CustomField = {
        ...input,
        id: uuid(),
        workspace_id: ws(),
        created_at: new Date().toISOString(),
      };
      localInsert('customFields', 'custom_fields', field);
      return field.id;
    },
    updateField: (id, patch) => localUpdate<CustomField>('customFields', 'custom_fields', id, patch),
    deleteField: (id) => localDelete('customFields', 'custom_fields', id),

    // ---------- Views ----------
    createView: (listId, name, type, config = {}) => {
      const siblings = get().views.filter((v) => v.list_id === listId);
      const view: View = {
        id: uuid(),
        workspace_id: ws(),
        list_id: listId,
        name,
        type,
        config,
        position: (siblings.length ? Math.max(...siblings.map((v) => v.position)) : 0) + 1000,
        created_at: new Date().toISOString(),
      };
      localInsert('views', 'views', view);
      return view.id;
    },
    updateView: (id, patch) => localUpdate<View>('views', 'views', id, patch),
    deleteView: (id) => localDelete('views', 'views', id),

    // ---------- Templates ----------
    createTemplate: (input) => {
      const template: Template = {
        ...input,
        id: uuid(),
        workspace_id: ws(),
        created_at: new Date().toISOString(),
      };
      localInsert('templates', 'templates', template);
      return template.id;
    },
    deleteTemplate: (id) => localDelete('templates', 'templates', id),

    applyTaskTemplate: (template, listId, columnId) => {
      if (template.type !== 'task') return null;
      const p = template.payload as TaskTemplatePayload;
      // Resolve tag names → ids, creating missing tags on the fly
      const tagIds = (p.tag_names ?? []).map((name) => {
        const existing = get().tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        return existing ? existing.id : get().createTag(name, '#7b68ee');
      });
      const due = p.due_in_days != null ? new Date(Date.now() + p.due_in_days * 86_400_000).toISOString() : null;
      const mainId = get().createTask({
        list_id: listId,
        column_id: columnId,
        title: p.title,
        description: p.description ?? '',
        priority: p.priority ?? 'none',
        due_date: due,
        tag_ids: tagIds,
        custom_values: p.custom_values ?? {},
      });
      for (const sub of p.subtasks ?? []) {
        const subId = get().createTask({
          list_id: listId,
          column_id: columnId,
          title: sub.title,
          priority: sub.priority ?? 'none',
        });
        get().addRelation(mainId, subId, 'subtask');
      }
      return mainId;
    },

    applyListTemplate: (template, name) => {
      if (template.type !== 'list') return null;
      const p = template.payload as ListTemplatePayload;
      const listId = get().createList(name);
      // Replace the default columns with the template's
      get()
        .columns.filter((c) => c.list_id === listId)
        .forEach((c) => get().deleteColumn(c.id));
      const colIds = p.columns.map((c) => get().createColumn(listId, c.name, c.color, c.kind));
      const firstCol = colIds[0] ?? null;
      p.tasks.forEach((t) =>
        get().applyTaskTemplate(
          { ...template, type: 'task', payload: t },
          listId,
          firstCol,
        ),
      );
      return listId;
    },

    // ---------- Docs ----------
    createDoc: (parentId = null) => {
      const siblings = get().docs.filter((d) => d.parent_id === parentId);
      const doc: Doc = {
        id: uuid(),
        workspace_id: ws(),
        parent_id: parentId,
        title: 'Untitled',
        icon: '📄',
        content: '',
        linked_task_ids: [],
        position: (siblings.length ? Math.max(...siblings.map((d) => d.position)) : 0) + 1000,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localInsert('docs', 'docs', doc);
      return doc.id;
    },
    updateDoc: (id, patch) =>
      localUpdate<Doc>('docs', 'docs', id, { ...patch, updated_at: new Date().toISOString() }),
    deleteDoc: (id) => {
      // delete descendants locally too
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const d of get().docs) {
          if (d.parent_id && toDelete.has(d.parent_id) && !toDelete.has(d.id)) {
            toDelete.add(d.id);
            changed = true;
          }
        }
      }
      toDelete.forEach((docId) => localDelete('docs', 'docs', docId));
    },

    // ---------- Relations ----------
    addRelation: (taskId, relatedId, type) => {
      if (taskId === relatedId) return;
      const exists = get().relations.some(
        (r) => r.task_id === taskId && r.related_task_id === relatedId && r.relation_type === type,
      );
      if (exists) return;
      const rel: TaskRelation = {
        id: uuid(),
        workspace_id: ws(),
        task_id: taskId,
        related_task_id: relatedId,
        relation_type: type,
        created_at: new Date().toISOString(),
      };
      localInsert('relations', 'task_relations', rel);
    },
    removeRelation: (id) => localDelete('relations', 'task_relations', id),

    // ---------- Comments ----------
    loadComments: async (taskId) => {
      try {
        const { data } = await supabase
          .from('comments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at');
        if (data) set({ comments: { ...get().comments, [taskId]: data as Comment[] } });
      } catch {
        /* offline — keep whatever we have */
      }
    },
    addComment: (taskId, body, authorId) => {
      const comment: Comment = {
        id: uuid(),
        workspace_id: ws(),
        task_id: taskId,
        author_id: authorId,
        body,
        created_at: new Date().toISOString(),
      };
      set({ comments: { ...get().comments, [taskId]: [...(get().comments[taskId] ?? []), comment] } });
      void pushOp({ table: 'comments', kind: 'insert', payload: comment as unknown as Record<string, unknown> });
    },
    deleteComment: (taskId, commentId) => {
      set({
        comments: {
          ...get().comments,
          [taskId]: (get().comments[taskId] ?? []).filter((c) => c.id !== commentId),
        },
      });
      void pushOp({ table: 'comments', kind: 'delete', rowId: commentId });
    },
  };
});
