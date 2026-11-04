-- Run AFTER 20261104_application_deposit_flow.sql. Safe to rerun.
begin;
-- An omitted amount is unknown, not a zero-dollar payment.
alter table public.receipts alter column amount drop not null;
create or replace function public.valid_deposit_settings(settings jsonb) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(settings)='object'
 and length(coalesce(settings->>'landlordName',''))<=150
 and length(coalesce(settings->>'mailingAddress',''))<=500
 and length(coalesce(settings->>'purpose',''))<=100
 and jsonb_typeof(settings->'noPostalMoneyOrders')='boolean'
 and case when coalesce(settings->>'amount','')='' then true
 when settings->>'amount' ~ '^\d{1,8}(\.\d{1,2})?$'
 then (settings->>'amount')::numeric>0 and (settings->>'amount')::numeric<=10000000 else false end
 and coalesce(settings->>'zipCode','') ~ '^$|^\d{5}(-\d{4})?$',false);
$$;
create or replace function public.approve_application_with_deposit(actor uuid,app_id uuid,expected_version timestamptz,settings jsonb,new_note text,approval_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into a from applications where id=app_id for update;
 if a.id is null or a.status='Draft' or expected_version is null or a.updated_at<>expected_version then raise exception 'Application changed; refresh';end if;
 if a.payment_released_at is not null or exists(select 1 from receipts where application_id=app_id) then raise exception 'Deposit details already released';end if;
 if not valid_deposit_settings(settings) then raise exception 'Complete the deposit settings';end if;
 if approval_data is null or jsonb_typeof(approval_data)<>'object' then raise exception 'Application changed; refresh';end if;
 -- Both statements are in one transaction; failure rolls back approval and settings.
 if a.status<>'Approved' then
  perform decide_application(actor,app_id,expected_version,'Approved',new_note,approval_data);
 end if;
 update applications set deposit_payment_settings=settings,updated_at=clock_timestamp(),
 payment_released_at=case when letter_downloaded_at is not null then greatest(clock_timestamp(),letter_downloaded_at+interval '10 seconds') else null end
 where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Application and deposit settings approved',a.code);
end $$;

create or replace function public.utility_hoa_action(actor uuid,app_id uuid,action text,details jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; k text;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 select * into a from applications where id=app_id for update;
 if not found or a.status<>'Approved' or action<>'save' then raise exception 'Invalid action';end if;
 if not exists(select 1 from access_cards where application_id=app_id and print_requested_at is not null) then raise exception 'Print request required';end if;
 if exists(select 1 from utility_hoa_receipts where application_id=app_id) then raise exception 'Payment already submitted';end if;
 if details is null or jsonb_typeof(details)<>'object' then raise exception 'Invalid payment settings';end if;
 insert into utility_hoa(application_id,settings) values(app_id,details) on conflict(application_id) do update set settings=excluded.settings,updated_at=now();
end $$;
notify pgrst,'reload schema';
commit;
