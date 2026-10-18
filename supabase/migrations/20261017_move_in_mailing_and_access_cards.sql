-- Run after 20261017_move_in_receipts.sql on existing installations.
create table public.move_in_mailing_receipts(
 id uuid primary key,
 application_id uuid not null unique references public.applications(id),
 user_id uuid not null references auth.users(id),
 path text not null,
 filename text not null,
 tracking text not null default '',
 status text not null default 'Submitted' check(status in ('Submitted','Approved','Declined')),
 decision_note text,
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id)
);
alter table public.move_in_mailing_receipts enable row level security;
revoke all on public.move_in_mailing_receipts from anon,authenticated;
grant all on public.move_in_mailing_receipts to service_role;

create table public.access_cards(
 application_id uuid primary key references public.applications(id),
 user_id uuid not null references auth.users(id),
 photo_path text not null,
 photo_filename text not null,
 created_at timestamptz not null default now()
);
alter table public.access_cards enable row level security;
revoke all on public.access_cards from anon,authenticated;
grant all on public.access_cards to service_role;

create function public.submit_move_in_mailing_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from move_in_receipts where application_id=app_id and status='Approved') then raise exception 'Move-in payment approval required';end if;
 if exists(select 1 from move_in_mailing_receipts where application_id=app_id and status<>'Declined') then raise exception 'Mailing receipt already submitted';end if;
 if exists(select 1 from move_in_mailing_receipts where application_id=app_id and status='Declined') then
  update move_in_mailing_receipts set id=receipt_id,path=object_path,filename=file_name,tracking=tracking_value,status='Submitted',decision_note=null,created_at=now(),decided_at=null,decided_by=null where application_id=app_id;
 else
  insert into move_in_mailing_receipts(id,application_id,user_id,path,filename,tracking)
  values(receipt_id,app_id,actor,object_path,file_name,tracking_value);
 end if;
 insert into notifications(kind,reference) values('Move-in mailing receipt submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Move-in mailing receipt submitted',a.code);
end $$;

create function public.decide_move_in_mailing_receipt(actor uuid,receipt_id uuid,new_status text,new_note text)
returns void language plpgsql security definer set search_path=public as $$
declare r move_in_mailing_receipts;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if new_status not in ('Approved','Declined') then raise exception 'Invalid status';end if;
 select * into r from move_in_mailing_receipts where id=receipt_id for update;
 if r.id is null then raise exception 'Mailing receipt not found';end if;
 if r.status<>'Submitted' then raise exception 'Mailing receipt already reviewed';end if;
 update move_in_mailing_receipts set status=new_status,decision_note=left(coalesce(new_note,''),1000),decided_at=now(),decided_by=actor where id=receipt_id;
 insert into audit_log(actor,action,reference) values(actor,'Move-in mailing receipt '||new_status,receipt_id::text);
end $$;

create function public.create_access_card(actor uuid,app_id uuid,object_path text,file_name text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from move_in_mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Mailing receipt approval required';end if;
 if exists(select 1 from access_cards where application_id=app_id) then raise exception 'Access card photo already uploaded';end if;
 insert into access_cards(application_id,user_id,photo_path,photo_filename) values(app_id,actor,object_path,file_name);
 insert into notifications(kind,reference) values('Access card photo submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Access card photo submitted',a.code);
end $$;

revoke all on function public.submit_move_in_mailing_receipt(uuid,uuid,uuid,text,text,text),public.decide_move_in_mailing_receipt(uuid,uuid,text,text),public.create_access_card(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_move_in_mailing_receipt(uuid,uuid,uuid,text,text,text),public.decide_move_in_mailing_receipt(uuid,uuid,text,text),public.create_access_card(uuid,uuid,text,text) to service_role;
