import { CheckCircle2, Circle, Flag } from 'lucide-react';
import { useData } from '../../stores/data';
import type { Task, View } from '../../lib/types';
import { computeRollup, rollupLabel } from '../../lib/grouping';
import { cx, dueState, formatDate, priorityMeta } from '../../lib/utils';
import { AvatarStack, Chip } from '../ui';

export function TableView({
  tasks,
  view,
  onOpenTask,
}: {
  tasks: Task[];
  view: View;
  onOpenTask: (task: Task) => void;
}) {
  const { members, columns, tags, customFields, toggleComplete } = useData((s) => ({
    members: s.members,
    columns: s.columns,
    tags: s.tags,
    customFields: s.customFields,
    toggleComplete: s.toggleComplete,
  }));

  const listId = view.list_id;
  const fields = customFields.filter((f) => f.list_id === null || f.list_id === listId);
  const visibleFields = view.config.visibleFieldIds
    ? fields.filter((f) => view.config.visibleFieldIds!.includes(f.id))
    : fields;
  const rollups = view.config.rollups ?? [{ op: 'count' as const }, { op: 'percent_done' as const }];

  return (
    <div className="p-4">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700/60">
              <th className="w-8 px-3 py-2" />
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Assignees</th>
              <th className="px-2 py-2">Priority</th>
              <th className="px-2 py-2">Due</th>
              <th className="px-2 py-2">Tags</th>
              {visibleFields.map((f) => (
                <th key={f.id} className="px-2 py-2">
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
            {tasks.map((task) => {
              const column = columns.find((c) => c.id === task.column_id);
              const meta = priorityMeta(task.priority);
              const due = dueState(task);
              const assignees = task.assignees
                .map((id) => members.find((m) => m.id === id))
                .filter(Boolean);
              const taskTags = task.tag_ids.map((id) => tags.find((t) => t.id === id)).filter(Boolean);
              return (
                <tr
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark-3/60"
                  onClick={() => onOpenTask(task)}
                >
                  <td className="px-3 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(task.id);
                      }}
                      className="text-gray-300 hover:text-brand-500 dark:text-gray-600"
                    >
                      {task.completed_at ? (
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      ) : (
                        <Circle size={15} />
                      )}
                    </button>
                  </td>
                  <td
                    className={cx(
                      'max-w-[260px] truncate px-2 py-2 font-medium',
                      task.completed_at && 'text-gray-400 line-through',
                    )}
                  >
                    {task.title}
                  </td>
                  <td className="px-2 py-2">
                    {column && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                        style={{ backgroundColor: column.color }}
                      >
                        {column.name}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {assignees.length > 0 ? (
                      <AvatarStack profiles={assignees} size={20} />
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {task.priority !== 'none' ? (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: meta.color }}>
                        <Flag size={11} fill={meta.color} />
                        {meta.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td
                    className={cx(
                      'whitespace-nowrap px-2 py-2 text-xs text-gray-500',
                      due === 'overdue' && 'font-semibold !text-red-500',
                      due === 'today' && 'font-semibold !text-amber-500',
                    )}
                  >
                    {task.due_date ? formatDate(task.due_date) : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex max-w-[180px] flex-wrap gap-1">
                      {taskTags.map((t) => (
                        <Chip key={t!.id} color={t!.color}>
                          {t!.name}
                        </Chip>
                      ))}
                    </div>
                  </td>
                  {visibleFields.map((f) => {
                    const v = task.custom_values[f.id];
                    return (
                      <td key={f.id} className="whitespace-nowrap px-2 py-2 text-xs text-gray-500">
                        {f.type === 'checkbox' ? (v ? '✓' : '—') : v == null || v === '' ? '—' : String(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {/* Notion-style rollup footer */}
          <tfoot>
            <tr className="border-t border-gray-100 text-[11px] font-medium text-gray-400 dark:border-gray-700/60">
              <td className="px-3 py-2" />
              <td className="px-2 py-2" colSpan={6 + visibleFields.length}>
                <div className="flex flex-wrap gap-4">
                  {rollups.map((r, i) => (
                    <span key={i}>
                      {rollupLabel(r, customFields)}:{' '}
                      <span className="font-semibold text-gray-600 dark:text-gray-300">
                        {computeRollup(tasks, r, customFields)}
                      </span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
