-- Run once after 20261017_lease_workflow.sql on existing installations.
alter table public.signed_leases drop constraint if exists signed_leases_status_check;
alter table public.signed_leases add constraint signed_leases_status_check
  check(status in ('Submitted','Approved'));
alter table public.signed_leases add column if not exists payment_due numeric;
alter table public.signed_leases add column if not exists approved_at timestamptz;
alter table public.signed_leases add column if not exists approved_by uuid references auth.users(id);
alter table public.signed_leases drop constraint if exists signed_leases_payment_due_check;
alter table public.signed_leases add constraint signed_leases_payment_due_check
  check(payment_due is null or (payment_due > 0 and payment_due <= 10000000));

create or replace function public.approve_signed_lease(actor uuid,lease_id uuid,amount_due numeric)
returns void language plpgsql security definer set search_path=public as $$
declare l signed_leases;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Not authorized';end if;
 if amount_due is null or amount_due <= 0 or amount_due > 10000000 then raise exception 'Invalid payment amount';end if;
 select * into l from signed_leases where id=lease_id for update;
 if l.id is null then raise exception 'Signed lease not found';end if;
 if l.status<>'Submitted' then raise exception 'Signed lease already reviewed';end if;
 update signed_leases
 set status='Approved',payment_due=amount_due,approved_at=now(),approved_by=actor
 where id=lease_id;
 insert into audit_log(actor,action,reference)
 values(actor,'Signed lease approved and move-in payment revealed',lease_id::text);
end $$;

revoke all on function public.approve_signed_lease(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.approve_signed_lease(uuid,uuid,numeric) to service_role;
