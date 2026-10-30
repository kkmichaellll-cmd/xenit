begin;
create or replace function public.approve_access_card_with_utility(actor uuid,app_id uuid,charges jsonb,details jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare a applications; c access_cards; existing_settings jsonb;
begin
 if not exists(select 1 from admins where user_id=actor) then raise exception 'Admin required';end if;
 select * into a from applications where id=app_id for update;
 if not found or a.status<>'Approved' then raise exception 'Approved application required';end if;
 select * into c from access_cards where application_id=app_id for update;
 if not found or c.print_requested_at is null then raise exception 'Print request required';end if;
 select settings into existing_settings from utility_hoa where application_id=app_id;
 if c.print_approved_at is not null and existing_settings is not null then
  if c.move_in_charges=charges and existing_settings=details then return;end if;
  raise exception 'Access card already approved';
 end if;
 -- Both writes and the approval notification commit together or all roll back.
 perform utility_hoa_action(actor,app_id,'save',details);
 perform access_card_print_action(actor,app_id,'approve',charges);
end $$;
revoke all on function public.approve_access_card_with_utility(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.approve_access_card_with_utility(uuid,uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
