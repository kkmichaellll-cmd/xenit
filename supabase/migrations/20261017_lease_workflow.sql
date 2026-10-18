-- Run once after 20261017_mailing_receipts.sql on existing installations.
alter table public.mailing_receipts drop constraint if exists mailing_receipts_status_check;
alter table public.mailing_receipts add constraint mailing_receipts_status_check check(status in ('Submitted','Approved','Declined'));
alter table public.mailing_receipts add column if not exists decision_note text;
alter table public.mailing_receipts add column if not exists decided_at timestamptz;
alter table public.mailing_receipts add column if not exists decided_by uuid references auth.users(id);

create table public.signed_leases(
 id uuid primary key,
 application_id uuid not null unique references public.applications(id),
 user_id uuid not null references auth.users(id),
 path text not null,
 filename text not null,
 status text not null default 'Submitted' check(status='Submitted'),
 created_at timestamptz not null default now()
);
alter table public.signed_leases enable row level security;
revoke all on public.signed_leases from anon,authenticated;
grant all on public.signed_leases to service_role;

create function public.decide_mailing_receipt(actor uuid,receipt_id uuid,new_status text,new_note text) returns void language plpgsql security definer set search_path=public as $$
declare r mailing_receipts; begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if new_status not in ('Approved','Declined') then raise exception 'Invalid status';end if;
 select * into r from mailing_receipts where id=receipt_id for update;
 if r.id is null then raise exception 'Mailing receipt not found';end if;
 update mailing_receipts set status=new_status,decision_note=left(coalesce(new_note,''),1000),decided_at=now(),decided_by=actor where id=receipt_id;
 insert into audit_log(actor,action,reference) values(actor,'Mailing receipt '||new_status,receipt_id::text);
end $$;

create function public.submit_signed_lease(actor uuid,app_id uuid,lease_id uuid,object_path text,file_name text) returns void language plpgsql security definer set search_path=public as $$
declare a applications; begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Mailing receipt approval required';end if;
 if exists(select 1 from signed_leases where application_id=app_id) then raise exception 'Signed lease already submitted';end if;
 insert into signed_leases(id,application_id,user_id,path,filename) values(lease_id,app_id,actor,object_path,file_name);
 insert into notifications(kind,reference) values('Signed lease submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Signed lease submitted',a.code);
end $$;

revoke all on function public.decide_mailing_receipt(uuid,uuid,text,text),public.submit_signed_lease(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.decide_mailing_receipt(uuid,uuid,text,text),public.submit_signed_lease(uuid,uuid,uuid,text,text) to service_role;
