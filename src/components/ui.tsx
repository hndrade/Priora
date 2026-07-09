import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Profile } from '../lib/types';
import { avatarColor, cx, displayName, initials } from '../lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx(
          'card w-full shadow-modal animate-in',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-700/60">
            <div className="text-sm font-semibold">{title}</div>
            <button className="btn-ghost !p-1" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Dropdown({
  trigger,
  children,
  align = 'left',
  className,
}: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className={cx('relative', className)} ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className={cx('menu-panel absolute mt-1', align === 'right' ? 'right-0' : 'left-0')}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function Avatar({ profile, size = 24 }: { profile: Profile | undefined | null; size?: number }) {
  const label = displayName(profile);
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={label}
        title={label}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      title={label}
      className="flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: profile ? avatarColor(profile.id) : '#87909e',
      }}
    >
      {profile ? initials(profile) : '?'}
    </div>
  );
}

export function AvatarStack({ profiles, size = 22 }: { profiles: (Profile | undefined)[]; size?: number }) {
  return (
    <div className="flex -space-x-1.5">
      {profiles.slice(0, 4).map((p, i) => (
        <div key={p?.id ?? i} className="rounded-full ring-2 ring-white dark:ring-surface-dark-2">
          <Avatar profile={p} size={size} />
        </div>
      ))}
      {profiles.length > 4 && (
        <div
          className="flex items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 ring-2 ring-white dark:bg-gray-700 dark:text-gray-300 dark:ring-surface-dark-2"
          style={{ width: size, height: size }}
        >
          +{profiles.length - 4}
        </div>
      )}
    </div>
  );
}

export function Chip({
  color,
  children,
  onRemove,
}: {
  color: string;
  children: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: color + '26', color }}
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label="Remove">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="text-gray-300 dark:text-gray-600">{icon}</div>
      <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</div>
      {hint && <div className="max-w-xs text-xs text-gray-400 dark:text-gray-500">{hint}</div>}
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex h-full min-h-[200px] w-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}
