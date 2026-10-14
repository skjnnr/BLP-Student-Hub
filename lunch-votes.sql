-- ============================================================
-- BLP STUDENT HUB - DAILY LUNCH VOTING
-- Run ONCE in Supabase SQL Editor.
--
-- Security design:
-- * Every signed-in account can vote once per day.
-- * A database unique key prevents a second vote.
-- * Users can read only their own vote through an RPC.
-- * Everyone can see only aggregate Hot/Cold counts.
-- * Only real Admin accounts can see the email/role vote feed.
-- * Browser-side role changes cannot bypass these checks.
-- ============================================================

create table if not exists public.lunch_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  vote_date date not null default current_date,
  choice text not null check (choice in ('hot','cold')),
  created_at timestamptz not null default now(),
  primary key (user_id, vote_date)
);

alter table public.lunch_votes enable row level security;

-- Do not expose the raw table directly to normal browser users.
revoke all on table public.lunch_votes from anon;
revoke all on table public.lunch_votes from authenticated;

-- Submit exactly one vote for the current signed-in account.
create or replace function public.submit_lunch_vote(selected_choice text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if selected_choice not in ('hot','cold') then
    raise exception 'Invalid lunch choice';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and role in ('student','teacher','admin')
  ) then
    raise exception 'Account is not allowed to vote';
  end if;

  if exists (
    select 1
    from public.lunch_votes
    where user_id = auth.uid()
      and vote_date = current_date
  ) then
    raise exception 'Already voted today';
  end if;

  insert into public.lunch_votes(user_id, vote_date, choice)
  values (auth.uid(), current_date, selected_choice);
end;
$$;

-- Return only the current user's vote for today.
create or replace function public.get_my_today_lunch_vote()
returns table(choice text)
language sql
stable
security definer
set search_path = ''
as $$
  select lv.choice
  from public.lunch_votes lv
  where lv.user_id = auth.uid()
    and lv.vote_date = current_date
  limit 1;
$$;

-- Safe aggregate counts; does not reveal who voted.
create or replace function public.get_today_lunch_counts()
returns table(hot_count bigint, cold_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where lv.choice = 'hot') as hot_count,
    count(*) filter (where lv.choice = 'cold') as cold_count
  from public.lunch_votes lv
  where lv.vote_date = current_date;
$$;

-- Admin-only detailed feed.
create or replace function public.get_today_lunch_votes_admin()
returns table(
  email text,
  role text,
  choice text,
  voted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    coalesce(p.email, 'Unknown account')::text,
    coalesce(p.role, 'user')::text,
    lv.choice::text,
    lv.created_at
  from public.lunch_votes lv
  left join public.profiles p on p.id = lv.user_id
  where lv.vote_date = current_date
  order by lv.created_at desc;
end;
$$;

revoke all on function public.submit_lunch_vote(text) from public;
revoke all on function public.get_my_today_lunch_vote() from public;
revoke all on function public.get_today_lunch_counts() from public;
revoke all on function public.get_today_lunch_votes_admin() from public;

grant execute on function public.submit_lunch_vote(text) to authenticated;
grant execute on function public.get_my_today_lunch_vote() to authenticated;
grant execute on function public.get_today_lunch_counts() to authenticated;
grant execute on function public.get_today_lunch_votes_admin() to authenticated;

create index if not exists lunch_votes_vote_date_idx
on public.lunch_votes(vote_date);
