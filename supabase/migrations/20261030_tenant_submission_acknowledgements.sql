begin;
-- One acknowledgement per successful submission notification, including resubmissions.
create unique index if not exists notifications_submission_ack_source
 on public.notifications ((payload->>'sourceNotificationId'))
 where kind='Submission received' and audience='tenant';
create or replace function public.acknowledge_tenant_submission()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; recipient_email text; tenant_name text; residence text; label text;
begin
 if new.audience<>'admin' then return new;end if;
 label:=case new.kind
  when 'Profile submitted' then 'profile'
  when 'Application submitted' then 'rental application'
  when 'Payment receipt submitted' then 'deposit payment proof'
  when 'Mailing receipt submitted' then 'deposit mailing receipt'
  when 'Signed lease submitted' then 'signed lease'
  when 'First month rent + security deposit receipt submitted' then 'first month rent and security deposit payment proof'
  when 'Move-in mailing receipt submitted' then 'move-in mailing receipt'
  when 'Access card photo submitted' then 'access-card photo'
  when 'Access card print requested' then 'access-card print request'
  when 'Utility & HOA receipt submitted' then 'HOA and Utility payment proof'
  when 'Utility & HOA mailing receipt submitted' then 'HOA and Utility mailing receipt'
  when 'Rent Special receipt submitted' then 'rent-special payment proof'
  when 'Rent Special mailing receipt submitted' then 'rent-special mailing receipt'
  else null end;
 if label is null then return new;end if;
 -- The application workflow already queues a tenant confirmation; preserve it.
 if new.kind='Application submitted' and exists(select 1 from notifications where audience='tenant' and kind='Application submitted' and reference=new.reference) then return new;end if;
 if new.kind='Profile submitted' then
  select id,email into owner_id,recipient_email from auth.users where id::text=new.reference;
  select data->>'name' into tenant_name from profiles where user_id=owner_id;
 else
  select a.user_id,u.email,a.data->>'name',a.data->>'propertyTitle' into owner_id,recipient_email,tenant_name,residence
   from applications a join auth.users u on u.id=a.user_id where a.code=new.reference;
 end if;
 if recipient_email is null then return new;end if;
 insert into notifications(kind,reference,audience,recipient,payload)
 values('Submission received',new.reference,'tenant',recipient_email,
 jsonb_build_object('name',tenant_name,'property',residence,'submissionLabel',label,'sourceNotificationId',new.id::text))
 on conflict do nothing;
 return new;
end $$;
revoke all on function public.acknowledge_tenant_submission() from public,anon,authenticated;
drop trigger if exists acknowledge_tenant_submission on public.notifications;
create constraint trigger acknowledge_tenant_submission after insert on public.notifications
 deferrable initially deferred for each row execute function public.acknowledge_tenant_submission();
notify pgrst,'reload schema';
commit;
