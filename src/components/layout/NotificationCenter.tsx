import { Bell, Check, MessageSquare, Trash2, UserPlus, Clock, AtSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../stores/notifications';
import { useData } from '../../stores/data';
import type { NotificationType } from '../../lib/types';
import { cx, relativeTime } from '../../lib/utils';
import { Dropdown, EmptyState } from '../ui';

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  assigned: <UserPlus size={13} className="text-brand-500" />,
  comment: <MessageSquare size={13} className="text-sky-500" />,
  due_soon: <Clock size={13} className="text-amber-500" />,
  mention: <AtSign size={13} className="text-pink-500" />,
};

export function NotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const tasks = useData((s) => s.tasks);
  const navigate = useNavigate();

  return (
    <Dropdown
      align="right"
      trigger={
        <button className="btn-ghost relative !p-2" title="Notifications" aria-label="Notifications">
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      }
    >
      {(close) => (
        <div className="w-80 sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-700/60">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button className="btn-ghost !px-2 !py-0.5 text-xs text-brand-500" onClick={markAllRead}>
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <EmptyState
                icon={<Bell size={28} />}
                title="You're all caught up"
                hint="Assignments, comments and due-date reminders show up here."
              />
            )}
            {notifications.map((n) => {
              const task = n.task_id ? tasks.find((t) => t.id === n.task_id) : undefined;
              return (
                <div
                  key={n.id}
                  className={cx(
                    'group flex cursor-pointer gap-2.5 border-b border-gray-50 px-3 py-2.5 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-surface-dark-3',
                    !n.read && 'bg-brand-50/50 dark:bg-brand-900/10',
                  )}
                  onClick={() => {
                    markRead(n.id);
                    if (task) {
                      navigate(`/list/${task.list_id}?task=${task.id}`);
                      close();
                    }
                  }}
                >
                  <div className="mt-0.5 shrink-0">{TYPE_ICONS[n.type]}</div>
                  <div className="min-w-0 flex-1">
                    <div className={cx('text-xs leading-snug', !n.read && 'font-semibold')}>{n.message}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400">{relativeTime(n.created_at)}</div>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />}
                    <button
                      className="invisible text-gray-300 hover:text-red-500 group-hover:visible"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                      aria-label="Dismiss notification"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
