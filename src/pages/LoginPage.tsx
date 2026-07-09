import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { supabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-700 p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
          <Rocket size={26} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Priora</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tasks, boards, docs and workflows — ClickUp power with Notion superpowers.
        </p>

        {!supabaseConfigured ? (
          <div className="mt-6 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <strong>Setup required:</strong> define <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file (see README) and rebuild.
          </div>
        ) : (
          <button
            className="btn-outline mt-6 w-full !py-2.5 text-sm font-semibold"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              signInWithGoogle().catch((e: Error) => {
                setError(e.message);
                setBusy(false);
              });
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </button>
        )}

        {error && <div className="mt-3 text-xs text-red-500">{error}</div>}

        <p className="mt-6 text-[11px] text-gray-400">
          Sessions persist across visits. Your data lives in your own Supabase project.
        </p>
      </div>
    </div>
  );
}
