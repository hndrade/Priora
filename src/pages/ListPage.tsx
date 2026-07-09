import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LayoutTemplate, Pencil } from 'lucide-react';
import { useData } from '../stores/data';
import type { Task } from '../lib/types';
import { applyFilters, groupTasks, sortTasks } from '../lib/grouping';
import { BoardView } from '../components/views/BoardView';
import { ListView } from '../components/views/ListView';
import { TableView } from '../components/views/TableView';
import { CalendarView } from '../components/views/CalendarView';
import { ViewToolbar } from '../components/views/ViewToolbar';
import { TaskModal } from '../components/task/TaskModal';
import { Dropdown, Spinner } from '../components/ui';

export function ListPage() {
  const { listId } = useParams<{ listId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { ready, lists, tasks, columns, tags, customFields, views, members, templates, updateList, applyTaskTemplate } =
    useData((s) => ({
      ready: s.ready,
      lists: s.lists,
      tasks: s.tasks,
      columns: s.columns,
      tags: s.tags,
      customFields: s.customFields,
      views: s.views,
      members: s.members,
      templates: s.templates,
      updateList: s.updateList,
      applyTaskTemplate: s.applyTaskTemplate,
    }));

  const list = lists.find((l) => l.id === listId);
  const listViews = useMemo(
    () => views.filter((v) => v.list_id === listId).sort((a, b) => a.position - b.position),
    [views, listId],
  );

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const activeView = listViews.find((v) => v.id === activeViewId) ?? listViews[0];

  const openTaskId = searchParams.get('task');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    setActiveViewId(null); // reset when navigating between lists
  }, [listId]);

  const listColumns = useMemo(
    () => columns.filter((c) => c.list_id === listId).sort((a, b) => a.position - b.position),
    [columns, listId],
  );

  const visibleTasks = useMemo(() => {
    if (!listId || !activeView) return [];
    const listTasks = tasks.filter((t) => t.list_id === listId);
    const columnsById = new Map(listColumns.map((c) => [c.id, c]));
    const filtered = applyFilters(listTasks, activeView.config.filters, columnsById);
    return sortTasks(filtered, activeView.config.sortBy ?? 'position', activeView.config.sortDir ?? 'asc');
  }, [tasks, listId, activeView, listColumns]);

  const groups = useMemo(() => {
    if (!activeView) return [];
    return groupTasks(visibleTasks, activeView.config.groupBy ?? 'status', {
      columns: listColumns,
      tags,
      fields: customFields,
      profiles: new Map(members.map((m) => [m.id, m])),
    });
  }, [visibleTasks, activeView, listColumns, tags, customFields, members]);

  if (!ready) return <Spinner />;
  if (!list || !listId) {
    return <div className="p-8 text-center text-sm text-gray-400">List not found — it may have been deleted.</div>;
  }

  const taskTemplates = templates.filter((t) => t.type === 'task');
  const openTask = (task: Task) => setSearchParams({ task: task.id });

  return (
    <div className="flex h-full flex-col">
      {/* List header */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700/60 dark:bg-surface-dark-2">
        <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: list.color }} />
        {renaming ? (
          <input
            autoFocus
            className="bg-transparent text-base font-bold outline-none"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim()) updateList(list.id, { name: renameValue.trim() });
              setRenaming(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <h1 className="truncate text-base font-bold">{list.name}</h1>
        )}
        <button
          className="btn-ghost !p-1 text-gray-400"
          title="Rename list"
          onClick={() => {
            setRenameValue(list.name);
            setRenaming(true);
          }}
        >
          <Pencil size={13} />
        </button>

        {taskTemplates.length > 0 && (
          <Dropdown
            align="right"
            className="ml-auto"
            trigger={
              <button className="btn-outline !py-1 text-xs">
                <LayoutTemplate size={12} />
                <span className="hidden sm:inline">Use template</span>
              </button>
            }
          >
            {(close) =>
              taskTemplates.map((t) => (
                <button
                  key={t.id}
                  className="menu-item"
                  onClick={() => {
                    const id = applyTaskTemplate(t, listId, listColumns[0]?.id ?? null);
                    close();
                    if (id) setSearchParams({ task: id });
                  }}
                >
                  <LayoutTemplate size={13} className="text-brand-500" />
                  <span className="truncate">{t.name}</span>
                </button>
              ))
            }
          </Dropdown>
        )}
      </div>

      {activeView && (
        <ViewToolbar listId={listId} views={listViews} activeView={activeView} onSelectView={setActiveViewId} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!activeView ? (
          <div className="p-8 text-center text-sm text-gray-400">No views — create one from the toolbar.</div>
        ) : activeView.type === 'board' ? (
          <BoardView groups={groups} view={activeView} listId={listId} onOpenTask={openTask} />
        ) : activeView.type === 'list' ? (
          <ListView groups={groups} listId={listId} onOpenTask={openTask} />
        ) : activeView.type === 'table' ? (
          <TableView tasks={visibleTasks} view={activeView} onOpenTask={openTask} />
        ) : (
          <CalendarView tasks={visibleTasks} listId={listId} onOpenTask={openTask} />
        )}
      </div>

      <TaskModal
        taskId={openTaskId}
        onClose={() => {
          searchParams.delete('task');
          setSearchParams(searchParams);
          navigate(`/list/${listId}`, { replace: true });
        }}
      />
    </div>
  );
}
