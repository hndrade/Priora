import { AlignLeft, CalendarDays, CheckCircle2, Circle, Flag, Link2, MessageSquare } from 'lucide-react';
import { useData } from '../../stores/data';
import type { Task } from '../../lib/types';
import { cx, dueState, formatDate, priorityMeta } from '../../lib/utils';
import { AvatarStack } from '../ui';
import { TagChips } from './pickers';

export function TaskCard({
  task,
  onOpen,
  draggable = true,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  draggable?: boolean;
}) {
  const { members, toggleComplete, relations } = useData((s) => ({
    members: s.members,
    toggleComplete: s.toggleComplete,
    relations: s.relations,
  }));
  const assignees = task.assignees.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const meta = priorityMeta(task.priority);
  const due = dueState(task);
  const relationCount = relations.filter(
    (r) => r.task_id === task.id || r.related_task_id === task.id,
  ).length;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/priora-task', task.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).classList.add('dragging');
      }}
      onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove('dragging')}
      onClick={() => onOpen(task)}
      className="card group cursor-pointer p-3 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleComplete(task.id);
          }}
          className="mt-0.5 shrink-0 text-gray-300 hover:text-brand-500 dark:text-gray-600"
          aria-label={task.completed_at ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed_at ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : (
            <Circle size={16} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={cx(
              'text-sm font-medium leading-snug',
              task.completed_at && 'text-gray-400 line-through dark:text-gray-500',
            )}
          >
            {task.title}
          </div>
          <div className="mt-1.5 space-y-1.5">
            <TagChips task={task} />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
              {task.priority !== 'none' && (
                <span className="inline-flex items-center gap-0.5" title={`Priority: ${meta.label}`}>
                  <Flag size={11} style={{ color: meta.color }} fill={meta.color} />
                </span>
              )}
              {task.due_date && (
                <span
                  className={cx(
                    'inline-flex items-center gap-1',
                    due === 'overdue' && 'font-semibold text-red-500',
                    due === 'today' && 'font-semibold text-amber-500',
                  )}
                >
                  <CalendarDays size={11} />
                  {formatDate(task.due_date)}
                </span>
              )}
              {task.description && <AlignLeft size={11} aria-label="Has description" />}
              {relationCount > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Link2 size={11} />
                  {relationCount}
                </span>
              )}
              <CommentCount taskId={task.id} />
            </div>
          </div>
        </div>
        {assignees.length > 0 && (
          <div className="shrink-0">
            <AvatarStack profiles={assignees} size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

function CommentCount({ taskId }: { taskId: string }) {
  const count = useData((s) => s.comments[taskId]?.length ?? 0);
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <MessageSquare size={11} />
      {count}
    </span>
  );
}
