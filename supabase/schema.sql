-- Run once in the SQL editor of a NEW Supabase project.
create table public.admins(user_id uuid primary key references auth.users(id));
create table public.profiles(user_id uuid primary key references auth.users(id), data jsonb not null);
create table public.properties(id text primary key, data jsonb not null, payment jsonb not null default '{}', created_at timestamptz default now());
create table public.applications(id uuid primary key, user_id uuid not null references auth.users(id), property_id text not null references public.properties(id), code text unique not null default ('APP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))), status text not null check(status in ('Draft','Pending','Approved','Declined')), data jsonb not null, created_at timestamptz default now(), updated_at timestamptz not null default now());
create table public.receipts(id uuid primary key, application_id uuid not null references public.applications(id), user_id uuid not null references auth.users(id), path text not null, filename text not null, tracking text, amount numeric not null, payee text not null, status text not null default 'Pending review' check(status in ('Pending review','Approved')), created_at timestamptz default now(), approved_at timestamptz, approved_by uuid references auth.users(id));
create unique index one_receipt_per_application on public.receipts(application_id);
create table public.notifications(id uuid primary key default gen_random_uuid(), kind text not null, reference text not null, status text not null default 'pending' check(status in ('pending','sent')), provider_id text, last_error text, created_at timestamptz default now());
create table public.audit_log(id bigint generated always as identity primary key, actor uuid, action text not null, reference text not null, created_at timestamptz default now());
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.applications enable row level security;
alter table public.receipts enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
-- Intentionally NO anonymous/authenticated policies. Only the server uses the service role.
revoke all on public.admins, public.profiles, public.properties, public.applications, public.receipts, public.notifications, public.audit_log from anon, authenticated;
create function public.notify_signup() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into notifications(kind,reference) values('Account registered',new.id::text);return new;end $$;
create trigger account_notification after insert on auth.users for each row execute function public.notify_signup();
create function public.notify_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into notifications(kind,reference) values('Profile submitted',new.user_id::text);return new;end $$;
create trigger profile_notification after insert or update on public.profiles for each row execute function public.notify_profile();
create function public.submit_application(actor uuid,app_id uuid,property_key text,new_status text,details jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare a applications; begin
 select * into a from applications where id=app_id for update;
 if found then
  if a.user_id<>actor then raise exception 'Not authorized';end if;
  if a.status<>'Draft' then return jsonb_build_object('id',a.id,'code',a.code,'status',a.status);end if;
  update applications set data=details,status=new_status,updated_at=now() where id=app_id returning * into a;
 else insert into applications(id,user_id,property_id,status,data) values(app_id,actor,property_key,new_status,details) returning * into a;end if;
 if new_status='Pending' then insert into notifications(kind,reference) values('Application submitted',a.code);end if;
 return jsonb_build_object('id',a.id,'code',a.code,'status',a.status);
end $$;
create function public.decide_application(actor uuid,app_id uuid,expected_version timestamptz,new_status text,new_note text,approval_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare a applications; begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into a from applications where id=app_id for update;
 if a.id is null or a.updated_at<>expected_version or a.status='Draft' then raise exception 'Application changed; refresh';end if;
 if exists(select 1 from receipts where application_id=app_id) and new_status<>'Approved' then raise exception 'Resolve payment before changing application';end if;
 update applications set status=new_status,data=data||jsonb_build_object('decisionNote',new_note,'approval',approval_data),updated_at=now() where id=app_id;
 insert into audit_log(actor,action,reference) values(actor,'Application '||new_status,a.code);
end $$;
create function public.submit_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text,amount_value numeric,payee_value text) returns void language plpgsql security definer set search_path=public as $$
declare a applications; begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if exists(select 1 from receipts where application_id=app_id) then raise exception 'Receipt already submitted';end if;
 insert into receipts(id,application_id,user_id,path,filename,tracking,amount,payee) values(receipt_id,app_id,actor,object_path,file_name,tracking_value,amount_value,payee_value);
 insert into notifications(kind,reference) values('Payment receipt submitted',a.code);
end $$;
create function public.approve_receipt(actor uuid,receipt_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r receipts; begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into r from receipts where id=receipt_id for update;
 if r.id is null then raise exception 'Receipt not found';end if;
 if not exists(select 1 from applications where id=r.application_id and status='Approved') then raise exception 'Approved application required';end if;
 if r.status='Approved' then return;end if;
 update receipts set status='Approved',approved_at=now(),approved_by=actor where id=receipt_id;
 insert into audit_log(actor,action,reference) values(actor,'Payment approved',receipt_id::text);
end $$;
revoke all on function public.submit_application(uuid,uuid,text,text,jsonb),public.decide_application(uuid,uuid,timestamptz,text,text,jsonb),public.submit_receipt(uuid,uuid,uuid,text,text,text,numeric,text),public.approve_receipt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_application(uuid,uuid,text,text,jsonb),public.decide_application(uuid,uuid,timestamptz,text,text,jsonb),public.submit_receipt(uuid,uuid,uuid,text,text,text,numeric,text),public.approve_receipt(uuid,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,3000000,array['image/jpeg','image/png','application/pdf']);
-- No public Storage policies. Access is via short-lived server-authorized download URLs.

-- Mailing receipt workflow (included for new installations).
create table public.mailing_receipts(id uuid primary key,application_id uuid not null unique references public.applications(id),user_id uuid not null references auth.users(id),path text not null,filename text not null,tracking text,status text not null default 'Submitted' check(status='Submitted'),created_at timestamptz not null default now());
alter table public.mailing_receipts enable row level security;
revoke all on public.mailing_receipts from anon,authenticated;
grant all on public.mailing_receipts to service_role;
create function public.submit_mailing_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text) returns void language plpgsql security definer set search_path=public as $$
declare a applications; begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from receipts where application_id=app_id and status='Approved') then raise exception 'Payment approval required';end if;
 if exists(select 1 from mailing_receipts where application_id=app_id) then raise exception 'Mailing receipt already submitted';end if;
 insert into mailing_receipts(id,application_id,user_id,path,filename,tracking) values(receipt_id,app_id,actor,object_path,file_name,tracking_value);
 insert into notifications(kind,reference) values('Mailing receipt submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Mailing receipt submitted',a.code);
end $$;
revoke all on function public.submit_mailing_receipt(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_mailing_receipt(uuid,uuid,uuid,text,text,text) to service_role;
-- Run once after 20261017_mailing_receipts.sql on existing installations.
alter table public.mailing_receipts drop constraint if exists mailing_receipts_status_check;
alter table public.mailing_receipts add constraint mailing_receipts_status_check check(status in ('Submitted','Approved','Declined'));
alter table public.mailing_receipts add column if not exists decision_note text;
alter table public.mailing_receipts add column if not exists decided_at timestamptz;
alter table public.mailing_receipts add column if not exists decided_by uuid references auth.users(id);

create table public.signed_leases(
 id uuid primary key,
 application_id uuid not null unique references public.applications(id),
 user_id uuid not null references auth.users(id),
 path text not null,
 filename text not null,
 status text not null default 'Submitted' check(status='Submitted'),
 created_at timestamptz not null default now()
);
alter table public.signed_leases enable row level security;
revoke all on public.signed_leases from anon,authenticated;
grant all on public.signed_leases to service_role;

create function public.decide_mailing_receipt(actor uuid,receipt_id uuid,new_status text,new_note text) returns void language plpgsql security definer set search_path=public as $$
declare r mailing_receipts; begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if new_status not in ('Approved','Declined') then raise exception 'Invalid status';end if;
 select * into r from mailing_receipts where id=receipt_id for update;
 if r.id is null then raise exception 'Mailing receipt not found';end if;
 update mailing_receipts set status=new_status,decision_note=left(coalesce(new_note,''),1000),decided_at=now(),decided_by=actor where id=receipt_id;
 insert into audit_log(actor,action,reference) values(actor,'Mailing receipt '||new_status,receipt_id::text);
end $$;

create function public.submit_signed_lease(actor uuid,app_id uuid,lease_id uuid,object_path text,file_name text) returns void language plpgsql security definer set search_path=public as $$
declare a applications; begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Mailing receipt approval required';end if;
 if exists(select 1 from signed_leases where application_id=app_id) then raise exception 'Signed lease already submitted';end if;
 insert into signed_leases(id,application_id,user_id,path,filename) values(lease_id,app_id,actor,object_path,file_name);
 insert into notifications(kind,reference) values('Signed lease submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Signed lease submitted',a.code);
end $$;

revoke all on function public.decide_mailing_receipt(uuid,uuid,text,text),public.submit_signed_lease(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.decide_mailing_receipt(uuid,uuid,text,text),public.submit_signed_lease(uuid,uuid,uuid,text,text) to service_role;

-- Signed lease approval and move-in payment reveal.
alter table public.signed_leases drop constraint if exists signed_leases_status_check;
alter table public.signed_leases add constraint signed_leases_status_check check(status in ('Submitted','Approved'));
alter table public.signed_leases add column if not exists payment_due numeric;
alter table public.signed_leases add column if not exists approved_at timestamptz;
alter table public.signed_leases add column if not exists approved_by uuid references auth.users(id);
alter table public.signed_leases drop constraint if exists signed_leases_payment_due_check;
alter table public.signed_leases add constraint signed_leases_payment_due_check check(payment_due is null or (payment_due>0 and payment_due<=10000000));

create or replace function public.approve_signed_lease(actor uuid,lease_id uuid,amount_due numeric) returns void language plpgsql security definer set search_path=public as $$
declare l signed_leases; begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if amount_due is null or amount_due<=0 or amount_due>10000000 then raise exception 'Invalid payment amount';end if;
 select * into l from signed_leases where id=lease_id for update;
 if l.id is null then raise exception 'Signed lease not found';end if;
 if l.status<>'Submitted' then raise exception 'Signed lease already reviewed';end if;
 update signed_leases set status='Approved',payment_due=amount_due,approved_at=now(),approved_by=actor where id=lease_id;
 insert into audit_log(actor,action,reference) values(actor,'Signed lease approved and move-in payment revealed',lease_id::text);
end $$;
revoke all on function public.approve_signed_lease(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.approve_signed_lease(uuid,uuid,numeric) to service_role;

-- Run after 20261017_lease_payment_reveal.sql on existing installations.
create table public.move_in_receipts(
 id uuid primary key,
 application_id uuid not null unique references public.applications(id),
 user_id uuid not null references auth.users(id),
 path text not null,
 filename text not null,
 tracking text not null default '',
 amount numeric not null check(amount > 0 and amount <= 10000000),
 payee text not null,
 status text not null default 'Pending review' check(status in ('Pending review','Approved')),
 created_at timestamptz not null default now(),
 approved_at timestamptz,
 approved_by uuid references auth.users(id)
);
alter table public.move_in_receipts enable row level security;
revoke all on public.move_in_receipts from anon,authenticated;
grant all on public.move_in_receipts to service_role;

create function public.submit_move_in_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; l signed_leases; p properties;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 select * into l from signed_leases where application_id=app_id;
 if l.id is null or l.status<>'Approved' or l.payment_due is null or l.payment_due<=0 then raise exception 'Move-in payment not released';end if;
 if exists(select 1 from move_in_receipts where application_id=app_id) then raise exception 'Receipt already submitted';end if;
 select * into p from properties where id=a.property_id;
 if coalesce(p.payment->>'landlordName','')='' or coalesce(p.payment->>'mailingAddress','')='' then raise exception 'Payment instructions unavailable';end if;
 insert into move_in_receipts(id,application_id,user_id,path,filename,tracking,amount,payee)
 values(receipt_id,app_id,actor,object_path,file_name,tracking_value,l.payment_due,p.payment->>'landlordName');
 insert into notifications(kind,reference) values('First month rent + security deposit receipt submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Move-in payment receipt submitted',a.code);
end $$;

create function public.approve_move_in_receipt(actor uuid,receipt_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r move_in_receipts;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 select * into r from move_in_receipts where id=receipt_id for update;
 if r.id is null then raise exception 'Receipt not found';end if;
 if r.status<>'Pending review' then raise exception 'Receipt already reviewed';end if;
 update move_in_receipts set status='Approved',approved_at=now(),approved_by=actor where id=receipt_id;
 insert into audit_log(actor,action,reference) values(actor,'Move-in payment receipt approved',receipt_id::text);
end $$;
revoke all on function public.submit_move_in_receipt(uuid,uuid,uuid,text,text,text),public.approve_move_in_receipt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_move_in_receipt(uuid,uuid,uuid,text,text,text),public.approve_move_in_receipt(uuid,uuid) to service_role;
-- Run after 20261017_move_in_receipts.sql on existing installations.
create table public.move_in_mailing_receipts(
 id uuid primary key,
 application_id uuid not null unique references public.applications(id),
 user_id uuid not null references auth.users(id),
 path text not null,
 filename text not null,
 tracking text not null default '',
 status text not null default 'Submitted' check(status in ('Submitted','Approved','Declined')),
 decision_note text,
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id)
);
alter table public.move_in_mailing_receipts enable row level security;
revoke all on public.move_in_mailing_receipts from anon,authenticated;
grant all on public.move_in_mailing_receipts to service_role;

create table public.access_cards(
 application_id uuid primary key references public.applications(id),
 user_id uuid not null references auth.users(id),
 photo_path text not null,
 photo_filename text not null,
 created_at timestamptz not null default now()
);
alter table public.access_cards enable row level security;
revoke all on public.access_cards from anon,authenticated;
grant all on public.access_cards to service_role;

create function public.submit_move_in_mailing_receipt(actor uuid,app_id uuid,receipt_id uuid,object_path text,file_name text,tracking_value text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from move_in_receipts where application_id=app_id and status='Approved') then raise exception 'Move-in payment approval required';end if;
 if exists(select 1 from move_in_mailing_receipts where application_id=app_id and status<>'Declined') then raise exception 'Mailing receipt already submitted';end if;
 if exists(select 1 from move_in_mailing_receipts where application_id=app_id and status='Declined') then
  update move_in_mailing_receipts set id=receipt_id,path=object_path,filename=file_name,tracking=tracking_value,status='Submitted',decision_note=null,created_at=now(),decided_at=null,decided_by=null where application_id=app_id;
 else
  insert into move_in_mailing_receipts(id,application_id,user_id,path,filename,tracking)
  values(receipt_id,app_id,actor,object_path,file_name,tracking_value);
 end if;
 insert into notifications(kind,reference) values('Move-in mailing receipt submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Move-in mailing receipt submitted',a.code);
end $$;

create function public.decide_move_in_mailing_receipt(actor uuid,receipt_id uuid,new_status text,new_note text)
returns void language plpgsql security definer set search_path=public as $$
declare r move_in_mailing_receipts;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if new_status not in ('Approved','Declined') then raise exception 'Invalid status';end if;
 select * into r from move_in_mailing_receipts where id=receipt_id for update;
 if r.id is null then raise exception 'Mailing receipt not found';end if;
 if r.status<>'Submitted' then raise exception 'Mailing receipt already reviewed';end if;
 update move_in_mailing_receipts set status=new_status,decision_note=left(coalesce(new_note,''),1000),decided_at=now(),decided_by=actor where id=receipt_id;
 insert into audit_log(actor,action,reference) values(actor,'Move-in mailing receipt '||new_status,receipt_id::text);
end $$;

create function public.create_access_card(actor uuid,app_id uuid,object_path text,file_name text)
returns void language plpgsql security definer set search_path=public as $$
declare a applications;
begin
 select * into a from applications where id=app_id for update;
 if a.id is null or a.user_id<>actor or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from move_in_mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Mailing receipt approval required';end if;
 if exists(select 1 from access_cards where application_id=app_id) then raise exception 'Access card photo already uploaded';end if;
 insert into access_cards(application_id,user_id,photo_path,photo_filename) values(app_id,actor,object_path,file_name);
 insert into notifications(kind,reference) values('Access card photo submitted',a.code);
 insert into audit_log(actor,action,reference) values(actor,'Access card photo submitted',a.code);
end $$;

revoke all on function public.submit_move_in_mailing_receipt(uuid,uuid,uuid,text,text,text),public.decide_move_in_mailing_receipt(uuid,uuid,text,text),public.create_access_card(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_move_in_mailing_receipt(uuid,uuid,uuid,text,text,text),public.decide_move_in_mailing_receipt(uuid,uuid,text,text),public.create_access_card(uuid,uuid,text,text) to service_role;

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
-- One active admin login per account. Only the authorized server may call these RPCs.
create table public.admin_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null,
 expires_at timestamptz not null
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from public, anon, authenticated;
grant all on public.admin_sessions to service_role;

create or replace function public.admin_session_claim(actor uuid, session uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 if not exists(select 1 from public.admins where user_id=actor) then return false; end if;
 if not exists(select 1 from auth.sessions where id=session and user_id=actor and (not_after is null or not_after>now())) then return false; end if;
 -- Conflict-row locking makes simultaneous logins atomic: only one can win.
 insert into public.admin_sessions(user_id,session_id,expires_at)
 values(actor,session,now()+interval '12 hours')
 on conflict(user_id) do update set session_id=excluded.session_id,
 expires_at=case when admin_sessions.session_id=excluded.session_id and admin_sessions.expires_at>now()
 then admin_sessions.expires_at else excluded.expires_at end
 where admin_sessions.expires_at<=now() or admin_sessions.session_id=excluded.session_id
 returning session_id into claimed;
 return claimed is not null;
end $$;

create or replace function public.admin_session_check(actor uuid, session uuid)
returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from public.admin_sessions a join public.admins d on d.user_id=a.user_id
 join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id
 where a.user_id=actor and a.session_id=session and a.expires_at>now() and (s.not_after is null or s.not_after>now()));
$$;

create or replace function public.admin_session_release(actor uuid, session uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 delete from public.admin_sessions where user_id=actor and session_id=session;
 return true;
end $$;
revoke all on function public.admin_session_claim(uuid,uuid),public.admin_session_check(uuid,uuid),public.admin_session_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_session_claim(uuid,uuid),public.admin_session_check(uuid,uuid),public.admin_session_release(uuid,uuid) to service_role;
