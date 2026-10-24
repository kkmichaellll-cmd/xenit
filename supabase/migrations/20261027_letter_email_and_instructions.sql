-- Run after 20261026_letter_download_sync.sql. Safe to rerun.
-- Each registered button click queues an admin email, including repeat downloads.
-- Additional instructions use existing payment JSON; no new column is needed.
-- Match the actual approved letter, not updated_at, which changes when admin edits deposit settings.
create or replace function public.record_approval_letter_download(actor uuid,app_id uuid,expected_approval jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if expected_approval is null or jsonb_typeof(expected_approval)<>'object' or a.data->'approval' is distinct from expected_approval then raise exception 'Approval changed; refresh your dashboard';end if;
 update applications set letter_downloaded_at=coalesce(letter_downloaded_at,now()) where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Approval letter download initiated',a.code);
  insert into notifications(kind,reference,audience,payload) values('Approval letter downloaded',a.code,'admin',jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id,'paymentReleased',a.payment_released_at is not null));
end $$;
revoke all on function public.record_approval_letter_download(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_approval_letter_download(uuid,uuid,jsonb) to service_role;
