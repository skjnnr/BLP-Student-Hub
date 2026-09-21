create table if not exists public.calendar_no_school_days (
  day date primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.calendar_no_school_days enable row level security;
drop policy if exists "authenticated view no school days" on public.calendar_no_school_days;
create policy "authenticated view no school days" on public.calendar_no_school_days for select to authenticated using (true);
drop policy if exists "admins add no school days" on public.calendar_no_school_days;
create policy "admins add no school days" on public.calendar_no_school_days for insert to authenticated with check (public.is_admin());
drop policy if exists "admins delete no school days" on public.calendar_no_school_days;
create policy "admins delete no school days" on public.calendar_no_school_days for delete to authenticated using (public.is_admin());
