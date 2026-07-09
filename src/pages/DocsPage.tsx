import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Eye,
  Link2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useData } from '../stores/data';
import type { Doc } from '../lib/types';
import { cx, relativeTime } from '../lib/utils';
import { EmptyState } from '../components/ui';
import { TaskModal } from '../components/task/TaskModal';

export function DocsPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { docs, createDoc } = useData((s) => ({ docs: s.docs, createDoc: s.createDoc }));
  const activeDoc = docs.find((d) => d.id === docId);
  const roots = docs.filter((d) => !d.parent_id).sort((a, b) => a.position - b.position);

  return (
    <div className="flex h-full">
      {/* Doc tree */}
      <div className="hidden w-60 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700/60 sm:flex">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Wiki</span>
          <button
            className="btn-ghost !p-1 text-gray-400"
            title="New page"
            onClick={() => navigate(`/docs/${createDoc(null)}`)}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {roots.map((doc) => (
            <DocTreeItem key={doc.id} doc={doc} depth={0} activeId={docId} />
          ))}
          {roots.length === 0 && (
            <div className="px-2 text-xs text-gray-400">No pages yet.</div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {activeDoc ? (
          <DocEditor key={activeDoc.id} doc={activeDoc} />
        ) : (
          <EmptyState
            icon={<BookOpen size={34} />}
            title="Workspace wiki"
            hint="Notion-style pages with markdown, nesting and task links. Keep specs, meeting notes and processes next to the work itself."
            action={
              <button className="btn-primary mt-2" onClick={() => navigate(`/docs/${createDoc(null)}`)}>
                <Plus size={14} /> New page
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

function DocTreeItem({ doc, depth, activeId }: { doc: Doc; depth: number; activeId?: string }) {
  const navigate = useNavigate();
  const { docs, createDoc } = useData((s) => ({ docs: s.docs, createDoc: s.createDoc }));
  const children = docs.filter((d) => d.parent_id === doc.id).sort((a, b) => a.position - b.position);
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div
        className={cx(
          'group flex cursor-pointer items-center gap-1 rounded-lg py-1 pr-1 text-sm',
          activeId === doc.id
            ? 'bg-brand-50 font-medium text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-dark-3',
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => navigate(`/docs/${doc.id}`)}
      >
        <button
          className="shrink-0 text-gray-400"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {children.length > 0 ? (
            open ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <span className="inline-block w-3" />
          )}
        </button>
        <span className="shrink-0 text-xs">{doc.icon}</span>
        <span className="min-w-0 flex-1 truncate">{doc.title}</span>
        <button
          className="invisible shrink-0 text-gray-300 hover:text-brand-500 group-hover:visible"
          title="Add sub-page"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/docs/${createDoc(doc.id)}`);
          }}
        >
          <Plus size={12} />
        </button>
      </div>
      {open && children.map((c) => <DocTreeItem key={c.id} doc={c} depth={depth + 1} activeId={activeId} />)}
    </div>
  );
}

function DocEditor({ doc }: { doc: Doc }) {
  const navigate = useNavigate();
  const { updateDoc, deleteDoc, tasks } = useData((s) => ({
    updateDoc: s.updateDoc,
    deleteDoc: s.deleteDoc,
    tasks: s.tasks,
  }));
  const [content, setContent] = useState(doc.content);
  const [preview, setPreview] = useState(doc.content.length > 0);
  const [linkQuery, setLinkQuery] = useState('');
  const [linking, setLinking] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const linkedTasks = doc.linked_task_ids
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const candidates = useMemo(
    () =>
      linkQuery.trim()
        ? tasks
            .filter(
              (t) => !doc.linked_task_ids.includes(t.id) && t.title.toLowerCase().includes(linkQuery.toLowerCase()),
            )
            .slice(0, 6)
        : [],
    [linkQuery, tasks, doc.linked_task_ids],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <div className="flex items-start gap-2">
        <button
          className="text-3xl"
          title="Change icon"
          onClick={() => {
            const icon = window.prompt('Emoji for this page', doc.icon);
            if (icon) updateDoc(doc.id, { icon: icon.trim().slice(0, 4) });
          }}
        >
          {doc.icon}
        </button>
        <input
          className="w-full bg-transparent text-3xl font-extrabold tracking-tight outline-none placeholder:text-gray-300"
          defaultValue={doc.title}
          placeholder="Untitled"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== doc.title) updateDoc(doc.id, { title: v });
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <div className="flex shrink-0 items-center gap-1 pt-2">
          <button
            className="btn-ghost !p-1.5"
            title={preview ? 'Edit' : 'Preview'}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? <Pencil size={14} /> : <Eye size={14} />}
          </button>
          <button
            className="btn-ghost !p-1.5 hover:!text-red-500"
            title="Delete page"
            onClick={() => {
              if (window.confirm(`Delete "${doc.title}" and its sub-pages?`)) {
                deleteDoc(doc.id);
                navigate('/docs');
              }
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-gray-400">Updated {relativeTime(doc.updated_at)}</div>

      {/* Linked tasks — the wiki page stays connected to real work */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {linkedTasks.map((t) => (
          <span
            key={t.id}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs hover:border-brand-400 dark:border-gray-700"
            onClick={() => setOpenTaskId(t.id)}
          >
            <Link2 size={10} className="text-brand-500" />
            <span className={cx('max-w-[160px] truncate', t.completed_at && 'line-through text-gray-400')}>
              {t.title}
            </span>
            <button
              className="text-gray-300 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                updateDoc(doc.id, { linked_task_ids: doc.linked_task_ids.filter((id) => id !== t.id) });
              }}
              aria-label="Unlink task"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="relative">
          <button className="btn-ghost !px-2 !py-0.5 text-xs text-gray-400" onClick={() => setLinking((l) => !l)}>
            <Plus size={11} /> Link task
          </button>
          {linking && (
            <div className="menu-panel absolute left-0 top-full mt-1 w-64 p-2">
              <input
                autoFocus
                className="input !py-1 text-xs"
                placeholder="Search tasks…"
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
              />
              {candidates.map((t) => (
                <button
                  key={t.id}
                  className="menu-item mt-0.5 rounded"
                  onClick={() => {
                    updateDoc(doc.id, { linked_task_ids: [...doc.linked_task_ids, t.id] });
                    setLinkQuery('');
                    setLinking(false);
                  }}
                >
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-5">
        {preview ? (
          <div
            className="prose-priora min-h-[300px] cursor-text"
            onDoubleClick={() => setPreview(false)}
          >
            {content.trim() ? (
              <MarkdownPreview text={content} />
            ) : (
              <span className="text-sm text-gray-400">Double-click to start writing…</span>
            )}
          </div>
        ) : (
          <textarea
            autoFocus
            className="min-h-[420px] w-full resize-y bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-gray-400"
            placeholder={
              'Write in markdown…\n\n# Heading\n## Subheading\n- bullet list\n- [ ] todo item\n**bold**, *italic*, `code`\n> quote'
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => {
              if (content !== doc.content) updateDoc(doc.id, { content });
            }}
          />
        )}
      </div>

      <TaskModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}

/** Minimal dependency-free markdown renderer (headings, lists, todos, quotes, inline styles). */
function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let listBuffer: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length) {
      out.push(
        <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-sm">
          {listBuffer}
        </ul>,
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    const key = `l${i}`;
    const todo = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (todo) {
      listBuffer.push(
        <li key={key} className="flex list-none items-start gap-2 -ml-5">
          <input type="checkbox" readOnly checked={todo[1].toLowerCase() === 'x'} className="mt-1 accent-brand-500" />
          <span className={cx(todo[1].toLowerCase() === 'x' && 'text-gray-400 line-through')}>
            <Inline text={todo[2]} />
          </span>
        </li>,
      );
      return;
    }
    if (bullet) {
      listBuffer.push(
        <li key={key}>
          <Inline text={bullet[1]} />
        </li>,
      );
      return;
    }
    flushList(`ul${i}`);
    if (line.startsWith('### ')) out.push(<h3 key={key} className="mt-4 text-base font-bold"><Inline text={line.slice(4)} /></h3>);
    else if (line.startsWith('## ')) out.push(<h2 key={key} className="mt-5 text-lg font-bold"><Inline text={line.slice(3)} /></h2>);
    else if (line.startsWith('# ')) out.push(<h1 key={key} className="mt-5 text-xl font-extrabold"><Inline text={line.slice(2)} /></h1>);
    else if (line.startsWith('> '))
      out.push(
        <blockquote key={key} className="my-2 border-l-2 border-brand-400 pl-3 text-sm italic text-gray-500 dark:text-gray-400">
          <Inline text={line.slice(2)} />
        </blockquote>,
      );
    else if (line.trim() === '---') out.push(<hr key={key} className="my-4 border-gray-200 dark:border-gray-700" />);
    else if (line.trim() === '') out.push(<div key={key} className="h-2" />);
    else
      out.push(
        <p key={key} className="my-1 text-sm leading-relaxed">
          <Inline text={line} />
        </p>,
      );
  });
  flushList('ul-end');
  return <div>{out}</div>;
}

function Inline({ text }: { text: string }) {
  // Tokenize **bold**, *italic*, `code`, [label](url)
  const parts: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;
  while (rest.length > 0) {
    const m = rest.match(pattern);
    if (!m || m.index === undefined) {
      parts.push(rest);
      break;
    }
    if (m.index > 0) parts.push(rest.slice(0, m.index));
    const token = m[0];
    if (token.startsWith('**')) parts.push(<strong key={k++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`'))
      parts.push(
        <code key={k++} className="rounded bg-gray-100 px-1 py-0.5 text-[12px] dark:bg-surface-dark-3">
          {token.slice(1, -1)}
        </code>,
      );
    else if (token.startsWith('['))
      {
        const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        parts.push(
          <a key={k++} href={lm?.[2]} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
            {lm?.[1]}
          </a>,
        );
      }
    else parts.push(<em key={k++}>{token.slice(1, -1)}</em>);
    rest = rest.slice(m.index + token.length);
  }
  return <>{parts}</>;
}
