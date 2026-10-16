create table if not exists public.user_today_info(
 user_id uuid not null references auth.users(id) on delete cascade,
 info_date date not null default current_date,
 current_class text,class_end_time time,next_class text,next_room text,
 assignment_text text,activity_text text,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(user_id,info_date)
);
alter table public.user_today_info enable row level security;
revoke all on table public.user_today_info from anon, authenticated;

create or replace function public.get_my_today_info()
returns table(current_class text,class_end_time time,next_class text,next_room text,assignment_text text,activity_text text)
language sql stable security definer set search_path='' as $$
 select i.current_class,i.class_end_time,i.next_class,i.next_room,i.assignment_text,i.activity_text
 from public.user_today_info i where i.user_id=auth.uid() and i.info_date=current_date limit 1;
$$;

create or replace function public.get_active_accounts_for_today_info()
returns table(user_id uuid,email text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 return query select p.id,p.email::text,p.role::text from public.profiles p
 where p.active=true and p.role in('student','teacher','admin') order by p.email;
end; $$;

create or replace function public.get_user_today_info_admin(target_user_id uuid)
returns table(current_class text,class_end_time time,next_class text,next_room text,assignment_text text,activity_text text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 return query select i.current_class,i.class_end_time,i.next_class,i.next_room,i.assignment_text,i.activity_text
 from public.user_today_info i where i.user_id=target_user_id and i.info_date=current_date limit 1;
end; $$;

create or replace function public.set_user_today_info_admin(target_user_id uuid,new_current_class text,new_class_end_time time,new_next_class text,new_next_room text,new_assignment_text text,new_activity_text text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if not exists(select 1 from public.profiles where id=target_user_id and active=true) then raise exception 'Target account is not active'; end if;
 insert into public.user_today_info(user_id,info_date,current_class,class_end_time,next_class,next_room,assignment_text,activity_text,updated_by,updated_at)
 values(target_user_id,current_date,nullif(btrim(new_current_class),''),new_class_end_time,nullif(btrim(new_next_class),''),nullif(btrim(new_next_room),''),nullif(btrim(new_assignment_text),''),nullif(btrim(new_activity_text),''),auth.uid(),now())
 on conflict(user_id,info_date) do update set current_class=excluded.current_class,class_end_time=excluded.class_end_time,next_class=excluded.next_class,next_room=excluded.next_room,assignment_text=excluded.assignment_text,activity_text=excluded.activity_text,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
end; $$;

create or replace function public.clear_user_today_info_admin(target_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 delete from public.user_today_info where user_id=target_user_id and info_date=current_date;
end; $$;

revoke all on function public.get_my_today_info() from public;
revoke all on function public.get_active_accounts_for_today_info() from public;
revoke all on function public.get_user_today_info_admin(uuid) from public;
revoke all on function public.set_user_today_info_admin(uuid,text,time,text,text,text,text) from public;
revoke all on function public.clear_user_today_info_admin(uuid) from public;
grant execute on function public.get_my_today_info() to authenticated;
grant execute on function public.get_active_accounts_for_today_info() to authenticated;
grant execute on function public.get_user_today_info_admin(uuid) to authenticated;
grant execute on function public.set_user_today_info_admin(uuid,text,time,text,text,text,text) to authenticated;
grant execute on function public.clear_user_today_info_admin(uuid) to authenticated;
