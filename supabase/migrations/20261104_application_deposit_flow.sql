-- Run last, after existing Xenit migrations. Safe to rerun.
begin;
create or replace function public.approve_application_with_deposit(actor uuid,app_id uuid,expected_version timestamptz,settings jsonb,new_note text,approval_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into a from applications where id=app_id for update;
 if a.id is null or a.status='Draft' or expected_version is null or a.updated_at<>expected_version then raise exception 'Application changed; refresh';end if;
 if a.payment_released_at is not null or exists(select 1 from receipts where application_id=app_id) then raise exception 'Deposit details already released';end if;
 if not valid_deposit_settings(settings) or coalesce(length(btrim(settings->>'city')),0)=0 or coalesce(length(btrim(settings->>'state')),0)=0 or not coalesce(settings->>'zipCode' ~ '^\d{5}(-\d{4})?$',false) then raise exception 'Complete the deposit settings';end if;
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

create or replace function public.record_approval_letter_download(actor uuid,app_id uuid,expected_approval jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; downloaded timestamptz;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if expected_approval is null or jsonb_typeof(expected_approval)<>'object' or a.data->'approval' is distinct from expected_approval then raise exception 'Approval changed; refresh your dashboard';end if;
 downloaded:=coalesce(a.letter_downloaded_at,clock_timestamp());
 update applications set letter_downloaded_at=downloaded,
 payment_released_at=coalesce(payment_released_at,case when valid_deposit_settings(deposit_payment_settings) then downloaded+interval '10 seconds' else null end)
 where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Approval letter downloaded',a.code);
 insert into notifications(kind,reference,audience,payload) values('Approval letter downloaded',a.code,'admin',jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id,'paymentReleased',a.payment_released_at is not null));
end $$;

create or replace function public.require_payment_release() returns trigger
language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=new.application_id for update;
 if a.id is null or a.status<>'Approved' or a.payment_released_at is null or a.payment_released_at>clock_timestamp() then
  raise exception 'Download your approval letter and wait 10 seconds before submitting a deposit';
 end if;
 return new;
end $$;
-- Preserve existing released applications and continue already-downloaded letters.
update public.applications set payment_released_at=letter_downloaded_at+interval '10 seconds'
where status='Approved' and payment_released_at is null and letter_downloaded_at is not null and public.valid_deposit_settings(deposit_payment_settings);
revoke all on function public.approve_application_with_deposit(uuid,uuid,timestamptz,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.approve_application_with_deposit(uuid,uuid,timestamptz,jsonb,text,jsonb) to service_role;
-- Retire the manual release RPC; application server uses only the combined approval.
revoke execute on function public.release_application_payment(uuid,uuid,timestamptz) from service_role;
commit;
