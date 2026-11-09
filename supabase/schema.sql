-- TravelTrax schema. Run once in Supabase → SQL Editor.

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  destination text not null default '',
  start_date  date not null,
  end_date    date not null,
  notes       text,
  created_at  timestamptz not null default now(),
  constraint trips_dates_check check (end_date >= start_date)
);

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id      uuid not null references public.trips (id) on delete cascade,
  category     text not null check (category in
                 ('flights', 'lodging', 'food', 'transport', 'activities', 'shopping', 'other')),
  description  text not null default '',
  amount       numeric(12, 2) not null default 0 check (amount >= 0),
  points       bigint not null default 0 check (points >= 0),
  program      text,
  expense_date date,
  end_date     date,          -- e.g. hotel check-out
  -- transaction:    one purchase (e.g. a $45 dinner)
  -- category_total: the complete total for the category; transactions in that
  --                 category are treated as already included (not added again)
  -- additional:     unitemized spending added on top of transactions
  entry_type   text not null default 'transaction'
                 check (entry_type in ('transaction', 'category_total', 'additional')),
  created_at   timestamptz not null default now()
);

-- For databases created before end_date existed:
alter table public.expenses add column if not exists end_date date;

create index if not exists trips_user_start_idx on public.trips (user_id, start_date desc);
create index if not exists expenses_trip_idx on public.expenses (trip_id);
create index if not exists expenses_user_idx on public.expenses (user_id);

-- Row-level security: each user sees and changes only their own rows.
alter table public.trips enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Users manage own trips" on public.trips;
create policy "Users manage own trips" on public.trips
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.trips, public.expenses to authenticated;
