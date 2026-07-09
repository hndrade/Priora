# Self-hosting Supabase for Priora

Use this guide when the Supabase cloud free tier isn't an option (e.g. the 2-active-projects
limit). The self-hosted stack exposes the exact same APIs, so **no app code changes are
needed** — only the values of `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` change.

## What you need

| Requirement | Recommendation |
|---|---|
| Server | Oracle Cloud **Always Free** ARM VM (up to 4 vCPU / 24 GB, São Paulo region, R$0) — fallback: Vultr/DigitalOcean São Paulo (~US$6–12/mo). **Min 2 GB RAM, ideal 4 GB.** |
| OS | Ubuntu 24.04 |
| Domain | A subdomain pointing at the VM, e.g. `api.yourdomain.com` (Google OAuth requires a stable HTTPS origin; DuckDNS works if you have no domain) |
| Ports | 80 and 443 open in the firewall / cloud security list |

## 1. Install Coolify

Coolify is a free self-hosted PaaS that ships a one-click Supabase template and handles
TLS (Let's Encrypt), restarts and updates:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open the Coolify panel (port 8000 on first boot), create the admin account.

> Prefer raw Docker? The official stack lives at
> `https://github.com/supabase/supabase/tree/master/docker` — copy `docker/`,
> fill `.env` from `.env.example`, put Caddy/Traefik in front for HTTPS. Everything
> below about GoTrue env vars applies the same way.

## 2. Deploy the Supabase stack

1. In Coolify: **New Resource → Service → Supabase**.
2. Set the service domain to `https://api.yourdomain.com` — Coolify issues the TLS cert.
3. Save the generated secrets from the stack's `.env`: `ANON_KEY`, `SERVICE_ROLE_KEY`,
   `JWT_SECRET`, the Postgres password, and the Studio (dashboard) credentials.
4. Open the self-hosted **Studio → SQL Editor** and run the full contents of
   [`../supabase/schema.sql`](../supabase/schema.sql). Alternatively:

   ```bash
   psql "postgresql://postgres:<password>@api.yourdomain.com:5432/postgres" -f supabase/schema.sql
   ```

5. Realtime is enabled by default in the template — the schema already adds every table
   to the `supabase_realtime` publication.

## 3. Google OAuth (GoTrue has no providers UI when self-hosted)

Edit the stack's `.env` in Coolify (service → Environment Variables), then restart:

```env
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<your-google-client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<your-google-client-secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/v1/callback
GOTRUE_SITE_URL=https://<your-user>.github.io/Priora/
GOTRUE_URI_ALLOW_LIST=https://<your-user>.github.io/Priora/,http://localhost:5173/
```

In [Google Cloud Console](https://console.cloud.google.com) → Credentials → your OAuth
client, add the authorized redirect URI:

```
https://api.yourdomain.com/auth/v1/callback
```

## 4. Point the app at the new backend

Local development (`.env`):

```env
VITE_SUPABASE_URL=https://api.yourdomain.com
VITE_SUPABASE_ANON_KEY=<ANON_KEY from the stack>
```

Production: update the two repository secrets in
**GitHub → Settings → Secrets and variables → Actions**
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and re-run the *Deploy to GitHub Pages*
workflow.

## 5. Minimal operations

- **Backups** — nightly `pg_dump` to external storage, e.g. crontab:

  ```cron
  0 3 * * * pg_dump "postgresql://postgres:<password>@localhost:5432/postgres" | gzip > /backups/priora-$(date +\%F).sql.gz
  ```

- **Updates** — pull new stack images from the Coolify service page.
- **Monitoring** — Coolify shows container health; set an uptime check on
  `https://api.yourdomain.com/auth/v1/health`.

## Verification checklist

1. `npm run dev` with the new `.env` → Google login completes and returns to the app.
2. Create a workspace/list/task; open two tabs → realtime sync is instant.
3. Comment on a task from a second account → notification bell fires (DB triggers OK).
4. DevTools → Network → Offline → create/edit tasks → back online → the sidebar sync
   indicator drains the queue.
5. Re-run the deploy workflow → test the published app on GitHub Pages.

## Plan B

If the VM route stalls (Oracle signup refused, no capacity), create a **new Supabase cloud
account** with another e-mail (e.g. a `+priora` alias) and follow the standard cloud setup
in the [README](../README.md#setup) — 15 minutes, zero server maintenance.
