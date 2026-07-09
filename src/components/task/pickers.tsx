import { Check, Flag, Plus, Tag as TagIcon, User } from 'lucide-react';
import { useState } from 'react';
import { useData } from '../../stores/data';
import type { Priority, Task } from '../../lib/types';
import { PRIORITIES } from '../../lib/types';
import { cx, displayName, priorityMeta } from '../../lib/utils';
import { Avatar, Chip, Dropdown } from '../ui';

export function PriorityPicker({ task }: { task: Task }) {
  const updateTask = useData((s) => s.updateTask);
  const meta = priorityMeta(task.priority);
  return (
    <Dropdown
      trigger={
        <button className="btn-outline !px-2 !py-1 text-xs" title="Priority">
          <Flag size={13} style={{ color: meta.color }} fill={task.priority !== 'none' ? meta.color : 'none'} />
          <span className="hidden sm:inline">{meta.label}</span>
        </button>
      }
    >
      {(close) =>
        PRIORITIES.map((p) => (
          <button
            key={p.value}
            className="menu-item"
            onClick={() => {
              updateTask(task.id, { priority: p.value as Priority });
              close();
            }}
          >
            <Flag size={13} style={{ color: p.color }} fill={p.value !== 'none' ? p.color : 'none'} />
            {p.label}
            {task.priority === p.value && <Check size={13} className="ml-auto text-brand-500" />}
          </button>
        ))
      }
    </Dropdown>
  );
}

export function AssigneePicker({ task }: { task: Task }) {
  const { members, updateTask } = useData((s) => ({ members: s.members, updateTask: s.updateTask }));
  return (
    <Dropdown
      trigger={
        <button className="btn-outline !px-2 !py-1 text-xs" title="Assignees">
          <User size={13} />
          <span className="hidden sm:inline">
            {task.assignees.length ? `${task.assignees.length} assigned` : 'Assign'}
          </span>
        </button>
      }
    >
      <div className="max-h-64 overflow-y-auto">
        {members.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">No members yet — invite people from the workspace menu.</div>
        )}
        {members.map((m) => {
          const assigned = task.assignees.includes(m.id);
          return (
            <button
              key={m.id}
              className="menu-item"
              onClick={() =>
                updateTask(task.id, {
                  assignees: assigned
                    ? task.assignees.filter((a) => a !== m.id)
                    : [...task.assignees, m.id],
                })
              }
            >
              <Avatar profile={m} size={20} />
              <span className="truncate">{displayName(m)}</span>
              {assigned && <Check size={13} className="ml-auto shrink-0 text-brand-500" />}
            </button>
          );
        })}
      </div>
    </Dropdown>
  );
}

export function TagPicker({ task }: { task: Task }) {
  const { tags, updateTask, createTag } = useData((s) => ({
    tags: s.tags,
    updateTask: s.updateTask,
    createTag: s.createTag,
  }));
  const [query, setQuery] = useState('');
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const exact = tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <Dropdown
      trigger={
        <button className="btn-outline !px-2 !py-1 text-xs" title="Tags">
          <TagIcon size={13} />
          <span className="hidden sm:inline">Tags</span>
        </button>
      }
    >
      <div className="w-56 px-2 pb-1 pt-2">
        <input
          className="input !py-1 text-xs"
          placeholder="Search or create tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {filtered.map((t) => {
          const active = task.tag_ids.includes(t.id);
          return (
            <button
              key={t.id}
              className="menu-item"
              onClick={() =>
                updateTask(task.id, {
                  tag_ids: active ? task.tag_ids.filter((x) => x !== t.id) : [...task.tag_ids, t.id],
                })
              }
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="truncate">{t.name}</span>
              {active && <Check size={13} className="ml-auto shrink-0 text-brand-500" />}
            </button>
          );
        })}
        {query.trim() && !exact && (
          <button
            className="menu-item text-brand-500"
            onClick={() => {
              const id = createTag(query.trim(), '#7b68ee');
              updateTask(task.id, { tag_ids: [...task.tag_ids, id] });
              setQuery('');
            }}
          >
            <Plus size={13} /> Create “{query.trim()}”
          </button>
        )}
      </div>
    </Dropdown>
  );
}

export function StatusPicker({ task, className }: { task: Task; className?: string }) {
  const { columns, moveTask } = useData((s) => ({ columns: s.columns, moveTask: s.moveTask }));
  const listColumns = columns
    .filter((c) => c.list_id === task.list_id)
    .sort((a, b) => a.position - b.position);
  const current = listColumns.find((c) => c.id === task.column_id);
  return (
    <Dropdown
      className={className}
      trigger={
        <button className="btn-outline !px-2 !py-1 text-xs">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: current?.color ?? '#87909e' }}
          />
          {current?.name ?? 'No status'}
        </button>
      }
    >
      {(close) =>
        listColumns.map((c) => (
          <button
            key={c.id}
            className="menu-item"
            onClick={() => {
              moveTask(task.id, c.id);
              close();
            }}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
            {c.name}
            {task.column_id === c.id && <Check size={13} className="ml-auto text-brand-500" />}
          </button>
        ))
      }
    </Dropdown>
  );
}

export function TagChips({ task, size: _size }: { task: Task; size?: never }) {
  const tags = useData((s) => s.tags);
  const taskTags = task.tag_ids.map((id) => tags.find((t) => t.id === id)).filter(Boolean);
  if (taskTags.length === 0) return null;
  return (
    <div className={cx('flex flex-wrap gap-1')}>
      {taskTags.map((t) => (
        <Chip key={t!.id} color={t!.color}>
          {t!.name}
        </Chip>
      ))}
    </div>
  );
}
