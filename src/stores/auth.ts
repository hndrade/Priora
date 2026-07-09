import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  init: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, loading: false });
    if (data.session) void loadProfile(data.session.user.id);

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, loading: false });
      if (session) void loadProfile(session.user.id);
      else set({ profile: null });
    });

    async function loadProfile(userId: string) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) set({ profile: profile as Profile });
      else {
        // Fallback while the DB trigger hasn't materialized the row yet
        const user = get().session?.user;
        if (user) {
          set({
            profile: {
              id: user.id,
              email: user.email ?? '',
              full_name: (user.user_metadata?.full_name as string) ?? null,
              avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
            },
          });
        }
      }
    }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Return to the app (works both locally and on GitHub Pages)
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // Clear cached workspace data so the next user starts clean
    localStorage.removeItem('priora-data-cache');
    localStorage.removeItem('priora-pending-ops');
    set({ session: null, profile: null });
  },
}));
