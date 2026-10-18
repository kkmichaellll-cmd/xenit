-- Existing installations: run this migration once after the original schema.
create table public.mailing_receipts(id uuid primary key,application_id uuid not null unique references public.applications(id),user_id uuid not null references auth.users(id),path text not null,filename text not null,tracking text,status text not null default 'Submitted' check(status='Submitted'),created_at timestamptz not null default now());
alter table public.mailing_receipts enable row level security;
revoke all on public.mailing_receipts from anon,authenticated;
grant all on public.mailing_receipts to service_role;
create function public.submit_mailing_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text) returns void language plpgsql security definer set search_path=public as $$
declare a applications; begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from receipts where application_id=app_id and status='Approved') then raise exception 'Payment approval required';end if;
 if exists(select 1 from mailing_receipts where application_id=app_id) then raise exception 'Mailing receipt already submitted';end if;
 insert into mailing_receipts(id,application_id,user_id,path,filename,tracking) values(receipt_id,app_id,actor,object_path,file_name,tracking_value);
 insert into notifications(kind,reference) values('Mailing receipt submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Mailing receipt submitted',a.code);
end $$;
revoke all on function public.submit_mailing_receipt(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_mailing_receipt(uuid,uuid,uuid,text,text,text) to service_role;
