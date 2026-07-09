import { useState } from 'react';
import { Database, Plus, Trash2 } from 'lucide-react';
import { useData } from '../../stores/data';
import type { CustomField, FieldType, Task } from '../../lib/types';
import { Modal } from '../ui';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
];

const OPTION_COLORS = ['#7b68ee', '#00b884', '#f8ae00', '#e0413e', '#4f9bff', '#ff7fab'];

export function CustomFieldsSection({ task }: { task: Task }) {
  const { customFields, updateTask, deleteField } = useData((s) => ({
    customFields: s.customFields,
    updateTask: s.updateTask,
    deleteField: s.deleteField,
  }));
  const [creating, setCreating] = useState(false);

  const fields = customFields.filter((f) => f.list_id === null || f.list_id === task.list_id);

  function setValue(fieldId: string, value: unknown) {
    updateTask(task.id, { custom_values: { ...task.custom_values, [fieldId]: value } });
  }

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Database size={11} className="mr-1 inline" />
          Custom fields
        </div>
        <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setCreating(true)}>
          <Plus size={12} /> Add field
        </button>
      </div>

      {fields.length === 0 && (
        <div className="text-xs text-gray-400">
          Notion-style properties: add text, number, select, date, checkbox or URL fields to every task in this list.
        </div>
      )}

      <div className="space-y-1.5">
        {fields.map((f) => (
          <div key={f.id} className="group flex items-center gap-2">
            <div className="w-32 shrink-0 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
              {f.name}
            </div>
            <FieldInput field={f} value={task.custom_values[f.id]} onChange={(v) => setValue(f.id, v)} />
            <button
              className="invisible shrink-0 text-gray-300 hover:text-red-500 group-hover:visible"
              title="Delete field (from all tasks)"
              onClick={() => deleteField(f.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {creating && <CreateFieldModal listId={task.list_id} onClose={() => setCreating(false)} />}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-500"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'select':
      return (
        <select
          className="input !py-1 text-xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o.label} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'number':
      return (
        <input
          type="number"
          className="input !py-1 text-xs"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="input !py-1 text-xs dark:[color-scheme:dark]"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'url':
      return (
        <div className="flex w-full items-center gap-1.5">
          <input
            type="url"
            className="input !py-1 text-xs"
            placeholder="https://…"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
          />
          {typeof value === 'string' && value && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs text-brand-500 hover:underline"
            >
              Open
            </a>
          )}
        </div>
      );
    default:
      return (
        <input
          className="input !py-1 text-xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
  }
}

export function CreateFieldModal({ listId, onClose }: { listId: string | null; onClose: () => void }) {
  const createField = useData((s) => s.createField);
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [scope, setScope] = useState<'list' | 'workspace'>('list');
  const [optionsText, setOptionsText] = useState('');

  function submit() {
    if (!name.trim()) return;
    const options =
      type === 'select'
        ? optionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((label, i) => ({ label, color: OPTION_COLORS[i % OPTION_COLORS.length] }))
        : [];
    createField({
      name: name.trim(),
      type,
      options,
      list_id: scope === 'list' ? listId : null,
    });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="New custom field">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
          <input
            autoFocus
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Story points, Client, Budget"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {type === 'select' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Options (comma-separated)
            </label>
            <input
              className="input"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Small, Medium, Large"
            />
          </div>
        )}
        {listId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Scope</label>
            <select
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'list' | 'workspace')}
            >
              <option value="list">This list only</option>
              <option value="workspace">Whole workspace</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={!name.trim()}>
            Create field
          </button>
        </div>
      </div>
    </Modal>
  );
}
