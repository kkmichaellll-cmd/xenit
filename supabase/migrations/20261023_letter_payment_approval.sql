-- Run in Supabase SQL Editor before deploying the accompanying app update.
-- Safe to rerun. Existing application codes are preserved.
begin;
alter table public.applications add column if not exists letter_downloaded_at timestamptz;
alter table public.applications add column if not exists payment_released_at timestamptz;
alter table public.applications add column if not exists payment_released_by uuid references auth.users(id);

-- Preserve progress for tenants who already submitted their holding payment.
update public.applications a set payment_released_at=coalesce(r.created_at,now())
from public.receipts r where r.application_id=a.id and a.payment_released_at is null;

create or replace function public.next_application_code() returns text
language plpgsql security definer set search_path=public as $$
declare candidate text; entropy bytea; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
 -- Serialize code allocation until the inserting transaction commits.
 perform pg_advisory_xact_lock(20261023,81005);
 for attempt in 1..1000 loop
  entropy:=decode(replace(gen_random_uuid()::text,'-',''),'hex');
  candidate:='APP-';
  for i in 0..4 loop candidate:=candidate||substr(alphabet,(get_byte(entropy,i)%length(alphabet))+1,1);end loop;
  if not exists(select 1 from applications where code=candidate) then return candidate;end if;
 end loop;
 raise exception 'Unable to allocate application code; retry';
end $$;
alter table public.applications alter column code set default public.next_application_code();

create or replace function public.reset_letter_payment_review() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.status is distinct from new.status or old.data->'approval' is distinct from new.data->'approval' then
  if not exists(select 1 from receipts where application_id=new.id) then
   new.letter_downloaded_at:=null;new.payment_released_at:=null;new.payment_released_by:=null;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists reset_letter_payment_review on public.applications;
create trigger reset_letter_payment_review before update on public.applications
for each row execute function public.reset_letter_payment_review();

create or replace function public.record_letter_download(actor uuid,app_id uuid,expected_version timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if expected_version is null or a.updated_at<>expected_version then raise exception 'Application changed; refresh';end if;
 if a.letter_downloaded_at is not null then return;end if;
 update applications set letter_downloaded_at=now() where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Approval letter download initiated',a.code);
 if a.payment_released_at is null then
  insert into notifications(kind,reference,audience,payload)
  values('Approval letter downloaded',a.code,'admin',jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id));
 end if;
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
 update applications set payment_released_at=now(),payment_released_by=actor where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Holding payment access approved',a.code);
 select email into email_value from auth.users where id=a.user_id;
 insert into notifications(kind,reference,audience,recipient,payload)
 values('Payment access approved',a.code,'tenant',email_value,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id));
end $$;

-- Enforce the gate for every receipt insertion, including direct RPC calls.
create or replace function public.require_payment_release() returns trigger
language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=new.application_id for update;
 if a.id is null or a.status<>'Approved' or a.payment_released_at is null then
  raise exception 'Administrator approval after letter download is required before payment';
 end if;
 return new;
end $$;
drop trigger if exists require_payment_release on public.receipts;
create trigger require_payment_release before insert on public.receipts
for each row execute function public.require_payment_release();

revoke all on function public.next_application_code(),public.reset_letter_payment_review(),public.record_letter_download(uuid,uuid,timestamptz),public.release_application_payment(uuid,uuid,timestamptz),public.require_payment_release() from public,anon,authenticated;
grant execute on function public.next_application_code(),public.record_letter_download(uuid,uuid,timestamptz),public.release_application_payment(uuid,uuid,timestamptz) to service_role;
commit;
