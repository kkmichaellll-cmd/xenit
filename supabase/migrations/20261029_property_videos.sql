-- Public apartment videos. Uploads require an admin-authorized signed token.
-- Metadata is stored in the existing property/availability JSON data.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('property-videos','property-videos',true,20971520,array['video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
-- No anonymous or authenticated write policy is added.
commit;
