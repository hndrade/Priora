import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  CloudOff,
  Home,
  LayoutTemplate,
  List as ListIcon,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Rocket,
  Sun,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../stores/auth';
import { useData } from '../../stores/data';
import { useTheme } from '../../stores/theme';
import { onQueueChange } from '../../lib/offline';
import { cx, displayName } from '../../lib/utils';
import { Avatar, Dropdown, Modal } from '../ui';
import { NotificationCenter } from './NotificationCenter';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { workspaces, currentWorkspaceId, selectWorkspace, createWorkspace, lists, createList, deleteList, inviteMember } =
    useData((s) => ({
      workspaces: s.workspaces,
      currentWorkspaceId: s.currentWorkspaceId,
      selectWorkspace: s.selectWorkspace,
      createWorkspace: s.createWorkspace,
      lists: s.lists.filter((l) => !l.archived),
      createList: s.createList,
      deleteList: s.deleteList,
      inviteMember: s.inviteMember,
    }));
  const navigate = useNavigate();
  const current = workspaces.find((w) => w.id === currentWorkspaceId);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClose}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-dark-3',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );

  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform dark:border-gray-700/60 dark:bg-surface-dark-2 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Workspace switcher */}
      <div className="flex items-center gap-1 border-b border-gray-100 p-3 dark:border-gray-700/60">
        <Dropdown
          className="min-w-0 flex-1"
          trigger={
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-surface-dark-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: current?.color ?? '#7b68ee' }}
              >
                {current?.name?.[0]?.toUpperCase() ?? 'P'}
              </span>
              <span className="truncate text-sm font-bold">{current?.name ?? 'Priora'}</span>
              <ChevronDown size={14} className="ml-auto shrink-0 text-gray-400" />
            </button>
          }
        >
          {(close) => (
            <>
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  className="menu-item"
                  onClick={() => {
                    void selectWorkspace(w.id);
                    close();
                    navigate('/');
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: w.color }}
                  >
                    {w.name[0]?.toUpperCase()}
                  </span>
                  <span className="truncate">{w.name}</span>
                  {w.id === currentWorkspaceId && <Check size={13} className="ml-auto text-brand-500" />}
                </button>
              ))}
              <div className="my-1 border-t border-gray-100 dark:border-gray-700/60" />
              <button
                className="menu-item text-brand-500"
                onClick={() => {
                  const name = window.prompt('Workspace name');
                  if (name?.trim() && profile) {
                    void createWorkspace(name.trim(), profile.id).then(() => navigate('/'));
                  }
                  close();
                }}
              >
                <Plus size={13} /> New workspace
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setInviting(true);
                  close();
                }}
              >
                <UserPlus size={13} /> Invite member
              </button>
            </>
          )}
        </Dropdown>
        <button className="btn-ghost !p-1.5 lg:hidden" onClick={onClose} aria-label="Close sidebar">
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="space-y-0.5 p-2">
        {navItem('/', <Home size={15} />, 'Home')}
        {navItem('/docs', <BookOpen size={15} />, 'Docs & Wiki')}
        {navItem('/templates', <LayoutTemplate size={15} />, 'Templates')}
      </nav>

      {/* Lists */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex items-center justify-between px-2.5 pb-1 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Spaces</span>
          <button className="btn-ghost !p-0.5 text-gray-400" onClick={() => setAddingList(true)} title="New list">
            <Plus size={13} />
          </button>
        </div>
        {lists
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((list) => (
            <div key={list.id} className="group relative">
              <NavLink
                to={`/list/${list.id}`}
                onClick={onClose}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 pr-7 text-sm transition-colors',
                    isActive
                      ? 'bg-brand-50 font-medium text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-dark-3',
                  )
                }
              >
                {list.icon === 'rocket' ? (
                  <Rocket size={14} style={{ color: list.color }} />
                ) : (
                  <ListIcon size={14} style={{ color: list.color }} />
                )}
                <span className="truncate">{list.name}</span>
              </NavLink>
              <button
                className="invisible absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 group-hover:visible"
                title="Delete list"
                onClick={() => {
                  if (window.confirm(`Delete "${list.name}" and all its tasks?`)) {
                    deleteList(list.id);
                    navigate('/');
                  }
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        {addingList && (
          <input
            autoFocus
            className="input mt-1 !py-1 text-sm"
            placeholder="List name…"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onBlur={() => {
              setAddingList(false);
              setNewListName('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newListName.trim()) {
                const id = createList(newListName.trim());
                setNewListName('');
                setAddingList(false);
                navigate(`/list/${id}`);
              }
              if (e.key === 'Escape') setAddingList(false);
            }}
          />
        )}
        {lists.length === 0 && !addingList && (
          <button
            className="mx-2.5 mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500"
            onClick={() => setAddingList(true)}
          >
            <Plus size={12} /> Create your first list
          </button>
        )}
      </div>

      <SyncStatus />

      {inviting && (
        <Modal open onClose={() => setInviting(false)} title="Invite member">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            The person must have signed in to Priora at least once with Google. Then their email will resolve
            to an account you can add to this workspace.
          </p>
          <input
            autoFocus
            type="email"
            className="input"
            placeholder="teammate@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          {inviteMsg && <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">{inviteMsg}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setInviting(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!inviteEmail.includes('@')}
              onClick={() => {
                void inviteMember(inviteEmail).then((err) => {
                  if (err) setInviteMsg(err);
                  else {
                    setInviting(false);
                    setInviteEmail('');
                    setInviteMsg(null);
                  }
                });
              }}
            >
              Invite
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}

function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const offline = useData((s) => s.offline);

  useEffect(() => {
    const off = onQueueChange((count, s) => {
      setPending(count);
      setSyncing(s);
    });
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      off();
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online && pending === 0 && !syncing && !offline) return null;
  return (
    <div className="border-t border-gray-100 px-3 py-2 text-[11px] font-medium dark:border-gray-700/60">
      {!online || offline ? (
        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <CloudOff size={12} />
          Offline — changes saved locally{pending > 0 && ` (${pending} pending)`}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-brand-500">
          <RefreshCw size={12} className={cx(syncing && 'animate-spin')} />
          Syncing {pending} change{pending === 1 ? '' : 's'}…
        </span>
      )}
    </div>
  );
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 dark:border-gray-700/60 dark:bg-surface-dark-2">
      <button className="btn-ghost !p-2 lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={17} />
      </button>
      <div className="hidden items-center gap-1.5 text-sm font-bold text-brand-500 sm:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Rocket size={13} />
        </span>
        Priora
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button className="btn-ghost !p-2" onClick={toggle} title="Toggle dark mode" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <NotificationCenter />
        <Dropdown
          align="right"
          trigger={
            <button className="ml-1 rounded-full ring-2 ring-transparent transition-shadow hover:ring-brand-300" aria-label="Account">
              <Avatar profile={profile} size={28} />
            </button>
          }
        >
          <div className="px-3 py-2">
            <div className="text-sm font-semibold">{displayName(profile)}</div>
            <div className="text-xs text-gray-400">{profile?.email}</div>
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700/60" />
          <button
            className="menu-item"
            onClick={() => {
              void signOut().then(() => navigate('/login'));
            }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
