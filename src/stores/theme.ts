import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

function initialTheme(): Theme {
  const stored = localStorage.getItem('priora-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('priora-theme', theme);
}

export const useTheme = create<ThemeState>((set, get) => {
  const theme = initialTheme();
  apply(theme);
  return {
    theme,
    toggle: () => get().set(get().theme === 'dark' ? 'light' : 'dark'),
    set: (theme) => {
      apply(theme);
      set({ theme });
    },
  };
});
