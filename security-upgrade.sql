-- ============================================================
-- BLP STUDENT HUB - SECURITY HARDENING
-- Review, then run in Supabase SQL Editor.
-- This enforces authorization in Postgres so changing browser JS
-- cannot grant admin/teacher database privileges.
-- ============================================================

-- 1) RLS ON for every exposed application table
alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.links enable row level security;
alter table public.calendar_no_school_days enable row level security;

-- 2) Remove anonymous table access completely
revoke all on table public.profiles from anon;
revoke all on table public.announcements from anon;
revoke all on table public.links from anon;
revoke all on table public.calendar_no_school_days from anon;

-- 3) Least-privilege authenticated grants.
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
-- Profile changes, especially role/active, are intentionally not client-writable.

revoke all on table public.announcements from authenticated;
grant select, insert, update, delete on table public.announcements to authenticated;

revoke all on table public.links from authenticated;
grant select, insert, update, delete on table public.links to authenticated;

revoke all on table public.calendar_no_school_days from authenticated;
grant select, insert, delete on table public.calendar_no_school_days to authenticated;

-- 4) Role helpers. SECURITY DEFINER prevents RLS recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'teacher'
      and active = true
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_teacher() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_teacher() to authenticated;

-- 5) Replace app-table policies with explicit operation policies.
-- PROFILES
drop policy if exists "profiles select" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "users view own profile" on public.profiles;
drop policy if exists "admins view profiles" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;

create policy "profiles self or admin select"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

-- ANNOUNCEMENTS
drop policy if exists "authenticated view announcements" on public.announcements;
drop policy if exists "staff insert announcements" on public.announcements;
drop policy if exists "staff update announcements" on public.announcements;
drop policy if exists "staff delete announcements" on public.announcements;

create policy "announcements authenticated select"
on public.announcements for select to authenticated using (true);

create policy "announcements staff insert"
on public.announcements for insert to authenticated
with check (
  ((select public.is_teacher()) or (select public.is_admin()))
  and created_by = (select auth.uid())
);

create policy "announcements staff update"
on public.announcements for update to authenticated
using ((select public.is_teacher()) or (select public.is_admin()))
with check (
  ((select public.is_teacher()) or (select public.is_admin()))
  and created_by is not null
);

create policy "announcements staff delete"
on public.announcements for delete to authenticated
using ((select public.is_teacher()) or (select public.is_admin()));

-- LINKS
drop policy if exists "authenticated view links" on public.links;
drop policy if exists "staff insert links" on public.links;
drop policy if exists "staff update links" on public.links;
drop policy if exists "staff delete links" on public.links;

create policy "links authenticated select"
on public.links for select to authenticated using (true);

create policy "links staff insert"
on public.links for insert to authenticated
with check (
  ((select public.is_teacher()) or (select public.is_admin()))
  and created_by = (select auth.uid())
);

create policy "links staff update"
on public.links for update to authenticated
using ((select public.is_teacher()) or (select public.is_admin()))
with check (
  ((select public.is_teacher()) or (select public.is_admin()))
  and created_by is not null
);

create policy "links staff delete"
on public.links for delete to authenticated
using ((select public.is_teacher()) or (select public.is_admin()));

-- CALENDAR
drop policy if exists "authenticated view no school days" on public.calendar_no_school_days;
drop policy if exists "admins add no school days" on public.calendar_no_school_days;
drop policy if exists "admins delete no school days" on public.calendar_no_school_days;

create policy "calendar authenticated select"
on public.calendar_no_school_days for select to authenticated using (true);

create policy "calendar admin insert"
on public.calendar_no_school_days for insert to authenticated
with check (
  (select public.is_admin())
  and created_by = (select auth.uid())
  and day >= date '2026-01-01'
  and day <= date '2027-12-31'
);

create policy "calendar admin delete"
on public.calendar_no_school_days for delete to authenticated
using ((select public.is_admin()));

-- 6) Prevent accidental execution of helper functions by anonymous users.
-- No secret/service-role key belongs in the website source.
