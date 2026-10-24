-- Separate public marketing pages. No existing application/payment data is changed.
begin;
create table if not exists public.property_availability (
 id uuid primary key default gen_random_uuid(),
 data jsonb not null check(jsonb_typeof(data)='object'),
 published boolean not null default false,
 updated_at timestamptz not null default clock_timestamp()
);
create or replace function public.touch_property_availability() returns trigger
language plpgsql set search_path=public as $$
begin
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 return new;
end $$;
drop trigger if exists property_availability_updated on public.property_availability;
create trigger property_availability_updated before update on public.property_availability
for each row execute function public.touch_property_availability();
revoke all on function public.touch_property_availability() from public,anon,authenticated;
alter table public.property_availability enable row level security;
revoke all on public.property_availability from anon,authenticated;
grant select,insert,update on public.property_availability to service_role;
-- Public image bucket, admin-signed uploads only. No anonymous upload policy is added.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('availability-images','availability-images',true,20971520,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
commit;
