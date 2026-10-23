-- Run after the previous Xenit workflow migrations. Safe to run again.
-- Existing tenant uploads and previously approved lease/payment records are preserved.
alter table public.signed_leases add column if not exists completed_path text;
alter table public.signed_leases add column if not exists completed_filename text;
alter table public.signed_leases add column if not exists landlord_name text;
alter table public.signed_leases add column if not exists landlord_signed_at timestamptz;
alter table public.signed_leases add column if not exists landlord_signed_by uuid references auth.users(id);
alter table public.signed_leases add column if not exists tenant_source_hash text;

create or replace function public.countersign_lease(actor uuid,lease_id uuid,expected_source text,object_path text,file_name text,landlord_name_value text,signed_at_value timestamptz,source_hash text)
returns void language plpgsql security definer set search_path=public as $$
declare l signed_leases; a applications; recipient_email text;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into l from signed_leases where id=lease_id for update;
 if l.id is null then raise exception 'Tenant-signed lease not found';end if;
 if l.completed_path is not null then raise exception 'Landlord signature already submitted';end if;
 if expected_source is null or l.path<>expected_source then raise exception 'Tenant lease changed; refresh and review again';end if;
 select * into a from applications where id=l.application_id;
 if a.status is distinct from 'Approved' then raise exception 'Approved application required';end if;
 if landlord_name_value is null or length(trim(landlord_name_value)) not between 2 and 150 then raise exception 'Landlord name required';end if;
 if object_path is null or object_path !~ ('^'||l.user_id::text||'/completed-lease-[0-9a-f-]{36}\.pdf$') then raise exception 'Invalid completed lease path';end if;
 if file_name is null or length(file_name) not between 1 and 200 or file_name !~ '\.pdf$' then raise exception 'Invalid filename';end if;
 if source_hash is null or source_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid source hash';end if;
 if signed_at_value is null or signed_at_value < now()-interval '10 minutes' or signed_at_value > now()+interval '1 minute' then raise exception 'Signature expired; submit again';end if;
 update signed_leases set completed_path=object_path,completed_filename=file_name,landlord_name=trim(landlord_name_value),landlord_signed_at=signed_at_value,landlord_signed_by=actor,tenant_source_hash=source_hash where id=lease_id;
 select email into recipient_email from auth.users where id=l.user_id;
 insert into notifications(kind,reference,audience,recipient,payload) values('Lease countersigned',a.code,'tenant',recipient_email,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle','applicationId',a.id));
 insert into audit_log(actor,action,reference) values(actor,'Landlord signed lease',lease_id::text);
end $$;

-- Keep the existing explicit amount review, but require the landlord-signed copy first.
create or replace function public.approve_signed_lease(actor uuid,lease_id uuid,amount_due numeric)
returns void language plpgsql security definer set search_path=public as $$
declare l signed_leases;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if amount_due is null or amount_due <= 0 or amount_due > 10000000 then raise exception 'Invalid payment amount';end if;
 select * into l from signed_leases where id=lease_id for update;
 if l.id is null then raise exception 'Signed lease not found';end if;
 if l.status<>'Submitted' then raise exception 'Signed lease already reviewed';end if;
 if l.completed_path is null then raise exception 'Submit the landlord-signed lease first';end if;
 update signed_leases set status='Approved',payment_due=amount_due,approved_at=now(),approved_by=actor where id=lease_id;
 insert into audit_log(actor,action,reference) values(actor,'Signed lease approved and move-in payment revealed',lease_id::text);
end $$;
revoke all on function public.countersign_lease(uuid,uuid,text,text,text,text,timestamptz,text),public.approve_signed_lease(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.countersign_lease(uuid,uuid,text,text,text,text,timestamptz,text),public.approve_signed_lease(uuid,uuid,numeric) to service_role;
