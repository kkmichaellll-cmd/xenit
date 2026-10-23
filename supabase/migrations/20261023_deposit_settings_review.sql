-- Run AFTER 20261023_letter_payment_approval.sql. Safe to rerun.
begin;
alter table public.applications add column if not exists deposit_payment_settings jsonb;
-- Keep already released deposit instructions available without restarting review.
update public.applications a set deposit_payment_settings=p.payment
from public.properties p where p.id=a.property_id and a.payment_released_at is not null
and a.deposit_payment_settings is null;

create or replace function public.valid_deposit_settings(settings jsonb) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(settings)='object'
 and length(btrim(settings->>'landlordName')) between 1 and 150
 and length(btrim(settings->>'mailingAddress')) between 1 and 500
 and length(btrim(settings->>'purpose')) between 1 and 100
 and jsonb_typeof(settings->'noPostalMoneyOrders')='boolean'
 and case when settings->>'amount' ~ '^\d{1,8}(\.\d{1,2})?$'
 then (settings->>'amount')::numeric>0 and (settings->>'amount')::numeric<=10000000 else false end,false);
$$;

create or replace function public.save_deposit_settings(actor uuid,app_id uuid,expected_version timestamptz,settings jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into a from applications where id=app_id for update;
 if a.id is null or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if expected_version is null or a.updated_at<>expected_version then raise exception 'Application changed; refresh';end if;
 if a.payment_released_at is not null or exists(select 1 from receipts where application_id=app_id) then raise exception 'Deposit details already released';end if;
 if not valid_deposit_settings(settings) then raise exception 'Complete the deposit settings';end if;
 update applications set deposit_payment_settings=settings,updated_at=clock_timestamp() where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Deposit money order settings saved',a.code);
end $$;

create or replace function public.release_application_payment(actor uuid,app_id uuid,expected_version timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; email_value text;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into a from applications where id=app_id for update;
 if a.id is null or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if expected_version is null or a.updated_at<>expected_version then raise exception 'Application changed; refresh';end if;
 if a.payment_released_at is not null then return;end if;
 if a.letter_downloaded_at is null then raise exception 'Letter download required';end if;
 if not valid_deposit_settings(a.deposit_payment_settings) then raise exception 'Save complete deposit settings before approval';end if;
 update applications set payment_released_at=now(),payment_released_by=actor where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Deposit submission access approved',a.code);
 select email into email_value from auth.users where id=a.user_id;
 insert into notifications(kind,reference,audience,recipient,payload)
 values('Payment access approved',a.code,'tenant',email_value,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id));
end $$;

-- A new application decision also requires a fresh review of deposit details.
create or replace function public.reset_letter_payment_review() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.status is distinct from new.status or old.data->'approval' is distinct from new.data->'approval' then
  if not exists(select 1 from receipts where application_id=new.id) then
   new.letter_downloaded_at:=null;new.payment_released_at:=null;new.payment_released_by:=null;new.deposit_payment_settings:=null;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.valid_deposit_settings(jsonb),public.save_deposit_settings(uuid,uuid,timestamptz,jsonb),public.release_application_payment(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.save_deposit_settings(uuid,uuid,timestamptz,jsonb),public.release_application_payment(uuid,uuid,timestamptz) to service_role;
commit;
