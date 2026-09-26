-- HabitPulse schema: habits + daily check-ins, health metrics + entries.
-- Everything is scoped to auth.uid() via RLS; analytics live in Postgres views.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.habits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  emoji           text not null default '✅',
  color           text not null default '#10b981',
  target_per_week int  not null default 7 check (target_per_week between 1 and 7),
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz
);

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  log_date   date not null default current_date,
  note       text,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table public.metrics (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key     text not null check (key ~ '^[a-z0-9_]+$'),
  label   text not null,
  unit    text not null default '',
  color   text not null default '#3b82f6',
  unique (user_id, key)
);

create table public.metric_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric_id  uuid not null references public.metrics (id) on delete cascade,
  entry_date date not null,
  value      numeric not null,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (metric_id, entry_date)
);

create index habit_logs_habit_date_idx     on public.habit_logs (habit_id, log_date desc);
create index metric_entries_metric_date_idx on public.metric_entries (metric_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user sees and edits only their own rows.
-- ---------------------------------------------------------------------------

alter table public.habits         enable row level security;
alter table public.habit_logs     enable row level security;
alter table public.metrics        enable row level security;
alter table public.metric_entries enable row level security;

create policy "own habits"         on public.habits         for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own habit_logs"     on public.habit_logs     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own metrics"        on public.metrics        for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own metric_entries" on public.metric_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Streaks: gaps-and-islands with window functions.
-- Consecutive dates share the same (log_date - row_number) group key.
-- ---------------------------------------------------------------------------

create or replace view public.habit_streaks
with (security_invoker = true) as
with runs as (
  select
    habit_id,
    log_date,
    log_date - (row_number() over (partition by habit_id order by log_date))::int as grp
  from public.habit_logs
),
islands as (
  select habit_id, min(log_date) as start_date, max(log_date) as end_date, count(*)::int as length
  from runs
  group by habit_id, grp
),
current as (
  -- a streak is "current" if it reaches today or yesterday
  select distinct on (habit_id) habit_id, length
  from islands
  where end_date >= current_date - 1
  order by habit_id, end_date desc
),
best as (
  select habit_id, max(length) as length from islands group by habit_id
),
recent as (
  select
    habit_id,
    count(*) filter (where log_date >= current_date - 6)::int  as done_last_7,
    count(*) filter (where log_date >= current_date - 29)::int as done_last_30,
    count(*)::int                                              as total
  from public.habit_logs
  group by habit_id
)
select
  h.id                         as habit_id,
  h.user_id,
  coalesce(c.length, 0)        as current_streak,
  coalesce(b.length, 0)        as best_streak,
  coalesce(r.done_last_7, 0)   as done_last_7,
  coalesce(r.done_last_30, 0)  as done_last_30,
  coalesce(r.total, 0)         as total
from public.habits h
left join current c on c.habit_id = h.id
left join best    b on b.habit_id = h.id
left join recent  r on r.habit_id = h.id;

-- ---------------------------------------------------------------------------
-- Metric trends: 7d / 30d rolling averages and day-over-day delta.
-- ---------------------------------------------------------------------------

create or replace view public.metric_trends
with (security_invoker = true) as
select
  metric_id,
  user_id,
  entry_date,
  value,
  avg(value) over (partition by metric_id order by entry_date rows between 6  preceding and current row) as avg_7d,
  avg(value) over (partition by metric_id order by entry_date rows between 29 preceding and current row) as avg_30d,
  value - lag(value) over (partition by metric_id order by entry_date)                                   as delta
from public.metric_entries;

-- ---------------------------------------------------------------------------
-- Weekly habit completion rate for the last 12 weeks (feeds the bar chart).
-- ---------------------------------------------------------------------------

create or replace view public.weekly_completion
with (security_invoker = true) as
with weeks as (
  select generate_series(
    date_trunc('week', current_date)::date - interval '11 weeks',
    date_trunc('week', current_date)::date,
    interval '1 week'
  )::date as week_start
),
active as (
  select id, user_id, target_per_week from public.habits where archived_at is null
)
select
  a.user_id,
  w.week_start,
  count(l.id)::int                           as completed,
  sum(a.target_per_week)::int                as target,
  least(100, round(100.0 * count(l.id) / greatest(sum(a.target_per_week), 1)))::int as pct
from weeks w
cross join active a
left join public.habit_logs l
  on l.habit_id = a.id
 and l.log_date >= w.week_start
 and l.log_date <  w.week_start + 7
group by a.user_id, w.week_start;

-- ---------------------------------------------------------------------------
-- RPC: bulk CSV import. rows = [{key, label?, unit?, date, value, source?}]
-- Creates any missing metric definitions, then upserts entries.
-- ---------------------------------------------------------------------------

create or replace function public.import_metric_entries(rows jsonb)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted int;
begin
  insert into public.metrics (user_id, key, label, unit)
  select distinct
    auth.uid(),
    r->>'key',
    coalesce(r->>'label', initcap(replace(r->>'key', '_', ' '))),
    coalesce(r->>'unit', '')
  from jsonb_array_elements(rows) r
  on conflict (user_id, key) do nothing;

  insert into public.metric_entries (user_id, metric_id, entry_date, value, source)
  select
    auth.uid(),
    m.id,
    (r->>'date')::date,
    (r->>'value')::numeric,
    coalesce(r->>'source', 'csv')
  from jsonb_array_elements(rows) r
  join public.metrics m on m.key = r->>'key' and m.user_id = auth.uid()
  on conflict (metric_id, entry_date) do update
    set value = excluded.value, source = excluded.source;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: toggle a habit for a day (insert if missing, delete if present).
-- ---------------------------------------------------------------------------

create or replace function public.toggle_habit_log(p_habit_id uuid, p_date date default current_date)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed int;
begin
  delete from public.habit_logs where habit_id = p_habit_id and log_date = p_date;
  get diagnostics removed = row_count;
  if removed > 0 then
    return false;
  end if;
  insert into public.habit_logs (habit_id, log_date) values (p_habit_id, p_date);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: stream check-ins so multiple devices stay in sync.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.habit_logs;
alter publication supabase_realtime add table public.metric_entries;
