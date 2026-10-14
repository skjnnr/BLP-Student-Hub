-- ============================================================
-- BLP STUDENT HUB - LUNCH ADMIN CONTROLS UPGRADE
-- Run this in Supabase SQL Editor AFTER/IN ADDITION TO the original
-- lunch-votes.sql. Safe to run more than once.
-- ============================================================

create table if not exists public.lunch_menu (
  menu_date date primary key default current_date,
  hot_lunch text not null,
  cold_lunch text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.lunch_menu enable row level security;
revoke all on table public.lunch_menu from anon;
revoke all on table public.lunch_menu from authenticated;

-- Everyone signed in can retrieve today's menu through this safe RPC.
create or replace function public.get_today_lunch_menu()
returns table(hot_lunch text, cold_lunch text)
language sql
stable
security definer
set search_path = ''
as $$
  select lm.hot_lunch, lm.cold_lunch
  from public.lunch_menu lm
  where lm.menu_date = current_date
  limit 1;
$$;

-- Admin-only: set/update today's menu names.
create or replace function public.set_today_lunch_menu(
  new_hot_lunch text,
  new_cold_lunch text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  new_hot_lunch := btrim(new_hot_lunch);
  new_cold_lunch := btrim(new_cold_lunch);

  if new_hot_lunch = '' or new_cold_lunch = '' then
    raise exception 'Both lunch options are required';
  end if;

  if length(new_hot_lunch) > 120 or length(new_cold_lunch) > 120 then
    raise exception 'Lunch option is too long';
  end if;

  insert into public.lunch_menu(menu_date, hot_lunch, cold_lunch, updated_by, updated_at)
  values(current_date, new_hot_lunch, new_cold_lunch, auth.uid(), now())
  on conflict (menu_date)
  do update set
    hot_lunch = excluded.hot_lunch,
    cold_lunch = excluded.cold_lunch,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
end;
$$;

-- Admin-only: remove every vote for today.
-- Menu names are intentionally preserved.
create or replace function public.reset_today_lunch_votes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  delete from public.lunch_votes
  where vote_date = current_date;
end;
$$;

revoke all on function public.get_today_lunch_menu() from public;
revoke all on function public.set_today_lunch_menu(text,text) from public;
revoke all on function public.reset_today_lunch_votes() from public;

grant execute on function public.get_today_lunch_menu() to authenticated;
grant execute on function public.set_today_lunch_menu(text,text) to authenticated;
grant execute on function public.reset_today_lunch_votes() to authenticated;
