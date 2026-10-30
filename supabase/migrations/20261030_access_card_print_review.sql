begin;
alter table public.access_cards
 add column if not exists print_requested_at timestamptz,
 add column if not exists print_approved_at timestamptz,
 add column if not exists print_approved_by uuid references auth.users(id),
 add column if not exists move_in_charges jsonb;

create or replace function public.access_card_print_action(actor uuid,app_id uuid,action text,charges jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; c access_cards; k text; amount numeric; recipient_email text;
begin
 select * into a from applications where id=app_id for update;
 if not found or a.status<>'Approved' then raise exception 'Approved application required';end if;
 if action='request' then
  if a.user_id<>actor then raise exception 'Not authorized';end if;
 elsif action in ('save','approve') then
  if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 else raise exception 'Invalid action';end if;
 if not exists(select 1 from move_in_mailing_receipts where application_id=app_id and status='Approved') then raise exception 'Mailing approval required';end if;
 select * into c from access_cards where application_id=app_id for update;
 if not found or c.user_id<>a.user_id then raise exception 'Upload access-card photo first';end if;
 if action='request' then
  if c.print_requested_at is null then
   update access_cards set print_requested_at=now() where application_id=app_id;
   insert into notifications(kind,reference,audience,payload) values('Access card print requested',a.code,'admin',jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle'));
  end if;
  return;
 end if;
 if c.print_requested_at is null then raise exception 'Tenant must request printing first';end if;
 if c.print_approved_at is not null then
  if action='approve' and c.move_in_charges=charges then return;end if;
  raise exception 'Access card already approved';
 end if;
 if charges is null or jsonb_typeof(charges)<>'object' then raise exception 'Complete all charges';end if;
 foreach k in array array['hoa','electric','internet','lastRent'] loop
  if jsonb_typeof(charges->k) is distinct from 'number' then raise exception 'Complete all charges';end if;
  amount:=(charges->>k)::numeric;
  if amount<0 or amount>10000000 or amount<>round(amount,2) then raise exception 'Invalid charge';end if;
 end loop;
 update access_cards set move_in_charges=charges where application_id=app_id;
 if action='approve' then
  update access_cards set print_approved_at=now(),print_approved_by=actor where application_id=app_id;
  select email into recipient_email from auth.users where id=a.user_id;
  insert into notifications(kind,reference,audience,recipient,payload) values('Access card approved',a.code,'tenant',recipient_email,jsonb_build_object('name',a.data->>'name','property',a.data->>'propertyTitle'));
 end if;
end $$;
revoke all on function public.access_card_print_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.access_card_print_action(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
