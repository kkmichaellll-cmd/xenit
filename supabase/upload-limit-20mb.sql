-- Run once in the Supabase SQL Editor for the project's existing database.
-- This changes only the private document bucket's per-file size limit.
do $$
begin
 if not exists(select 1 from storage.buckets where id='receipts') then
  raise exception 'The receipts bucket is missing. Complete the original storage setup first.';
 end if;
 update storage.buckets set file_size_limit=20971520 where id='receipts';
end $$;

select id, public, file_size_limit from storage.buckets where id='receipts';
