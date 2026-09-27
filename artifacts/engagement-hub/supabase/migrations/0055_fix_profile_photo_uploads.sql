-- Fix profile photo replacement and keep every user's uploads inside their
-- own folder. Apply to both the C9MYR and C6 Supabase projects.

begin;

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view post images" on storage.objects;
create policy "Anyone can view post images"
on storage.objects for select
using (bucket_id = 'post-images');

drop policy if exists "Authenticated users can upload post images" on storage.objects;
drop policy if exists "Approved users can upload their own post images" on storage.objects;
create policy "Approved users can upload their own post images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_approved_user()
);

drop policy if exists "Users can update their own post images" on storage.objects;
drop policy if exists "Approved users can update their own post images" on storage.objects;
create policy "Approved users can update their own post images"
on storage.objects for update to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_approved_user()
)
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_approved_user()
);

drop policy if exists "Users can delete their own post images" on storage.objects;
drop policy if exists "Approved users can delete their own post images" on storage.objects;
create policy "Approved users can delete their own post images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_approved_user()
);

commit;
