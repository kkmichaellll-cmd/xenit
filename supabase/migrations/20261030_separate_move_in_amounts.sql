begin;
alter table public.signed_leases add column if not exists first_month_rent numeric;
alter table public.signed_leases add column if not exists security_deposit numeric;
alter table public.move_in_receipts add column if not exists first_month_rent numeric;
alter table public.move_in_receipts add column if not exists security_deposit numeric;
create or replace function public.approve_lease_with_breakdown(actor uuid,lease_id uuid,rent_amount numeric,deposit_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 if rent_amount is null or deposit_amount is null or rent_amount<=0 or deposit_amount<=0
 or rent_amount+deposit_amount>10000000 or rent_amount<>round(rent_amount,2) or deposit_amount<>round(deposit_amount,2)
 then raise exception 'Enter valid rent and security deposit amounts';end if;
 perform 1 from signed_leases where id=lease_id for update;
 if not found then raise exception 'Signed lease not found';end if;
 -- Existing approval retains all signature prerequisites and approval notifications.
 perform approve_signed_lease(actor,lease_id,rent_amount+deposit_amount);
 update signed_leases set first_month_rent=rent_amount,security_deposit=deposit_amount where id=lease_id;
end $$;
revoke all on function public.approve_lease_with_breakdown(uuid,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.approve_lease_with_breakdown(uuid,uuid,numeric,numeric) to service_role;
create or replace function public.snapshot_move_in_breakdown()
returns trigger language plpgsql security definer set search_path=public as $$
declare l signed_leases;
begin
 select * into l from signed_leases where application_id=new.application_id;
 new.first_month_rent:=l.first_month_rent;new.security_deposit:=l.security_deposit;
 if l.first_month_rent is not null and (l.security_deposit is null or new.amount<>l.first_month_rent+l.security_deposit) then raise exception 'Payment breakdown does not match total';end if;
 return new;
end $$;
revoke all on function public.snapshot_move_in_breakdown() from public,anon,authenticated;
drop trigger if exists snapshot_move_in_breakdown on public.move_in_receipts;
create trigger snapshot_move_in_breakdown before insert on public.move_in_receipts for each row execute function public.snapshot_move_in_breakdown();
-- Existing payments are deliberately not split using guessed amounts.
notify pgrst,'reload schema';
commit;
