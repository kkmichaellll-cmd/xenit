-- Private staging for large manual admin email attachments.
-- No client read/list/write policy: server-issued signed upload URLs only.
insert into storage.buckets (id,name,public,file_size_limit)
values ('email-attachments','email-attachments',false,20971520)
on conflict (id) do update set public=false,file_size_limit=20971520;
-- Expired staging files are cleaned opportunistically on this admin's later uploads.
-- It is safe to remove staged objects older than 24 hours: tickets have expired,
-- and saved drafts / Sent contain independent copies in the IMAP mailbox.
