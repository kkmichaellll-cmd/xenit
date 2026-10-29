begin;
create table if not exists public.utility_hoa_mailing_receipts(
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
alter table public.utility_hoa_mailing_receipts enable row level security;
revoke all on public.utility_hoa_mailing_receipts from public,anon,authenticated;
grant all on public.utility_hoa_mailing_receipts to service_role;

create or replace function public.submit_utility_hoa_mailing_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;existing utility_hoa_mailing_receipts;
begin
 select * into a from applications where id=app_id for update;
 if not found or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from utility_hoa_receipts where application_id=app_id and status='Approved') then raise exception 'HOA and Utility payment approval required';end if;
 select * into existing from utility_hoa_mailing_receipts where application_id=app_id for update;
 if found and existing.status<>'Declined' then raise exception 'Money-order validation already submitted';end if;
 if found then
  update utility_hoa_mailing_receipts set id=receipt_id,path=object_path,filename=file_name,tracking=left(coalesce(tracking_value,''),200),status='Submitted',decision_note=null,created_at=now(),decided_at=null,decided_by=null where application_id=app_id;
 else
  insert into utility_hoa_mailing_receipts(id,application_id,user_id,path,filename,tracking) values(receipt_id,app_id,actor,object_path,file_name,left(coalesce(tracking_value,''),200));
 end if;
 insert into notifications(kind,reference,audience,payload) values(
  'Utility & HOA mailing receipt submitted',a.code,'admin',
  jsonb_build_object(
   'name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id,
   'submission',jsonb_build_object(
    'ownerId',actor,
    'details',jsonb_build_object('applicationCode',a.code,'applicant',a.data->>'name','property',a.data->>'propertyTitle','tracking',left(coalesce(tracking_value,''),200),'submission','Utility & HOA money-order validation'),
    'documents',jsonb_build_array(jsonb_build_object('path',object_path,'filename',file_name))
   )
  )
 );
end $$;

create or replace function public.decide_utility_hoa_mailing_receipt(actor uuid,receipt_id uuid,new_status text,new_note text)
returns void language plpgsql security definer set search_path=public as $$
declare r utility_hoa_mailing_receipts;a applications;recipient_email text;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 if new_status not in ('Approved','Declined') then raise exception 'Invalid status';end if;
 select * into r from utility_hoa_mailing_receipts where id=receipt_id for update;
 if not found then raise exception 'Validation receipt not found';end if;
 if r.status<>'Submitted' then raise exception 'Validation receipt already reviewed';end if;
 update utility_hoa_mailing_receipts set status=new_status,decision_note=left(coalesce(new_note,''),1000),decided_at=now(),decided_by=actor where id=receipt_id;
 select * into a from applications where id=r.application_id;
 select email into recipient_email from auth.users where id=a.user_id;
 insert into notifications(kind,reference,audience,recipient,payload) values(
  case when new_status='Approved' then 'Utility & HOA validation approved' else 'Utility & HOA validation declined' end,
  a.code,'tenant',recipient_email,
  jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','note',left(coalesce(new_note,''),1000))
 );
end $$;

revoke all on function public.submit_utility_hoa_mailing_receipt(uuid,uuid,uuid,text,text,text),public.decide_utility_hoa_mailing_receipt(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_utility_hoa_mailing_receipt(uuid,uuid,uuid,text,text,text),public.decide_utility_hoa_mailing_receipt(uuid,uuid,text,text) to service_role;
commit;
