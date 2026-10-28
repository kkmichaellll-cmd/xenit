begin;
create table if not exists public.availability_tour_requests (
 id uuid primary key,
 property_id uuid not null references public.property_availability(id),
 name text not null,
 email text not null,
 starts_at timestamptz not null,
 time_zone text not null,
 created_at timestamptz not null default now()
);
create index if not exists availability_tours_email_created on public.availability_tour_requests(email,created_at);
alter table public.availability_tour_requests enable row level security;
revoke all on public.availability_tour_requests from public,anon,authenticated;
grant all on public.availability_tour_requests to service_role;
create or replace function public.request_availability_tour(request_id uuid,page_id uuid,visitor_name text,visitor_email text,starts_at_value timestamptz,zone_value text,local_date text,local_time text)
returns text language plpgsql security definer set search_path=public as $$
declare page property_availability; previous availability_tour_requests;
begin
 perform pg_advisory_xact_lock(hashtextextended('tour:'||lower(visitor_email),0));
 select * into previous from availability_tour_requests where id=request_id;
 if found then
  if previous.property_id=page_id and previous.email=lower(visitor_email) and previous.starts_at=starts_at_value and previous.name=visitor_name then return 'ok';end if;
  return 'conflict';
 end if;
 select * into page from property_availability where id=page_id and published=true and data->>'pageVersion'='2';
 if not found then return 'unavailable';end if;
 if starts_at_value<=now() or starts_at_value>now()+interval '180 days' then raise exception 'Invalid viewing time';end if;
 if to_char(starts_at_value at time zone zone_value,'YYYY-MM-DD')<>local_date or to_char(starts_at_value at time zone zone_value,'HH24:MI')<>local_time then raise exception 'Invalid local time';end if;
 if (select count(*) from availability_tour_requests where email=lower(visitor_email) and created_at>now()-interval '1 hour')>=5 then return 'limited';end if;
 insert into availability_tour_requests(id,property_id,name,email,starts_at,time_zone) values(request_id,page_id,visitor_name,lower(visitor_email),starts_at_value,zone_value);
 insert into notifications(kind,reference,audience,payload) values('Property tour requested',request_id::text,'admin',jsonb_build_object('propertyId',page_id,'property',page.data->>'title','address',page.data->>'location','name',visitor_name,'email',lower(visitor_email),'date',local_date,'time',local_time,'timeZone',zone_value,'startsAt',starts_at_value));
 return 'ok';
end $$;
revoke all on function public.request_availability_tour(uuid,uuid,text,text,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.request_availability_tour(uuid,uuid,text,text,timestamptz,text,text,text) to service_role;
commit;
