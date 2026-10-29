begin;
create table if not exists public.utility_hoa (
 application_id uuid primary key references public.applications(id),
 printed_at timestamptz, settings jsonb, released_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.utility_hoa enable row level security;
revoke all on public.utility_hoa from public,anon,authenticated;
grant all on public.utility_hoa to service_role;
create or replace function public.utility_hoa_action(actor uuid,app_id uuid,action text,details jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; u utility_hoa; k text; amount numeric; recipient_email text;
begin
 select * into a from applications where id=app_id for update;
 if not found or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if not exists(select 1 from access_cards where application_id=app_id) or not exists(select 1 from move_in_mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Access card and mailing approval required';end if;
 insert into utility_hoa(application_id) values(app_id) on conflict do nothing;
 select * into u from utility_hoa where application_id=app_id for update;
 if action='print' then
  if a.user_id<>actor then raise exception 'Not authorized';end if;
  if u.printed_at is null then
   update utility_hoa set printed_at=now(),updated_at=now() where application_id=app_id;
   insert into notifications(kind,reference,audience,payload) values('Access card print requested',a.code,'admin',jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle'));
  end if;
 elsif action in ('save','release') then
  if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
  if u.printed_at is null then raise exception 'Tenant must request printing first';end if;
  if action='save' then
   if u.released_at is not null then raise exception 'Payment already released';end if;
   foreach k in array array['hoa','electric','internet','lastRent'] loop
    if details->>k is null then raise exception 'Complete all fees';end if;
    amount:=(details->>k)::numeric;
    if amount<0 or amount>10000000 or amount<>round(amount,2) then raise exception 'Invalid fee';end if;
   end loop;
   foreach k in array array['landlordName','mailingAddress','city','state','zipCode','purpose'] loop
    if length(trim(coalesce(details->>k,'')))=0 then raise exception 'Complete payment details';end if;
   end loop;
   if details->>'zipCode' !~ '^\d{5}(-\d{4})?$' or jsonb_typeof(details->'paymentSteps')<>'array' or jsonb_array_length(details->'paymentSteps')<>4 or jsonb_typeof(details->'noPostalMoneyOrders')<>'boolean' then raise exception 'Invalid payment settings';end if;
   update utility_hoa set settings=details,updated_at=now() where application_id=app_id;
  else
   if u.settings is null then raise exception 'Save fees before approval';end if;
   if u.released_at is null then
    update utility_hoa set released_at=now(),updated_at=now() where application_id=app_id;
    select email into recipient_email from auth.users where id=a.user_id;
    insert into notifications(kind,reference,audience,recipient,payload) values('Utility & HOA available',a.code,'tenant',recipient_email,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle'));
   end if;
  end if;
 else raise exception 'Invalid action';end if;
end $$;
revoke all on function public.utility_hoa_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.utility_hoa_action(uuid,uuid,text,jsonb) to service_role;
commit;
