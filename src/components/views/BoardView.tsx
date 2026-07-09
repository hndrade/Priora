import { useState } from 'react';
import { MoreHorizontal, Plus, Trash2, Pencil } from 'lucide-react';
import { useData } from '../../stores/data';
import type { GroupBy, Priority, Task, View } from '../../lib/types';
import type { TaskGroup } from '../../lib/grouping';
import { computeRollup, rollupLabel } from '../../lib/grouping';
import { positionBetween } from '../../lib/utils';
import { TaskCard } from '../task/TaskCard';
import { Dropdown } from '../ui';

export function BoardView({
  groups,
  view,
  listId,
  onOpenTask,
}: {
  groups: TaskGroup[];
  view: View;
  listId: string;
  onOpenTask: (task: Task) => void;
}) {
  const { customFields, createColumn } = useData((s) => ({
    customFields: s.customFields,
    createColumn: s.createColumn,
  }));
  const groupBy: GroupBy = view.config.groupBy ?? 'status';
  const rollups = view.config.rollups ?? [];
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {groups.map((group) => (
        <BoardColumn
          key={group.key}
          group={group}
          groupBy={groupBy}
          listId={listId}
          onOpenTask={onOpenTask}
          rollupFooter={
            rollups.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-gray-200/60 px-1 pt-1.5 text-[10px] font-medium text-gray-400 dark:border-gray-700/60">
                {rollups.map((r, i) => (
                  <span key={i}>
                    {rollupLabel(r, customFields)}:{' '}
                    <span className="text-gray-600 dark:text-gray-300">
                      {computeRollup(group.tasks, r, customFields)}
                    </span>
                  </span>
                ))}
              </div>
            )
          }
        />
      ))}

      {groupBy === 'status' && (
        <div className="w-64 shrink-0">
          {addingColumn ? (
            <input
              autoFocus
              className="input"
              placeholder="Column name…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onBlur={() => {
                setAddingColumn(false);
                setNewColumnName('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newColumnName.trim()) {
                  createColumn(listId, newColumnName.trim());
                  setNewColumnName('');
                  setAddingColumn(false);
                }
                if (e.key === 'Escape') setAddingColumn(false);
              }}
            />
          ) : (
            <button
              className="btn-ghost w-full justify-start border border-dashed border-gray-300 text-gray-400 dark:border-gray-600"
              onClick={() => setAddingColumn(true)}
            >
              <Plus size={14} /> Add column
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BoardColumn({
  group,
  groupBy,
  listId,
  onOpenTask,
  rollupFooter,
}: {
  group: TaskGroup;
  groupBy: GroupBy;
  listId: string;
  onOpenTask: (task: Task) => void;
  rollupFooter: React.ReactNode;
}) {
  const { moveTask, updateTask, createTask, updateColumn, deleteColumn, columns } = useData((s) => ({
    moveTask: s.moveTask,
    updateTask: s.updateTask,
    createTask: s.createTask,
    updateColumn: s.updateColumn,
    deleteColumn: s.deleteColumn,
    columns: s.columns,
  }));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(group.label);
  const column = group.columnId ? columns.find((c) => c.id === group.columnId) : undefined;

  /** Apply the semantics of dropping a task into this group. */
  function applyDrop(taskId: string, beforePos?: number, afterPos?: number) {
    if (groupBy === 'status') {
      moveTask(taskId, group.columnId ?? null, beforePos, afterPos);
      return;
    }
    const position = positionBetween(beforePos, afterPos);
    if (groupBy === 'priority') {
      updateTask(taskId, { priority: group.key as Priority, position });
    } else if (groupBy === 'assignee') {
      updateTask(taskId, {
        assignees: group.key === '__none' ? [] : [group.key],
        position,
      });
    } else if (groupBy === 'tag') {
      const task = useData.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      updateTask(taskId, {
        tag_ids: group.key === '__none' ? [] : [...new Set([...task.tag_ids, group.key])],
        position,
      });
    } else if (groupBy === 'due_date') {
      const daysMap: Record<string, number | null> = { today: 0, week: 3, later: 14, none: null, overdue: -1 };
      const days = daysMap[group.key];
      updateTask(taskId, {
        due_date:
          days === null || days === undefined || days < 0
            ? null
            : new Date(Date.now() + days * 86_400_000).toISOString(),
        position,
      });
    } else if (groupBy.startsWith('field:')) {
      const fieldId = groupBy.slice('field:'.length);
      const task = useData.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      updateTask(taskId, {
        custom_values: {
          ...task.custom_values,
          [fieldId]: group.key === '__none' ? null : group.key,
        },
        position,
      });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/priora-task');
    if (!taskId) return;
    // Drop position: find the card underneath the cursor
    const cards = [...e.currentTarget.querySelectorAll('[data-task-id]')] as HTMLElement[];
    const y = e.clientY;
    let beforePos: number | undefined;
    let afterPos: number | undefined;
    const sorted = group.tasks.slice().sort((a, b) => a.position - b.position);
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        afterPos = sorted[i]?.position;
        beforePos = sorted[i - 1]?.position;
        break;
      }
      if (i === cards.length - 1) beforePos = sorted[i]?.position;
    }
    if (cards.length === 0) {
      beforePos = undefined;
      afterPos = undefined;
    }
    applyDrop(taskId, beforePos, afterPos);
  }

  const sortedTasks = group.tasks.slice().sort((a, b) => a.position - b.position);

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: group.color }}
        >
          {renaming && column ? (
            <input
              autoFocus
              className="w-24 bg-transparent outline-none"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                if (renameValue.trim()) updateColumn(column.id, { name: renameValue.trim() });
                setRenaming(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            group.label
          )}
        </span>
        <span className="text-xs font-medium text-gray-400">{group.tasks.length}</span>
        <div className="ml-auto flex items-center">
          <button
            className="btn-ghost !p-1"
            onClick={() => setAdding(true)}
            aria-label={`Add task to ${group.label}`}
          >
            <Plus size={14} />
          </button>
          {column && (
            <Dropdown
              align="right"
              trigger={
                <button className="btn-ghost !p-1" aria-label="Column options">
                  <MoreHorizontal size={14} />
                </button>
              }
            >
              {(close) => (
                <>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setRenameValue(group.label);
                      setRenaming(true);
                      close();
                    }}
                  >
                    <Pencil size={13} /> Rename
                  </button>
                  <button
                    className="menu-item text-red-500"
                    onClick={() => {
                      deleteColumn(column.id);
                      close();
                    }}
                  >
                    <Trash2 size={13} /> Delete column
                  </button>
                </>
              )}
            </Dropdown>
          )}
        </div>
      </div>

      <div
        className="flex min-h-[120px] flex-1 flex-col gap-2 rounded-xl bg-gray-100/70 p-2 transition-colors dark:bg-surface-dark-2/60"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drag-over');
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
        onDrop={onDrop}
      >
        {sortedTasks.map((task) => (
          <div key={task.id} data-task-id={task.id}>
            <TaskCard task={task} onOpen={onOpenTask} />
          </div>
        ))}

        {adding ? (
          <textarea
            autoFocus
            className="input resize-none !text-sm"
            placeholder="Task name… (Enter to save)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setAdding(false);
              setTitle('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (title.trim()) {
                  createTask({ list_id: listId, title: title.trim(), column_id: group.columnId ?? null });
                  setTitle('');
                }
              }
              if (e.key === 'Escape') setAdding(false);
            }}
          />
        ) : (
          <button
            className="btn-ghost justify-start !py-1 text-xs text-gray-400"
            onClick={() => setAdding(true)}
          >
            <Plus size={13} /> New task
          </button>
        )}
        {rollupFooter}
      </div>
    </div>
  );
}
