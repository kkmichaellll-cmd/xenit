-- Run in Supabase SQL Editor before deploying the accompanying application files.
-- Keeps ID verification required; income and address documents are optional.
begin;
create or replace function public.submit_verified_application(actor uuid,app_id uuid,property_key text,new_status text,details jsonb,ssn_value text,id_type_value text,documents_value jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a applications; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(app_id::text,0));
 select * into a from applications where id=app_id for update;
 if a.id is not null then
  if a.user_id<>actor then raise exception 'Not authorized';end if;
  if a.status<>'Draft' then raise exception 'Application already submitted';end if;
 end if;
 if new_status='Pending' and (coalesce(ssn_value,'') !~ '^[0-9]{4}$' or not coalesce(documents_value,'{}'::jsonb) ?& array['idFront','idBack']) then raise exception 'Verification incomplete';end if;
 result:=submit_application(actor,app_id,property_key,new_status,details);
 insert into application_verifications(application_id,ssn_last4,id_type,documents) values(app_id,ssn_value,id_type_value,documents_value)
 on conflict(application_id) do update set ssn_last4=excluded.ssn_last4,id_type=excluded.id_type,documents=excluded.documents;
 if new_status='Draft' then insert into notifications(kind,reference) values('Application draft saved',result->>'code');end if;
 if new_status='Pending' then
  insert into notifications(kind,reference,audience,recipient,payload)
  select 'Application submitted',result->>'code','tenant',email,
   jsonb_build_object('name',details->>'name','property',details->>'propertyTitle','applicationId',app_id)
  from auth.users where id=actor;
 end if;
 return result;
end $$;
revoke all on function public.submit_verified_application(uuid,uuid,text,text,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_verified_application(uuid,uuid,text,text,jsonb,text,text,jsonb) to service_role;


commit;
