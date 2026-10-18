-- Run once on existing installations after the 20261017 migrations.
create table public.application_verifications(
 application_id uuid primary key references public.applications(id) on delete cascade,
 ssn_last4 text not null default '' check(ssn_last4='' or ssn_last4 ~ '^[0-9]{4}$'),
 id_type text not null,
 documents jsonb not null default '{}'
);
alter table public.application_verifications enable row level security;
revoke all on public.application_verifications from public,anon,authenticated;
grant all on public.application_verifications to service_role;

create function public.submit_verified_application(actor uuid,app_id uuid,property_key text,new_status text,details jsonb,ssn_value text,id_type_value text,documents_value jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a applications; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(app_id::text,0));
 select * into a from applications where id=app_id for update;
 if a.id is not null then
  if a.user_id<>actor then raise exception 'Not authorized';end if;
  if a.status<>'Draft' then raise exception 'Application already submitted';end if;
 end if;
 if new_status='Pending' and (ssn_value !~ '^[0-9]{4}$' or not documents_value ?& array['idFront','idBack','incomeProof','addressProof']) then raise exception 'Verification incomplete';end if;
 result:=submit_application(actor,app_id,property_key,new_status,details);
 insert into application_verifications(application_id,ssn_last4,id_type,documents) values(app_id,ssn_value,id_type_value,documents_value)
 on conflict(application_id) do update set ssn_last4=excluded.ssn_last4,id_type=excluded.id_type,documents=excluded.documents;
 if new_status='Draft' then insert into notifications(kind,reference) values('Application draft saved',result->>'code');end if;
 return result;
end $$;
revoke all on function public.submit_verified_application(uuid,uuid,text,text,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_verified_application(uuid,uuid,text,text,jsonb,text,text,jsonb) to service_role;

alter table public.notifications add column audience text not null default 'admin';
alter table public.notifications add column recipient text;
alter table public.notifications add column payload jsonb not null default '{}';
create function public.queue_approval_email() returns trigger language plpgsql security definer set search_path=public as $$
declare a applications; email_value text; event_name text;
begin
 if new.status<>'Approved' or old.status='Approved' then return new;end if;
 if tg_table_name='applications' then a:=new;else select * into a from applications where id=new.application_id;end if;
 select email into email_value from auth.users where id=a.user_id;
 event_name:=case tg_table_name when 'applications' then 'Application approved' when 'receipts' then 'Holding payment approved' when 'mailing_receipts' then 'Mailing validation approved' when 'signed_leases' then 'Lease approved' when 'move_in_receipts' then 'Move-in payment approved' else 'Access card ready' end;
 insert into notifications(kind,reference,audience,recipient,payload) values(event_name,a.code,'tenant',email_value,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id));
 return new;
end $$;
create trigger approval_email after update on applications for each row execute function queue_approval_email();
create trigger approval_email after update on receipts for each row execute function queue_approval_email();
create trigger approval_email after update on mailing_receipts for each row execute function queue_approval_email();
create trigger approval_email after update on signed_leases for each row execute function queue_approval_email();
create trigger approval_email after update on move_in_receipts for each row execute function queue_approval_email();
create trigger approval_email after update on move_in_mailing_receipts for each row execute function queue_approval_email();
