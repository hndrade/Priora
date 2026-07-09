import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, CheckCircle2, Circle, Flag, ListChecks, TrendingUp } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { useData } from '../stores/data';
import type { Task } from '../lib/types';
import { cx, displayName, dueState, formatDate, priorityMeta } from '../lib/utils';
import { TaskModal } from '../components/task/TaskModal';
import { EmptyState } from '../components/ui';

export function HomePage() {
  const { profile } = useAuth();
  const { tasks, lists, columns, toggleComplete } = useData((s) => ({
    tasks: s.tasks.filter((t) => !t.archived),
    lists: s.lists.filter((l) => !l.archived),
    columns: s.columns,
    toggleComplete: s.toggleComplete,
  }));
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const myTasks = useMemo(
    () => tasks.filter((t) => profile && t.assignees.includes(profile.id) && !t.completed_at),
    [tasks, profile],
  );
  const overdue = myTasks.filter((t) => dueState(t) === 'overdue');
  const dueToday = myTasks.filter((t) => dueState(t) === 'today');
  const done = tasks.filter((t) => t.completed_at).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
        {greeting}, {displayName(profile).split(' ')[0]} 👋
      </h1>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Here's what's happening across your workspace.
      </p>

      {/* Workspace rollup cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<ListChecks size={16} />} label="Open tasks" value={tasks.length - done} color="#7b68ee" />
        <StatCard icon={<CheckCircle2 size={16} />} label="Completed" value={done} color="#00b884" />
        <StatCard icon={<AlarmClock size={16} />} label="Overdue" value={overdue.length} color="#e0413e" />
        <StatCard icon={<TrendingUp size={16} />} label="% complete" value={`${percent}%`} color="#4f9bff" />
      </div>

      {/* My work */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <TaskListCard
          title="My tasks"
          emptyHint="Tasks assigned to you appear here."
          tasks={myTasks.slice(0, 8)}
          onOpen={(t) => setOpenTaskId(t.id)}
          onToggle={toggleComplete}
        />
        <TaskListCard
          title="Due today & overdue"
          emptyHint="Nothing urgent. Enjoy the calm 🌿"
          tasks={[...overdue, ...dueToday].slice(0, 8)}
          onOpen={(t) => setOpenTaskId(t.id)}
          onToggle={toggleComplete}
        />
      </div>

      {/* Lists overview with per-list progress (Notion-style rollup) */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">Spaces</h2>
        {lists.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={30} />}
            title="No lists yet"
            hint="Create a list from the sidebar to start organizing tasks."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => {
              const listTasks = tasks.filter((t) => t.list_id === list.id);
              const listDone = listTasks.filter((t) => t.completed_at).length;
              const pct = listTasks.length ? Math.round((listDone / listTasks.length) * 100) : 0;
              const listCols = columns.filter((c) => c.list_id === list.id);
              return (
                <Link key={list.id} to={`/list/${list.id}`} className="card block p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: list.color }} />
                    <span className="truncate text-sm font-semibold">{list.name}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {listDone}/{listTasks.length} done · {listCols.length} columns
                    </span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-dark-3">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <TaskModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function TaskListCard({
  title,
  emptyHint,
  tasks,
  onOpen,
  onToggle,
}: {
  title: string;
  emptyHint: string;
  tasks: Task[];
  onOpen: (t: Task) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="card">
      <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold dark:border-gray-700/60">
        {title}
      </div>
      {tasks.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-gray-400">{emptyHint}</div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
          {tasks.map((task) => {
            const meta = priorityMeta(task.priority);
            const due = dueState(task);
            return (
              <div
                key={task.id}
                className="flex cursor-pointer items-center gap-2.5 px-4 py-2 hover:bg-gray-50 dark:hover:bg-surface-dark-3/60"
                onClick={() => onOpen(task)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(task.id);
                  }}
                  className="shrink-0 text-gray-300 hover:text-brand-500 dark:text-gray-600"
                >
                  {task.completed_at ? (
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                {task.priority !== 'none' && (
                  <Flag size={11} className="shrink-0" style={{ color: meta.color }} fill={meta.color} />
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
