import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, ListChecks, Plus, Trash2, Wand2 } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { useData } from '../stores/data';
import type { ListTemplatePayload, TaskTemplatePayload, Template } from '../lib/types';
import { EmptyState, Modal } from '../components/ui';

/** Ready-made starting points, seeded into the workspace on demand. */
const BUILTIN_TEMPLATES: Omit<Template, 'id' | 'workspace_id' | 'created_at' | 'created_by'>[] = [
  {
    name: 'Sprint board',
    description: 'Backlog → In Progress → Review → Done, seeded with a sprint kickoff checklist.',
    type: 'list',
    payload: {
      columns: [
        { name: 'Backlog', color: '#87909e', kind: 'todo' },
        { name: 'In Progress', color: '#4f9bff', kind: 'in_progress' },
        { name: 'Review', color: '#f8ae00', kind: 'custom' },
        { name: 'Done', color: '#00b884', kind: 'done' },
      ],
      tasks: [
        { title: 'Sprint planning meeting', priority: 'high', tag_names: ['ritual'], due_in_days: 1 },
        { title: 'Groom the backlog', priority: 'normal', tag_names: ['ritual'] },
        { title: 'Sprint retro', priority: 'normal', tag_names: ['ritual'], due_in_days: 14 },
      ],
    } satisfies ListTemplatePayload,
  },
  {
    name: 'Bug report',
    description: 'Standardized bug intake with repro-steps checklist as subtasks.',
    type: 'task',
    payload: {
      title: '🐛 Bug: <summary>',
      description:
        '**Steps to reproduce**\n1. \n\n**Expected**\n\n**Actual**\n\n**Environment**\n- Browser/OS:',
      priority: 'high',
      tag_names: ['bug'],
      subtasks: [
        { title: 'Reproduce locally' },
        { title: 'Write regression test' },
        { title: 'Verify fix in staging' },
      ],
    } satisfies TaskTemplatePayload,
  },
  {
    name: 'Client onboarding',
    description: 'Repeatable onboarding flow: kickoff, contract, setup, handoff.',
    type: 'list',
    payload: {
      columns: [
        { name: 'To Do', color: '#87909e', kind: 'todo' },
        { name: 'Doing', color: '#4f9bff', kind: 'in_progress' },
        { name: 'Done', color: '#00b884', kind: 'done' },
      ],
      tasks: [
        { title: 'Kickoff call', priority: 'urgent', due_in_days: 2, tag_names: ['client'] },
        { title: 'Send contract', priority: 'high', due_in_days: 3, tag_names: ['client'] },
        { title: 'Workspace setup', priority: 'normal', due_in_days: 5 },
        { title: 'Handoff & training', priority: 'normal', due_in_days: 10 },
      ],
    } satisfies ListTemplatePayload,
  },
  {
    name: 'Weekly 1:1',
    description: 'Recurring 1:1 agenda with discussion points and follow-ups.',
    type: 'task',
    payload: {
      title: '1:1 — <name>',
      description: '**Agenda**\n- Wins this week\n- Blockers\n- Career/growth\n\n**Action items**\n- [ ] ',
      priority: 'normal',
      tag_names: ['1:1'],
      due_in_days: 7,
    } satisfies TaskTemplatePayload,
  },
];

export function TemplatesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { templates, lists, createTemplate, deleteTemplate, applyTaskTemplate, applyListTemplate, columns } =
    useData((s) => ({
      templates: s.templates,
      lists: s.lists.filter((l) => !l.archived),
      createTemplate: s.createTemplate,
      deleteTemplate: s.deleteTemplate,
      applyTaskTemplate: s.applyTaskTemplate,
      applyListTemplate: s.applyListTemplate,
      columns: s.columns,
    }));

  const [applying, setApplying] = useState<Template | null>(null);
  const [targetListId, setTargetListId] = useState('');
  const [newListName, setNewListName] = useState('');

  function seedBuiltins() {
    BUILTIN_TEMPLATES.forEach((t) => createTemplate({ ...t, created_by: profile?.id ?? null }));
  }

  function runApply() {
    if (!applying) return;
    if (applying.type === 'list') {
      const id = applyListTemplate(applying, newListName.trim() || applying.name);
      setApplying(null);
      if (id) navigate(`/list/${id}`);
    } else {
      const listId = targetListId || lists[0]?.id;
      if (!listId) return;
      const firstCol = columns
        .filter((c) => c.list_id === listId)
        .sort((a, b) => a.position - b.position)[0];
      const taskId = applyTaskTemplate(applying, listId, firstCol?.id ?? null);
      setApplying(null);
      if (taskId) navigate(`/list/${listId}?task=${taskId}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Templates</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Reusable blueprints for common workflows — apply a template to spawn tasks or whole boards in one
            click. Save any task as a template from its detail view.
          </p>
        </div>
        <button className="btn-outline shrink-0" onClick={seedBuiltins}>
          <Wand2 size={14} />
          <span className="hidden sm:inline">Add starter templates</span>
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate size={34} />}
          title="No templates yet"
          hint="Seed the starter pack or open any task and hit the template icon to save it as a reusable blueprint."
          action={
            <button className="btn-primary mt-2" onClick={seedBuiltins}>
              <Wand2 size={14} /> Add starter templates
            </button>
          }
        />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card group flex flex-col p-4">
              <div className="flex items-center gap-2">
                {t.type === 'list' ? (
                  <ListChecks size={15} className="text-brand-500" />
                ) : (
                  <LayoutTemplate size={15} className="text-brand-500" />
                )}
                <span className="truncate text-sm font-semibold">{t.name}</span>
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-surface-dark-3 dark:text-gray-400">
                  {t.type}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-gray-400">{t.description || '—'}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="btn-primary flex-1 !py-1 text-xs"
                  onClick={() => {
                    setApplying(t);
                    setTargetListId(lists[0]?.id ?? '');
                    setNewListName(t.name);
                  }}
                >
                  <Plus size={12} /> Use template
                </button>
                <button
                  className="btn-ghost !p-1.5 text-gray-300 hover:!text-red-500"
                  title="Delete template"
                  onClick={() => deleteTemplate(t.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {applying && (
        <Modal open onClose={() => setApplying(null)} title={`Use "${applying.name}"`}>
          {applying.type === 'list' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">New list name</label>
              <input
                autoFocus
                className="input"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runApply()}
              />
            </div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-gray-500">Create a list first — task templates need a destination.</p>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Add to list</label>
              <select className="input" value={targetListId} onChange={(e) => setTargetListId(e.target.value)}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setApplying(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={applying.type === 'task' && lists.length === 0}
              onClick={runApply}
            >
              Apply
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
