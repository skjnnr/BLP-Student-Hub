-- ============================================================
-- BLP STUDENT HUB - TIMED ANNOUNCEMENTS/LINKS + EDIT/DELETE
-- Run this ONCE in the Supabase SQL Editor.
-- ============================================================

-- Add expiration timestamps.
alter table public.announcements
  add column if not exists expires_at timestamptz;

alter table public.links
  add column if not exists expires_at timestamptz;

-- Existing announcements/links keep expires_at = NULL,
-- which means they remain visible until you edit/delete them.
-- New website posts will automatically set expires_at.

-- Allow teachers/admins to update and delete announcements.
drop policy if exists "staff update announcements" on public.announcements;
create policy "staff update announcements"
on public.announcements
for update
to authenticated
using (public.is_teacher() or public.is_admin())
with check (public.is_teacher() or public.is_admin());

drop policy if exists "staff delete announcements" on public.announcements;
create policy "staff delete announcements"
on public.announcements
for delete
to authenticated
using (public.is_teacher() or public.is_admin());

-- Allow teachers/admins to update and delete links.
drop policy if exists "staff update links" on public.links;
create policy "staff update links"
on public.links
for update
to authenticated
using (public.is_teacher() or public.is_admin())
with check (public.is_teacher() or public.is_admin());

drop policy if exists "staff delete links" on public.links;
create policy "staff delete links"
on public.links
for delete
to authenticated
using (public.is_teacher() or public.is_admin());

-- Helpful indexes for expiration checks.
create index if not exists announcements_expires_at_idx
  on public.announcements (expires_at);

create index if not exists links_expires_at_idx
  on public.links (expires_at);
