-- Mimimi: profile avatar and background image storage
-- Run this once in Supabase Dashboard > SQL Editor.

alter table public.profiles
add column if not exists background_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-assets',
  'profile-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Profile images are publicly viewable" on storage.objects;
create policy "Profile images are publicly viewable"
on storage.objects for select
using (bucket_id = 'profile-assets');

drop policy if exists "Users can upload their own profile images" on storage.objects;
create policy "Users can upload their own profile images"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own profile images" on storage.objects;
create policy "Users can update their own profile images"
on storage.objects for update to authenticated
using (bucket_id = 'profile-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own profile images" on storage.objects;
create policy "Users can delete their own profile images"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-assets' and (storage.foldername(name))[1] = auth.uid()::text);
