begin;
create table if not exists public.rent_special(application_id uuid primary key references public.applications(id),settings jsonb not null,released_at timestamptz,updated_at timestamptz not null default now());
create table if not exists public.rent_special_receipts(id uuid primary key,application_id uuid not null unique references public.applications(id),user_id uuid not null references auth.users(id),path text not null,filename text not null,status text not null default 'Pending review' check(status in ('Pending review','Approved')),created_at timestamptz not null default now(),approved_at timestamptz,approved_by uuid references auth.users(id));
alter table public.rent_special enable row level security;alter table public.rent_special_receipts enable row level security;
revoke all on public.rent_special,public.rent_special_receipts from public,anon,authenticated;grant all on public.rent_special,public.rent_special_receipts to service_role;
create or replace function public.save_rent_special(actor uuid,app_id uuid,amount numeric) returns void language plpgsql security definer set search_path=public as $$
declare source_settings jsonb;existing rent_special;begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 perform 1 from applications where id=app_id and status='Approved' for update;if not found then raise exception 'Approved application required';end if;
 if not exists(select 1 from utility_hoa_mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Approve HOA mailing receipt first';end if;
 if amount is null or amount<=0 or amount>10000000 or amount<>round(amount,2) then raise exception 'Enter a valid second month rent';end if;
 select * into existing from rent_special where application_id=app_id for update;if found and existing.released_at is not null then raise exception 'Offer already enabled';end if;
 select settings into source_settings from utility_hoa where application_id=app_id;if source_settings is null then raise exception 'HOA payment instructions are missing';end if;
 source_settings:=source_settings||jsonb_build_object('hoa',amount,'electric',0,'internet',0,'lastRent',0,'purpose','Second Month’s Rent');
 insert into rent_special(application_id,settings) values(app_id,source_settings) on conflict(application_id) do update set settings=excluded.settings,updated_at=now();
end $$;
create or replace function public.release_rent_special(actor uuid,app_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare offer rent_special;a applications;recipient_email text;begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 select * into a from applications where id=app_id and status='Approved' for update;if not found then raise exception 'Approved application required';end if;
 if not exists(select 1 from utility_hoa_mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Approve HOA mailing receipt first';end if;
 select * into offer from rent_special where application_id=app_id for update;if not found then raise exception 'Save the second month rent first';end if;
 if offer.released_at is null then update rent_special set released_at=now(),updated_at=now() where application_id=app_id;select email into recipient_email from auth.users where id=a.user_id;insert into notifications(kind,reference,audience,recipient,payload) values('Rent Special available',a.code,'tenant',recipient_email,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','amount',offer.settings->>'hoa'));end if;
end $$;
create or replace function public.submit_rent_special_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text) returns void language plpgsql security definer set search_path=public as $$
declare a applications;offer rent_special;begin
 select * into a from applications where id=app_id for update;if not found or a.user_id<>actor or a.status<>'Approved' then raise exception 'Not authorized';end if;
 select * into offer from rent_special where application_id=app_id for update;if not found or offer.released_at is null then raise exception 'Rent Special payment is not available';end if;
 if exists(select 1 from rent_special_receipts where application_id=app_id) then raise exception 'Receipt already submitted';end if;
 insert into rent_special_receipts(id,application_id,user_id,path,filename) values(receipt_id,app_id,actor,object_path,file_name);
 insert into notifications(kind,reference,audience,payload) values('Rent Special receipt submitted',a.code,'admin',jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id,'submission',jsonb_build_object('ownerId',actor,'details',jsonb_build_object('applicationCode',a.code,'applicant',a.data->>'name','property',a.data->>'propertyTitle','payment','Second Month’s Rent — Rent Special'),'documents',jsonb_build_array(jsonb_build_object('path',object_path,'filename',file_name)))));
end $$;
create or replace function public.approve_rent_special_receipt(actor uuid,receipt_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare receipt rent_special_receipts;a applications;recipient_email text;begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 select * into receipt from rent_special_receipts where id=receipt_id for update;if not found then raise exception 'Receipt not found';end if;
 if receipt.status<>'Approved' then update rent_special_receipts set status='Approved',approved_at=now(),approved_by=actor where id=receipt_id;select * into a from applications where id=receipt.application_id;select email into recipient_email from auth.users where id=a.user_id;insert into notifications(kind,reference,audience,recipient,payload) values('Rent Special payment approved',a.code,'tenant',recipient_email,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle'));end if;
end $$;
revoke all on function public.save_rent_special(uuid,uuid,numeric),public.release_rent_special(uuid,uuid),public.submit_rent_special_receipt(uuid,uuid,uuid,text,text),public.approve_rent_special_receipt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_rent_special(uuid,uuid,numeric),public.release_rent_special(uuid,uuid),public.submit_rent_special_receipt(uuid,uuid,uuid,text,text),public.approve_rent_special_receipt(uuid,uuid) to service_role;
commit;
