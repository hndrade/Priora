import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AppNotification } from '../lib/types';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  init: (userId: string) => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
}

let channel: RealtimeChannel | null = null;

export const useNotifications = create<NotificationState>((set, get) => {
  function recount(notifications: AppNotification[]) {
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
  }

  return {
    notifications: [],
    unreadCount: 0,

    init: async (userId: string) => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);
        recount((data as AppNotification[]) ?? []);
      } catch {
        /* offline */
      }

      if (channel) void supabase.removeChannel(channel);
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as AppNotification;
            if (get().notifications.some((x) => x.id === n.id)) return;
            recount([n, ...get().notifications]);
          },
        )
        .subscribe();
    },

    markRead: (id: string) => {
      recount(get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
      void supabase.from('notifications').update({ read: true }).eq('id', id).then();
    },

    markAllRead: () => {
      const unread = get().notifications.filter((n) => !n.read);
      recount(get().notifications.map((n) => ({ ...n, read: true })));
      if (unread.length) {
        void supabase
          .from('notifications')
          .update({ read: true })
          .in(
            'id',
            unread.map((n) => n.id),
          )
          .then();
      }
    },

    remove: (id: string) => {
      recount(get().notifications.filter((n) => n.id !== id));
      void supabase.from('notifications').delete().eq('id', id).then();
    },
  };
});
