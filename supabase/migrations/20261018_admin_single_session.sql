-- One active admin login per account. Only the authorized server may call these RPCs.
create table public.admin_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null,
 expires_at timestamptz not null
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from public, anon, authenticated;
grant all on public.admin_sessions to service_role;

create or replace function public.admin_session_claim(actor uuid, session uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 if not exists(select 1 from public.admins where user_id=actor) then return false; end if;
 if not exists(select 1 from auth.sessions where id=session and user_id=actor and (not_after is null or not_after>now())) then return false; end if;
 -- Conflict-row locking makes simultaneous logins atomic: only one can win.
 insert into public.admin_sessions(user_id,session_id,expires_at)
 values(actor,session,now()+interval '12 hours')
 on conflict(user_id) do update set session_id=excluded.session_id,
 expires_at=case when admin_sessions.session_id=excluded.session_id and admin_sessions.expires_at>now()
 then admin_sessions.expires_at else excluded.expires_at end
 where admin_sessions.expires_at<=now() or admin_sessions.session_id=excluded.session_id
 returning session_id into claimed;
 return claimed is not null;
end $$;

create or replace function public.admin_session_check(actor uuid, session uuid)
returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from public.admin_sessions a join public.admins d on d.user_id=a.user_id
 join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id
 where a.user_id=actor and a.session_id=session and a.expires_at>now() and (s.not_after is null or s.not_after>now()));
$$;

create or replace function public.admin_session_release(actor uuid, session uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 delete from public.admin_sessions where user_id=actor and session_id=session;
 return true;
end $$;
revoke all on function public.admin_session_claim(uuid,uuid),public.admin_session_check(uuid,uuid),public.admin_session_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_session_claim(uuid,uuid),public.admin_session_check(uuid,uuid),public.admin_session_release(uuid,uuid) to service_role;
