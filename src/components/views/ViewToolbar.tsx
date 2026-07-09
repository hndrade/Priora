import { useState } from 'react';
import {
  ArrowDownUp,
  Calendar,
  Check,
  Filter,
  Kanban,
  LayoutList,
  Plus,
  Search,
  Sigma,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { useData } from '../../stores/data';
import type { GroupBy, Priority, RollupOp, View, ViewFilters, ViewType } from '../../lib/types';
import { PRIORITIES } from '../../lib/types';
import { cx, displayName } from '../../lib/utils';
import { Dropdown, Modal } from '../ui';

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  board: <Kanban size={13} />,
  list: <LayoutList size={13} />,
  table: <Table2 size={13} />,
  calendar: <Calendar size={13} />,
};

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'due_date', label: 'Due date' },
  { value: 'tag', label: 'Tag' },
];

export function ViewToolbar({
  listId,
  views,
  activeView,
  onSelectView,
}: {
  listId: string;
  views: View[];
  activeView: View;
  onSelectView: (id: string) => void;
}) {
  const { createView, updateView, deleteView, customFields, members, columns, tags } = useData((s) => ({
    createView: s.createView,
    updateView: s.updateView,
    deleteView: s.deleteView,
    customFields: s.customFields,
    members: s.members,
    columns: s.columns.filter((c) => c.list_id === listId),
    tags: s.tags,
  }));
  const [creatingView, setCreatingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewType, setNewViewType] = useState<ViewType>('board');

  const filters = activeView.config.filters ?? {};
  const listFields = customFields.filter((f) => f.list_id === null || f.list_id === listId);
  const selectFields = listFields.filter((f) => f.type === 'select');
  const numberFields = listFields.filter((f) => f.type === 'number');

  function patchConfig(patch: Partial<View['config']>) {
    updateView(activeView.id, { config: { ...activeView.config, ...patch } });
  }

  function patchFilters(patch: Partial<ViewFilters>) {
    patchConfig({ filters: { ...filters, ...patch } });
  }

  const activeFilterCount =
    (filters.statuses?.length ? 1 : 0) +
    (filters.priorities?.length ? 1 : 0) +
    (filters.assignees?.length ? 1 : 0) +
    (filters.tagIds?.length ? 1 : 0) +
    (filters.due && filters.due !== 'any' ? 1 : 0) +
    (filters.includeArchived ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700/60 dark:bg-surface-dark-2">
      {/* View tabs — multiple flexible views over the same tasks */}
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelectView(v.id)}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              v.id === activeView.id
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-surface-dark-3',
            )}
          >
            {VIEW_ICONS[v.type]}
            {v.name}
          </button>
        ))}
        <button
          className="btn-ghost shrink-0 !p-1 text-gray-400"
          onClick={() => setCreatingView(true)}
          title="Add view"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        {/* Search */}
        <div className="relative">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input !w-36 !py-1 !pl-6 text-xs sm:!w-44"
            placeholder="Search tasks…"
            value={filters.search ?? ''}
            onChange={(e) => patchFilters({ search: e.target.value || undefined })}
          />
        </div>

        {/* Group by */}
        {activeView.type !== 'calendar' && activeView.type !== 'table' && (
          <Dropdown
            align="right"
            trigger={
              <button className="btn-outline !py-1 text-xs">
                <ArrowDownUp size={12} />
                <span className="hidden md:inline">
                  Group: {GROUP_OPTIONS.find((g) => g.value === activeView.config.groupBy)?.label ??
                    selectFields.find((f) => `field:${f.id}` === activeView.config.groupBy)?.name ??
                    'Status'}
                </span>
              </button>
            }
          >
            {(close) => (
              <>
                {GROUP_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    className="menu-item"
                    onClick={() => {
                      patchConfig({ groupBy: g.value });
                      close();
                    }}
                  >
                    {g.label}
                    {(activeView.config.groupBy ?? 'status') === g.value && (
                      <Check size={13} className="ml-auto text-brand-500" />
                    )}
                  </button>
                ))}
                {selectFields.length > 0 && (
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700/60" />
                )}
                {selectFields.map((f) => (
                  <button
                    key={f.id}
                    className="menu-item"
                    onClick={() => {
                      patchConfig({ groupBy: `field:${f.id}` });
                      close();
                    }}
                  >
                    {f.name} <span className="text-[10px] text-gray-400">(field)</span>
                    {activeView.config.groupBy === `field:${f.id}` && (
                      <Check size={13} className="ml-auto text-brand-500" />
                    )}
                  </button>
                ))}
              </>
            )}
          </Dropdown>
        )}

        {/* Sort */}
        <Dropdown
          align="right"
          trigger={
            <button className="btn-outline !py-1 text-xs" title="Sort">
              <ArrowDownUp size={12} className="rotate-90" />
              <span className="hidden md:inline">Sort</span>
            </button>
          }
        >
          {(close) =>
            (
              [
                ['position', 'Manual'],
                ['due_date', 'Due date'],
                ['priority', 'Priority'],
                ['title', 'Name'],
                ['created_at', 'Created'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className="menu-item"
                onClick={() => {
                  patchConfig({ sortBy: value });
                  close();
                }}
              >
                {label}
                {(activeView.config.sortBy ?? 'position') === value && (
                  <Check size={13} className="ml-auto text-brand-500" />
                )}
              </button>
            ))
          }
        </Dropdown>

        {/* Filters */}
        <Dropdown
          align="right"
          trigger={
            <button
              className={cx('btn-outline !py-1 text-xs', activeFilterCount > 0 && '!border-brand-400 !text-brand-500')}
            >
              <Filter size={12} />
              <span className="hidden md:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          }
        >
          <div className="w-64 space-y-2.5 p-3 text-xs">
            <FilterMulti
              label="Status"
              options={columns.map((c) => ({ value: c.id, label: c.name }))}
              selected={filters.statuses ?? []}
              onChange={(statuses) => patchFilters({ statuses: statuses.length ? statuses : undefined })}
            />
            <FilterMulti
              label="Priority"
              options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
              selected={filters.priorities ?? []}
              onChange={(v) => patchFilters({ priorities: v.length ? (v as Priority[]) : undefined })}
            />
            <FilterMulti
              label="Assignee"
              options={members.map((m) => ({ value: m.id, label: displayName(m) }))}
              selected={filters.assignees ?? []}
              onChange={(v) => patchFilters({ assignees: v.length ? v : undefined })}
            />
            <FilterMulti
              label="Tags"
              options={tags.map((t) => ({ value: t.id, label: t.name }))}
              selected={filters.tagIds ?? []}
              onChange={(v) => patchFilters({ tagIds: v.length ? v : undefined })}
            />
            <div>
              <div className="mb-1 font-semibold text-gray-500">Due</div>
              <select
                className="input !py-1 text-xs"
                value={filters.due ?? 'any'}
                onChange={(e) => patchFilters({ due: e.target.value as ViewFilters['due'] })}
              >
                <option value="any">Any</option>
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
                <option value="week">Next 7 days</option>
                <option value="none">No due date</option>
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-brand-500"
                checked={filters.includeArchived ?? false}
                onChange={(e) => patchFilters({ includeArchived: e.target.checked || undefined })}
              />
              Show archived
            </label>
            {activeFilterCount > 0 && (
              <button
                className="btn-ghost w-full !py-1 text-xs text-red-500"
                onClick={() => patchConfig({ filters: { search: filters.search } })}
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </Dropdown>

        {/* Rollups (Notion-style aggregations) */}
        <Dropdown
          align="right"
          trigger={
            <button className="btn-outline !py-1 text-xs" title="Rollups / aggregations">
              <Sigma size={12} />
              <span className="hidden md:inline">Rollups</span>
            </button>
          }
        >
          <div className="w-60 space-y-1 p-2 text-xs">
            <div className="px-1 font-semibold text-gray-500">Aggregations shown per group</div>
            {(
              [
                ['count', 'Count of tasks'],
                ['count_done', 'Count done'],
                ['percent_done', '% complete'],
              ] as [RollupOp, string][]
            ).map(([op, label]) => (
              <RollupToggle key={op} view={activeView} op={op} label={label} onPatch={patchConfig} />
            ))}
            {numberFields.map((f) => (
              <div key={f.id}>
                {(['sum', 'avg'] as RollupOp[]).map((op) => (
                  <RollupToggle
                    key={op}
                    view={activeView}
                    op={op}
                    fieldId={f.id}
                    label={`${op === 'sum' ? 'Sum' : 'Average'} of ${f.name}`}
                    onPatch={patchConfig}
                  />
                ))}
              </div>
            ))}
            {numberFields.length === 0 && (
              <div className="px-1 text-[11px] text-gray-400">
                Add a number custom field to unlock sum/average rollups.
              </div>
            )}
          </div>
        </Dropdown>

        {/* Delete view */}
        {views.length > 1 && (
          <button
            className="btn-ghost !p-1.5 text-gray-400 hover:!text-red-500"
            title="Delete this view"
            onClick={() => {
              deleteView(activeView.id);
              const next = views.find((v) => v.id !== activeView.id);
              if (next) onSelectView(next.id);
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {creatingView && (
        <Modal open onClose={() => setCreatingView(false)} title="New view">
          <div className="space-y-3">
            <input
              autoFocus
              className="input"
              placeholder="View name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
            />
            <div className="grid grid-cols-4 gap-2">
              {(['board', 'list', 'table', 'calendar'] as ViewType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewViewType(t)}
                  className={cx(
                    'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs capitalize',
                    newViewType === t
                      ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/30'
                      : 'border-gray-200 text-gray-500 dark:border-gray-700',
                  )}
                >
                  {VIEW_ICONS[t]}
                  {t}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setCreatingView(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!newViewName.trim()}
                onClick={() => {
                  const id = createView(listId, newViewName.trim(), newViewType, {
                    groupBy: 'status',
                  });
                  setCreatingView(false);
                  setNewViewName('');
                  onSelectView(id);
                }}
              >
                Create view
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RollupToggle({
  view,
  op,
  fieldId,
  label,
  onPatch,
}: {
  view: View;
  op: RollupOp;
  fieldId?: string;
  label: string;
  onPatch: (patch: Partial<View['config']>) => void;
}) {
  const rollups = view.config.rollups ?? [];
  const active = rollups.some((r) => r.op === op && r.fieldId === fieldId);
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-gray-50 dark:hover:bg-surface-dark-3">
      <input
        type="checkbox"
        className="accent-brand-500"
        checked={active}
        onChange={() =>
          onPatch({
            rollups: active
              ? rollups.filter((r) => !(r.op === op && r.fieldId === fieldId))
              : [...rollups, { op, fieldId }],
          })
        }
      />
      {label}
    </label>
  );
}

function FilterMulti({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <div className="mb-1 font-semibold text-gray-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              onClick={() =>
                onChange(active ? selected.filter((v) => v !== o.value) : [...selected, o.value])
              }
              className={cx(
                'rounded-full border px-2 py-0.5 text-[11px]',
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
