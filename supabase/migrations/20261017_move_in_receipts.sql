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
