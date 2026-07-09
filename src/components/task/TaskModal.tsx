import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Circle,
  Link2,
  Plus,
  Send,
  Trash2,
  X,
  LayoutTemplate,
} from 'lucide-react';
import { useAuth } from '../../stores/auth';
import { useData } from '../../stores/data';
import type { RelationType, Task, TaskTemplatePayload } from '../../lib/types';
import {
  cx,
  displayName,
  formatDateTime,
  fromDateInputValue,
  relativeTime,
  toDateInputValue,
} from '../../lib/utils';
import { Avatar, Chip, Modal } from '../ui';
import { AssigneePicker, PriorityPicker, StatusPicker, TagPicker } from './pickers';
import { CustomFieldsSection } from './CustomFields';

const RELATION_LABELS: Record<RelationType, string> = {
  related: 'Related to',
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  duplicates: 'Duplicates',
  parent: 'Parent of',
  subtask: 'Subtask',
};

export function TaskModal({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = useData((s) => s.tasks.find((t) => t.id === taskId));
  if (!taskId || !task) return null;
  return <TaskModalInner key={task.id} task={task} onClose={onClose} />;
}

function TaskModalInner({ task, onClose }: { task: Task; onClose: () => void }) {
  const { profile } = useAuth();
  const {
    updateTask,
    deleteTask,
    toggleComplete,
    loadComments,
    createTemplate,
    tags,
  } = useData((s) => ({
    updateTask: s.updateTask,
    deleteTask: s.deleteTask,
    toggleComplete: s.toggleComplete,
    loadComments: s.loadComments,
    createTemplate: s.createTemplate,
    tags: s.tags,
  }));

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void loadComments(task.id);
  }, [task.id, loadComments]);

  function commitTitle() {
    const t = title.trim();
    if (t && t !== task.title) updateTask(task.id, { title: t });
    else setTitle(task.title);
  }

  function commitDescription() {
    if (description !== task.description) updateTask(task.id, { description });
  }

  function saveAsTemplate() {
    const payload: TaskTemplatePayload = {
      title: task.title,
      description: task.description,
      priority: task.priority,
      tag_names: task.tag_ids
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
      custom_values: task.custom_values,
    };
    createTemplate({
      name: task.title,
      description: 'Saved from task',
      type: 'task',
      payload,
      created_by: profile?.id ?? null,
    });
  }

  return (
    <Modal open onClose={onClose} wide title={undefined}>
      <div className="-m-5">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-700/60">
          <button
            onClick={() => toggleComplete(task.id)}
            className={cx(
              'btn-outline !px-2 !py-1 text-xs',
              task.completed_at && '!border-emerald-300 !text-emerald-600 dark:!border-emerald-700',
            )}
          >
            {task.completed_at ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {task.completed_at ? 'Completed' : 'Mark complete'}
          </button>
          <StatusPicker task={task} />
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-ghost !p-1.5" title="Save as template" onClick={saveAsTemplate}>
              <LayoutTemplate size={15} />
            </button>
            <button
              className="btn-ghost !p-1.5"
              title={task.archived ? 'Unarchive' : 'Archive'}
              onClick={() => updateTask(task.id, { archived: !task.archived })}
            >
              {task.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </button>
            <button
              className="btn-ghost !p-1.5 hover:!text-red-500"
              title="Delete task"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} />
            </button>
            <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {task.archived && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              This task is archived.
            </div>
          )}
          <input
            className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-gray-300"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Task name"
          />

          {/* Property row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriorityPicker task={task} />
            <AssigneePicker task={task} />
            <TagPicker task={task} />
            <label className="btn-outline !px-2 !py-1 text-xs">
              <span className="text-gray-400">Start</span>
              <input
                type="date"
                className="bg-transparent text-xs outline-none dark:[color-scheme:dark]"
                value={toDateInputValue(task.start_date)}
                onChange={(e) => updateTask(task.id, { start_date: fromDateInputValue(e.target.value) })}
              />
            </label>
            <label className="btn-outline !px-2 !py-1 text-xs">
              <span className="text-gray-400">Due</span>
              <input
                type="date"
                className="bg-transparent text-xs outline-none dark:[color-scheme:dark]"
                value={toDateInputValue(task.due_date)}
                onChange={(e) => updateTask(task.id, { due_date: fromDateInputValue(e.target.value) })}
              />
            </label>
          </div>

          {/* Assignee chips + tags summary */}
          <TaskPeopleAndTags task={task} />

          {/* Description */}
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Description</div>
            <textarea
              className="input min-h-[90px] resize-y !text-sm"
              placeholder="Add a description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
            />
          </div>

          {/* Notion-style custom fields */}
          <CustomFieldsSection task={task} />

          {/* Relations */}
          <RelationsSection task={task} />

          {/* Comments */}
          <CommentsSection task={task} />
        </div>
      </div>

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} title="Delete task">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Delete “{task.title}”? This also removes its comments and relations. This cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              className="btn bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                deleteTask(task.id);
                onClose();
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function TaskPeopleAndTags({ task }: { task: Task }) {
  const { members, updateTask } = useData((s) => ({ members: s.members, updateTask: s.updateTask }));
  const assignees = task.assignees
    .map((id) => members.find((m) => m.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (assignees.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {assignees.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-surface-dark-3"
        >
          <Avatar profile={p} size={18} />
          {displayName(p)}
          <button
            className="text-gray-400 hover:text-red-500"
            onClick={() => updateTask(task.id, { assignees: task.assignees.filter((a) => a !== p.id) })}
            aria-label={`Unassign ${displayName(p)}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

function RelationsSection({ task }: { task: Task }) {
  const { relations, tasks, addRelation, removeRelation } = useData((s) => ({
    relations: s.relations,
    tasks: s.tasks,
    addRelation: s.addRelation,
    removeRelation: s.removeRelation,
  }));
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [relType, setRelType] = useState<RelationType>('related');

  const mine = relations.filter((r) => r.task_id === task.id || r.related_task_id === task.id);
  const candidates = useMemo(
    () =>
      query.trim()
        ? tasks
            .filter(
              (t) =>
                t.id !== task.id &&
                !t.archived &&
                t.title.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 6)
        : [],
    [query, tasks, task.id],
  );

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Link2 size={11} className="mr-1 inline" />
          Relations
        </div>
        <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setAdding((a) => !a)}>
          <Plus size={12} /> Link task
        </button>
      </div>

      {mine.length === 0 && !adding && (
        <div className="text-xs text-gray-400">No linked tasks. Use relations to build a task database — blockers, duplicates, subtasks.</div>
      )}

      <div className="space-y-1">
        {mine.map((r) => {
          const isOutgoing = r.task_id === task.id;
          const otherId = isOutgoing ? r.related_task_id : r.task_id;
          const other = tasks.find((t) => t.id === otherId);
          if (!other) return null;
          const label = isOutgoing
            ? RELATION_LABELS[r.relation_type]
            : r.relation_type === 'blocks'
              ? 'Blocked by'
              : r.relation_type === 'blocked_by'
                ? 'Blocks'
                : r.relation_type === 'subtask'
                  ? 'Parent of'
                  : RELATION_LABELS[r.relation_type];
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 text-sm dark:border-gray-700/60"
            >
              <Chip color="#7b68ee">{label}</Chip>
              <span className={cx('truncate', other.completed_at && 'line-through text-gray-400')}>
                {other.title}
              </span>
              <button
                className="ml-auto text-gray-300 hover:text-red-500"
                onClick={() => removeRelation(r.id)}
                aria-label="Remove relation"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {adding && (
        <div className="mt-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          <div className="flex gap-2">
            <select
              className="input !w-auto !py-1 text-xs"
              value={relType}
              onChange={(e) => setRelType(e.target.value as RelationType)}
            >
              {Object.entries(RELATION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              autoFocus
              className="input !py-1 text-xs"
              placeholder="Search tasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {candidates.length > 0 && (
            <div className="mt-1">
              {candidates.map((t) => (
                <button
                  key={t.id}
                  className="menu-item rounded"
                  onClick={() => {
                    addRelation(task.id, t.id, relType);
                    setQuery('');
                    setAdding(false);
                  }}
                >
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentsSection({ task }: { task: Task }) {
  const { profile } = useAuth();
  const { comments, members, addComment, deleteComment } = useData((s) => ({
    comments: s.comments[task.id] ?? [],
    members: s.members,
    addComment: s.addComment,
    deleteComment: s.deleteComment,
  }));
  const [body, setBody] = useState('');

  function submit() {
    const text = body.trim();
    if (!text || !profile) return;
    addComment(task.id, text, profile.id);
    setBody('');
  }

  function authorOf(id: string) {
    if (profile?.id === id) return profile;
    return members.find((m) => m.id === id);
  }

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Comments ({comments.length})
      </div>
      <div className="space-y-3">
        {comments.map((c) => {
          const author = authorOf(c.author_id);
          return (
            <div key={c.id} className="group flex gap-2.5">
              <Avatar profile={author} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{displayName(author)}</span>
                  <span className="text-[10px] text-gray-400" title={formatDateTime(c.created_at)}>
                    {relativeTime(c.created_at)}
                  </span>
                  {c.author_id === profile?.id && (
                    <button
                      className="invisible text-gray-300 hover:text-red-500 group-hover:visible"
                      onClick={() => deleteComment(task.id, c.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{c.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Avatar profile={profile} size={26} />
        <div className="relative flex-1">
          <textarea
            className="input min-h-[38px] resize-y pr-9 !text-sm"
            placeholder="Write a comment… (Enter to send)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            className="absolute bottom-2 right-2 text-brand-500 hover:text-brand-600 disabled:opacity-40"
            disabled={!body.trim()}
            onClick={submit}
            aria-label="Send comment"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
