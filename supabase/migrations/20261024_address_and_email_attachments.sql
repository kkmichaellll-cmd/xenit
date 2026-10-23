-- Run after the two 20261023 migrations. Safe to rerun.
begin;
create or replace function public.valid_deposit_settings(settings jsonb) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(settings)='object'
 and length(btrim(settings->>'landlordName')) between 1 and 150
 and length(btrim(settings->>'mailingAddress')) between 1 and 500
 and length(btrim(settings->>'city')) between 1 and 100
 and length(btrim(settings->>'state')) between 1 and 100
 and settings->>'zipCode' ~ '^\d{5}(-\d{4})?$'
 and length(btrim(settings->>'purpose')) between 1 and 100
 and jsonb_typeof(settings->'noPostalMoneyOrders')='boolean'
 and case when settings->>'amount' ~ '^\d{1,8}(\.\d{1,2})?$'
 then (settings->>'amount')::numeric>0 and (settings->>'amount')::numeric<=10000000 else false end,false);
$$;
alter table public.notifications add column if not exists parts_sent integer not null default 0;

-- Snapshot each submission before delivery so a later resubmission cannot replace its attachments.
create or replace function public.notification_submission(event_kind text,event_reference text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a applications; details jsonb; docs jsonb:='[]'; row_data jsonb; table_name text; owner_id uuid;
begin
 if event_kind in ('Account registered','Profile submitted') then
  if event_reference !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null;end if;
  owner_id:=event_reference::uuid;
  select jsonb_build_object('email',email) into details from auth.users where id=owner_id;
  if event_kind='Profile submitted' then select coalesce(details,'{}')||data into details from profiles where user_id=owner_id;end if;
  return jsonb_build_object('ownerId',owner_id,'details',coalesce(details,'{}'),'documents',docs);
 end if;
 if event_kind not in ('Application submitted','Payment receipt submitted','Mailing receipt submitted','Signed lease submitted','First month rent + security deposit receipt submitted','Move-in mailing receipt submitted','Access card photo submitted') then return null;end if;
 select * into a from applications where code=event_reference;
 if a.id is null then raise exception 'Notification application not found';end if;
 details:=jsonb_build_object('applicationCode',a.code,'applicant',a.data->>'name','email',a.data->>'email','property',a.data->>'propertyTitle');
 if event_kind='Application submitted' then
  details:=details||(a.data-'approval'-'decisionNote');
  select coalesce(jsonb_agg(jsonb_build_object('path',value->>'path','filename',key||'-'||(value->>'filename')) order by key),'[]')
  into docs from application_verifications v cross join lateral jsonb_each(v.documents) where v.application_id=a.id;
 else
  table_name:=case event_kind when 'Payment receipt submitted' then 'receipts' when 'Mailing receipt submitted' then 'mailing_receipts' when 'Signed lease submitted' then 'signed_leases' when 'First month rent + security deposit receipt submitted' then 'move_in_receipts' when 'Move-in mailing receipt submitted' then 'move_in_mailing_receipts' else 'access_cards' end;
  execute format('select to_jsonb(r) from public.%I r where application_id=$1 order by created_at desc limit 1',table_name) into row_data using a.id;
  if row_data is null then raise exception 'Submission document not found';end if;
  details:=details||(row_data-'path'-'photo_path'-'user_id'-'application_id'-'approved_by'-'decided_by');
  docs:=jsonb_build_array(jsonb_build_object('path',coalesce(row_data->>'path',row_data->>'photo_path'),'filename',coalesce(row_data->>'filename',row_data->>'photo_filename')));
 end if;
 return jsonb_build_object('ownerId',a.user_id,'details',details,'documents',docs);
end $$;

create or replace function public.snapshot_notification_submission() returns trigger
language plpgsql security definer set search_path=public as $$
declare submission jsonb;
begin
 if new.audience<>'admin' then return new;end if;
 submission:=notification_submission(new.kind,new.reference);
 if submission is not null then update notifications set payload=payload||jsonb_build_object('submission',submission) where id=new.id;end if;
 return new;
end $$;
drop trigger if exists snapshot_notification_submission on public.notifications;
-- Application verification documents are inserted after the application notification, in the same transaction.
create constraint trigger snapshot_notification_submission after insert on public.notifications
 deferrable initially deferred for each row execute function public.snapshot_notification_submission();

create or replace function public.mark_notification_part_sent(job_id uuid,completed_parts integer,total_parts integer,sent_provider_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if total_parts<1 or total_parts>5 or completed_parts<1 or completed_parts>total_parts then raise exception 'Invalid email part';end if;
 update notifications set parts_sent=greatest(parts_sent,completed_parts),
 status=case when greatest(parts_sent,completed_parts)>=total_parts then 'sent' else 'pending' end,
 provider_id=sent_provider_id,last_error=null where id=job_id;
end $$;
revoke all on function public.notification_submission(text,text),public.snapshot_notification_submission(),public.mark_notification_part_sent(uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.mark_notification_part_sent(uuid,integer,integer,text) to service_role;
commit;
