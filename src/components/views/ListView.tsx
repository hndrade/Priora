import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Flag, Plus } from 'lucide-react';
import { useData } from '../../stores/data';
import type { Task } from '../../lib/types';
import type { TaskGroup } from '../../lib/grouping';
import { cx, dueState, formatDate, priorityMeta } from '../../lib/utils';
import { AvatarStack } from '../ui';
import { TagChips } from '../task/pickers';

export function ListView({
  groups,
  listId,
  onOpenTask,
}: {
  groups: TaskGroup[];
  listId: string;
  onOpenTask: (task: Task) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      {groups.map((group) => (
        <ListGroup key={group.key} group={group} listId={listId} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}

function ListGroup({
  group,
  listId,
  onOpenTask,
}: {
  group: TaskGroup;
  listId: string;
  onOpenTask: (task: Task) => void;
}) {
  const { createTask, toggleComplete, members } = useData((s) => ({
    createTask: s.createTask,
    toggleComplete: s.toggleComplete,
    members: s.members,
  }));
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  return (
    <div>
      <button
        className="mb-1 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide"
        onClick={() => setCollapsed((c) => !c)}
        style={{ color: group.color }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        {group.label}
        <span className="font-medium text-gray-400">{group.tasks.length}</span>
      </button>

      {!collapsed && (
        <div className="card divide-y divide-gray-100 dark:divide-gray-700/60">
          {group.tasks.map((task) => {
            const meta = priorityMeta(task.priority);
            const due = dueState(task);
            const assignees = task.assignees.map((id) => members.find((m) => m.id === id)).filter(Boolean);
            return (
              <div
                key={task.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-dark-3/60"
                onClick={() => onOpenTask(task)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleComplete(task.id);
                  }}
                  className="shrink-0 text-gray-300 hover:text-brand-500 dark:text-gray-600"
                >
                  {task.completed_at ? (
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>
                <span
                  className={cx(
                    'min-w-0 flex-1 truncate text-sm',
                    task.completed_at && 'text-gray-400 line-through',
                  )}
                >
                  {task.title}
                </span>
                <div className="hidden sm:block">
                  <TagChips task={task} />
                </div>
                {task.priority !== 'none' && (
                  <Flag size={12} className="shrink-0" style={{ color: meta.color }} fill={meta.color} />
                )}
                {task.due_date && (
                  <span
                    className={cx(
                      'shrink-0 text-[11px] text-gray-400',
                      due === 'overdue' && 'font-semibold text-red-500',
                      due === 'today' && 'font-semibold text-amber-500',
                    )}
                  >
                    {formatDate(task.due_date)}
                  </span>
                )}
                {assignees.length > 0 && <AvatarStack profiles={assignees} size={20} />}
              </div>
            );
          })}

          <div className="px-3 py-1.5">
            {adding ? (
              <input
                autoFocus
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                placeholder="Task name… (Enter to save, Esc to cancel)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  setAdding(false);
                  setTitle('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && title.trim()) {
                    createTask({ list_id: listId, title: title.trim(), column_id: group.columnId ?? null });
                    setTitle('');
                  }
                  if (e.key === 'Escape') setAdding(false);
                }}
              />
            ) : (
              <button
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500"
                onClick={() => setAdding(true)}
              >
                <Plus size={12} /> New task
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
