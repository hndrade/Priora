-- ============================================================
-- Priora — Supabase schema
-- Run this file in the Supabase SQL editor (or `supabase db push`)
-- ============================================================

-- ---------- Profiles (mirrors auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up (Google OAuth included)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Workspaces & membership ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#7b68ee',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Helper used by nearly every policy. SECURITY DEFINER dodges RLS recursion.
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Owner automatically becomes a member
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- ---------- Lists (a.k.a. pages/projects inside a workspace) ----------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  icon text not null default 'list',
  color text not null default '#7b68ee',
  position double precision not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Status columns (Kanban) ----------
create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text not null default '#87909e',
  kind text not null default 'custom' check (kind in ('todo', 'in_progress', 'done', 'custom')),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Tags ----------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text not null default '#7b68ee',
  created_at timestamptz not null default now()
);

-- ---------- Custom fields (Notion-style properties) ----------
create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  list_id uuid references public.lists (id) on delete cascade, -- null = workspace-wide
  name text not null,
  type text not null check (type in ('text', 'number', 'select', 'date', 'checkbox', 'url')),
  options jsonb not null default '[]'::jsonb, -- for select: [{label, color}]
  created_at timestamptz not null default now()
);

-- ---------- Tasks ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  column_id uuid references public.columns (id) on delete set null,
  title text not null,
  description text not null default '',
  priority text not null default 'none' check (priority in ('urgent', 'high', 'normal', 'low', 'none')),
  due_date timestamptz,
  start_date timestamptz,
  assignees uuid[] not null default '{}',
  tag_ids uuid[] not null default '{}',
  custom_values jsonb not null default '{}'::jsonb, -- {field_id: value}
  position double precision not null default 0,
  archived boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_workspace_idx on public.tasks (workspace_id);
create index if not exists tasks_list_idx on public.tasks (list_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------- Task relations (Notion-style relational links) ----------
create table if not exists public.task_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  related_task_id uuid not null references public.tasks (id) on delete cascade,
  relation_type text not null default 'related' check (relation_type in ('related', 'blocks', 'blocked_by', 'duplicates', 'parent', 'subtask')),
  created_at timestamptz not null default now(),
  unique (task_id, related_task_id, relation_type)
);

