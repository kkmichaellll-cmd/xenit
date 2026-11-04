begin;
create table if not exists public.lease_drafts (
 application_id uuid primary key references public.applications(id),
 document jsonb not null, version integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), released_at timestamptz
);
alter table public.lease_drafts enable row level security;
revoke all on public.lease_drafts from anon,authenticated;
grant all on public.lease_drafts to service_role;
create or replace function public.save_application_lease(actor uuid,app_id uuid,expected_version integer,document_value jsonb,approve boolean,new_note text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; d lease_drafts; m mailing_receipts;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into a from applications where id=app_id for update;
 if a.id is null or a.status<>'Approved' then raise exception 'Approved application required';end if;
 select * into d from lease_drafts where application_id=app_id for update;
 if coalesce(d.version,0)<>expected_version then raise exception 'Lease changed; reload before saving';end if;
 if d.released_at is not null or exists(select 1 from signed_leases where application_id=app_id) then raise exception 'Released or signed lease is locked';end if;
 select * into m from mailing_receipts where application_id=app_id for update;
 if m.id is null or m.status not in ('Submitted','Approved') then raise exception 'Mailing receipt required';end if;
 if document_value is null or jsonb_typeof(document_value->'values')<>'object' or jsonb_typeof(document_value->'sections')<>'array' or jsonb_array_length(document_value->'sections')<1 then raise exception 'Lease document required';end if;
 insert into lease_drafts(application_id,document,version,updated_by,released_at) values(app_id,document_value,1,actor,case when approve then now() else null end)
 on conflict(application_id) do update set document=excluded.document,version=lease_drafts.version+1,updated_at=now(),updated_by=actor,released_at=excluded.released_at;
 if approve and m.status='Submitted' then perform decide_mailing_receipt(actor,m.id,'Approved',new_note);end if;
 insert into audit_log(actor,action,reference) values(actor,case when approve then 'Lease saved and released with mailing approval' else 'Lease draft saved' end,a.code);
end $$;
create or replace function public.require_saved_lease() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='Approved' and old.status is distinct from new.status and not exists(select 1 from lease_drafts where application_id=new.application_id and released_at is not null) then raise exception 'Save and release the lease before approving this mailing receipt';end if;
 return new;
end $$;
drop trigger if exists require_saved_lease on public.mailing_receipts;
create trigger require_saved_lease before update on public.mailing_receipts for each row execute function public.require_saved_lease();
revoke all on function public.save_application_lease(uuid,uuid,integer,jsonb,boolean,text),public.require_saved_lease() from public,anon,authenticated;
grant execute on function public.save_application_lease(uuid,uuid,integer,jsonb,boolean,text) to service_role;
alter table public.signed_leases add column if not exists lease_version integer;
create or replace function public.bind_signed_lease_version() returns trigger language plpgsql security definer set search_path=public as $$
declare d lease_drafts;
begin
 select * into d from lease_drafts where application_id=new.application_id;
 if d.application_id is null or d.released_at is null then raise exception 'The admin must release the saved lease before it can be signed';end if;
 new.lease_version:=d.version;return new;
end $$;
drop trigger if exists bind_signed_lease_version on public.signed_leases;
create trigger bind_signed_lease_version before insert on public.signed_leases for each row execute function public.bind_signed_lease_version();
revoke all on function public.bind_signed_lease_version() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
