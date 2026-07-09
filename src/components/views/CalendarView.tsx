import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../../stores/data';
import type { Task } from '../../lib/types';
import { cx, isSameDay, priorityMeta } from '../../lib/utils';

export function CalendarView({
  tasks,
  listId,
  onOpenTask,
}: {
  tasks: Task[];
  listId: string;
  onOpenTask: (task: Task) => void;
}) {
  const { updateTask, createTask } = useData((s) => ({ updateTask: s.updateTask, createTask: s.createTask }));
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = cursor.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const today = new Date();

  function tasksOn(day: Date) {
    return tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), day));
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          className="btn-ghost !p-1.5"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn-ghost !p-1.5"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
        <span className="text-sm font-bold">{monthLabel}</span>
        <button
          className="btn-outline ml-auto !py-1 text-xs"
          onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
        >
          Today
        </button>
      </div>

      <div className="card grid flex-1 grid-cols-7 overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="border-b border-gray-100 px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-gray-400 dark:border-gray-700/60"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={cx(
              'min-h-[92px] border-b border-r border-gray-50 p-1 dark:border-gray-700/40',
              day && isSameDay(day, today) && 'bg-brand-50/60 dark:bg-brand-900/20',
              !day && 'bg-gray-50/40 dark:bg-surface-dark-3/30',
            )}
            onDragOver={(e) => day && e.preventDefault()}
            onDrop={(e) => {
              if (!day) return;
              const taskId = e.dataTransfer.getData('text/priora-task');
              if (taskId) {
                const due = new Date(day);
                due.setHours(23, 59, 0, 0);
                updateTask(taskId, { due_date: due.toISOString() });
              }
            }}
            onDoubleClick={() => {
              if (!day) return;
              const title = window.prompt('New task for ' + day.toLocaleDateString());
              if (title?.trim()) {
                const due = new Date(day);
                due.setHours(23, 59, 0, 0);
                createTask({ list_id: listId, title: title.trim(), due_date: due.toISOString() });
              }
            }}
          >
            {day && (
              <>
                <div
                  className={cx(
                    'mb-1 px-1 text-[11px] font-semibold',
                    isSameDay(day, today) ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400',
                  )}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {tasksOn(day)
                    .slice(0, 3)
                    .map((task) => {
                      const meta = priorityMeta(task.priority);
                      return (
                        <button
                          key={task.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/priora-task', task.id)}
                          onClick={() => onOpenTask(task)}
                          className={cx(
                            'block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white',
                            task.completed_at && 'opacity-50 line-through',
                          )}
                          style={{ backgroundColor: task.priority !== 'none' ? meta.color : '#7b68ee' }}
                          title={task.title}
                        >
                          {task.title}
                        </button>
                      );
                    })}
                  {tasksOn(day).length > 3 && (
                    <div className="px-1 text-[10px] text-gray-400">+{tasksOn(day).length - 3} more</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[11px] text-gray-400">
        Drag tasks between days to reschedule · double-click a day to create a task
      </div>
    </div>
  );
}