-- ---------- Views (Notion-style multiple views over the same data) ----------
create table if not exists public.views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  name text not null,
  type text not null default 'board' check (type in ('board', 'list', 'table', 'calendar')),
  config jsonb not null default '{}'::jsonb, -- {groupBy, filters, sorts, rollups, visibleFields}
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Templates (Notion-style reusable templates) ----------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text not null default '',
  type text not null default 'task' check (type in ('task', 'list')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Docs (Notion-style wiki with hierarchy) ----------
create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_id uuid references public.docs (id) on delete cascade,
  title text not null default 'Untitled',
  icon text not null default '📄',
  content text not null default '',
  linked_task_ids uuid[] not null default '{}',
  position double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs
  for each row execute function public.touch_updated_at();

-- ---------- Comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_task_idx on public.comments (task_id);

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  type text not null check (type in ('assigned', 'comment', 'due_soon', 'mention')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read);

-- Notify newly assigned users when a task's assignees change
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_assignee uuid;
  actor_name text;
begin
  select coalesce(full_name, email) into actor_name
    from public.profiles where id = auth.uid();

  foreach new_assignee in array new.assignees loop
    if (tg_op = 'INSERT' or not (new_assignee = any (coalesce(old.assignees, '{}'))))
       and new_assignee is distinct from auth.uid() then
      insert into public.notifications (user_id, workspace_id, task_id, type, message)
      values (
        new_assignee, new.workspace_id, new.id, 'assigned',
        coalesce(actor_name, 'Someone') || ' assigned you to "' || new.title || '"'
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_task_assigned on public.tasks;
create trigger on_task_assigned
  after insert or update of assignees on public.tasks
  for each row execute function public.notify_task_assignment();

-- Notify assignees and task creator when a comment is added
create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  t record;
  target uuid;
  targets uuid[];
  actor_name text;
begin
  select * into t from public.tasks where id = new.task_id;
  if t is null then return new; end if;

  select coalesce(full_name, email) into actor_name
    from public.profiles where id = new.author_id;

  targets := t.assignees;
  if t.created_by is not null and not (t.created_by = any (targets)) then
    targets := targets || t.created_by;
  end if;

  foreach target in array targets loop
    if target is distinct from new.author_id then
      insert into public.notifications (user_id, workspace_id, task_id, type, message)
      values (
        target, new.workspace_id, new.task_id, 'comment',
        coalesce(actor_name, 'Someone') || ' commented on "' || t.title || '"'
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.notify_comment();

-- Due-soon notifications: called by the client on load; idempotent per task/day.
create or replace function public.generate_due_soon_notifications()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, workspace_id, task_id, type, message)
  select a.assignee, t.workspace_id, t.id, 'due_soon',
         '"' || t.title || '" is due ' ||
         case when t.due_date < now() then 'now (overdue)'
              else 'within 24 hours' end
  from public.tasks t
  cross join lateral unnest(t.assignees) as a(assignee)
  where t.completed_at is null
    and t.archived = false
    and t.due_date is not null
    and t.due_date < now() + interval '24 hours'
    and a.assignee = auth.uid()
    and not exists (
      select 1 from public.notifications n
      where n.task_id = t.id
        and n.user_id = a.assignee
        and n.type = 'due_soon'
        and n.created_at > now() - interval '20 hours'
    );
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.lists enable row level security;
alter table public.columns enable row level security;
alter table public.tags enable row level security;
alter table public.custom_fields enable row level security;
alter table public.tasks enable row level security;
alter table public.task_relations enable row level security;
alter table public.views enable row level security;
alter table public.templates enable row level security;
alter table public.docs enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

-- Profiles: readable by any signed-in user (needed to render avatars/assignees)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- Workspaces
drop policy if exists "workspaces_select" on public.workspaces;
create policy "workspaces_select" on public.workspaces
  for select using (public.is_workspace_member(id));
drop policy if exists "workspaces_insert" on public.workspaces;
create policy "workspaces_insert" on public.workspaces
  for insert with check (owner_id = auth.uid());
drop policy if exists "workspaces_update" on public.workspaces;
create policy "workspaces_update" on public.workspaces
  for update using (owner_id = auth.uid());
drop policy if exists "workspaces_delete" on public.workspaces;
create policy "workspaces_delete" on public.workspaces
  for delete using (owner_id = auth.uid());

-- Workspace members
drop policy if exists "members_select" on public.workspace_members;
create policy "members_select" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists "members_insert" on public.workspace_members;
create policy "members_insert" on public.workspace_members
  for insert with check (
    public.is_workspace_member(workspace_id) or
    exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );
drop policy if exists "members_delete" on public.workspace_members;
create policy "members_delete" on public.workspace_members
  for delete using (
    user_id = auth.uid() or
    exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );

-- Generic member policies for workspace-scoped content tables
do $$
declare
  tbl text;
begin
  foreach tbl in array array['lists','columns','tags','custom_fields','tasks','task_relations','views','templates','docs','comments'] loop
    execute format('drop policy if exists "%s_select" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_select" on public.%I for select using (public.is_workspace_member(workspace_id))',
      tbl, tbl);
    execute format('drop policy if exists "%s_insert" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_insert" on public.%I for insert with check (public.is_workspace_member(workspace_id))',
      tbl, tbl);
    execute format('drop policy if exists "%s_update" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_update" on public.%I for update using (public.is_workspace_member(workspace_id))',
      tbl, tbl);
    execute format('drop policy if exists "%s_delete" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_delete" on public.%I for delete using (public.is_workspace_member(workspace_id))',
      tbl, tbl);
  end loop;
end $$;

-- Notifications: strictly personal
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid());
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete using (user_id = auth.uid());

-- ============================================================
-- Realtime
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table
      public.tasks, public.columns, public.lists, public.comments,
      public.notifications, public.views, public.tags, public.docs,
      public.custom_fields, public.templates, public.task_relations;
  exception when duplicate_object then null;
  end;
end $$;
