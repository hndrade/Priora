# Priora

A full-featured, ClickUp-style task management app enriched with Notion superpowers — built with **React 18 + TypeScript + Tailwind CSS**, backed by **Supabase** (PostgreSQL, Google OAuth, Realtime) and deployed as a static SPA to **GitHub Pages**.

![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/TypeScript-5-3178c6) ![stack](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth%20%2B%20Realtime-3ecf8e) ![stack](https://img.shields.io/badge/Tailwind-3-38bdf8)

---

## Features

### ClickUp core
- **Tasks** — create, edit, delete, archive; descriptions, threaded comments, priorities (Urgent/High/Normal/Low), start & due dates, multi-assignees
- **Kanban boards** — unlimited columns of typed kinds (`To Do`, `In Progress`, `Done`, custom), native drag-and-drop between columns with precise drop positioning, inline column create/rename/delete
- **Grouping** — group any view by status, priority, assignee, due date, tag, or any *select* custom field; dropping a card into a group updates that property (drop into a priority group ⇒ priority changes)
- **Filtering** — by status, priority, assignee, tags, due window (overdue/today/7 days/none), archived, plus full-text search; filters are saved per view
- **Tags** — workspace-level customizable tags with colors, created inline from any task
- **Unlimited structure** — create as many workspaces, lists (spaces), views, docs and tasks as you want
- **Notification center** — bell icon with unread badge; notified when you're assigned, when someone comments on your task, and when a deadline is <24 h away (server-generated, idempotent). Clicking a notification jumps straight to the task.
- **ClickUp-style UI** — brand purple `#7b68ee`, left sidebar with workspace switcher and spaces tree, top toolbar with view tabs, Inter typography, card shadows
- **Dark mode** — one-click toggle, persisted locally, applied before first paint (no flash)
- **Responsive** — desktop 3-pane layout, tablet, and mobile (collapsible sidebar drawer, compact toolbars)

### Notion features integrated (and why)

| Feature | What it does | Why it adds value over stock ClickUp |
|---|---|---|
| **Multiple flexible views** | Every list holds *N* saved views (Board, List, Table, Calendar), each with its **own** group-by, sort, filters and rollups, stored in the database and shared with the team | Notion's "same database, many lenses" model: PMs keep a filtered table, engineers a board, leads a calendar — all over the same tasks, no duplication |
| **Custom fields (properties)** | Text, number, select, date, checkbox and URL fields, scoped per-list or workspace-wide; editable inline in the task panel and shown as table columns | Turns a task list into a real relational database — story points, budgets, client names, launch flags — without leaving the tool |
| **Rollups / aggregations** | Per-group and per-table aggregations: count, count done, % complete, and **sum/avg of any number field**, rendered in board column footers and table footers; configurable per view | Notion's rollup synthesis: see total story points per sprint column or budget sum per client at a glance |
| **Relational task links** | First-class relations between tasks: *blocks / blocked-by / duplicates / parent / subtask / related*, bidirectional and visible from both sides | Models real dependency graphs the way Notion relations do — richer than flat checklists |
| **Reusable templates** | Save any task as a template; ship whole *list* templates (columns + pre-seeded tasks with relative due dates, tags, subtasks). Starter pack included: Sprint board, Bug report, Client onboarding, Weekly 1:1 | Encodes repeatable workflows — one click spawns an entire onboarding board with deadlines already offset from today |
| **Wiki / Docs** | Nested pages with emoji icons, markdown editing + live preview (headings, todos, quotes, links, code), and **task linking** so a spec page shows the live status of its implementation tasks | Notion's killer feature: knowledge lives next to execution. A PRD links to its tasks; done tasks show struck-through on the page |

### Realtime & offline
- **Realtime sync** — Supabase Realtime channels per workspace stream every table (tasks, columns, comments, views, docs, notifications…) to all connected clients instantly
- **Offline-first** — all mutations are optimistic; when offline they queue in `localStorage` and replay **in order** on reconnect. The full workspace snapshot is cached locally, so the app opens and works with no network. A sync indicator in the sidebar shows pending changes.

### Auth
- **Google OAuth** via Supabase Auth, session persistence with auto-refresh, secure sign-out that clears local caches.

---

## Project structure

```
├── .github/workflows/deploy.yml   # CI/CD → GitHub Pages
├── supabase/schema.sql            # Full DB schema, triggers, RLS, realtime
├── src/
│   ├── lib/
│   │   ├── supabase.ts            # Client (graceful when unconfigured)
│   │   ├── types.ts               # All domain types
│   │   ├── offline.ts             # Ordered offline mutation queue
│   │   ├── grouping.ts            # Group-by / filter / sort / rollup engine
│   │   └── utils.ts
│   ├── stores/                    # Zustand global state
│   │   ├── auth.ts                # Session + profile
│   │   ├── data.ts                # Workspace data, optimistic CRUD, realtime
│   │   ├── notifications.ts       # Notification center + realtime inserts
│   │   └── theme.ts               # Light/dark with persistence
│   ├── components/
│   │   ├── layout/                # Sidebar, topbar, notification center
│   │   ├── task/                  # Task modal, card, pickers, custom fields
│   │   ├── views/                 # Board, List, Table, Calendar + toolbar
│   │   └── ui.tsx                 # Modal, dropdown, avatar primitives
│   └── pages/                     # Login, Home, List, Docs, Templates
```

---

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open **SQL Editor** → paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates all tables, notification triggers, Row Level Security policies and the realtime publication.
3. Grab your credentials from **Project Settings → API**: the *Project URL* and the *anon public* key.

### 2. Configure Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials → Create Credentials → OAuth client ID** (type *Web application*).
2. Add the **authorized redirect URI** shown in Supabase under **Authentication → Providers → Google** (looks like `https://<ref>.supabase.co/auth/v1/callback`).
3. Copy the Google *Client ID* and *Client Secret* into Supabase **Authentication → Providers → Google** and enable the provider.
4. In Supabase **Authentication → URL Configuration**, set:
   - **Site URL**: `https://<your-user>.github.io/Priora/`
   - **Additional redirect URLs**: `http://localhost:5173/` (for local dev)

### 3. Environment variables

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> The anon key is safe to expose in a static frontend — all data access is enforced by Row Level Security in Postgres.

### 4. Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands: `npm run build` (production build), `npm run preview`, `npm run typecheck`.

---

## Deploy to GitHub Pages (CI/CD)

The repo ships with a GitHub Actions workflow that builds and publishes on every push to `main`.

1. **Repository → Settings → Pages** → *Build and deployment* → **Source: GitHub Actions**.
2. **Repository → Settings → Secrets and variables → Actions** → add two repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push to `main`. The workflow (`.github/workflows/deploy.yml`) runs `npm ci && npm run build`, adds a SPA fallback, and deploys `dist/` to Pages.
4. Your app is live at `https://<your-user>.github.io/Priora/`.

> **Different repo name or custom domain?** The Vite base path defaults to `/Priora/`. Override it at build time with `VITE_BASE=/your-repo-name/` (or `/` for a custom domain). The app uses hash-based routing, so deep links survive static hosting without server rewrites.

---

## How the harder parts work

**Realtime** — one Supabase channel per workspace subscribes to `postgres_changes` filtered by `workspace_id` for every content table; incoming rows are upserted into the Zustand store, so edits by teammates appear live. Notifications use a personal channel filtered by `user_id`.

**Offline** — every write is applied to the store immediately and pushed through `lib/offline.ts`. If the network is down (or something is already queued, to preserve ordering) the op lands in a `localStorage` queue that flushes on the browser `online` event. Row IDs are generated client-side (`crypto.randomUUID()`), so creates, edits and deletes compose correctly offline. The full workspace snapshot is also cached, letting the app boot with zero connectivity.

**Notifications** — Postgres triggers create rows on assignment and comment inserts (skipping the actor). Due-soon notifications are produced by an idempotent `security definer` function the client calls on load, deduplicated per task per ~20 h window.

**Security** — RLS everywhere: workspace content is only visible to members (checked via a `security definer` helper to avoid policy recursion), notifications are strictly personal, and profile rows are auto-created by an auth trigger on signup.
