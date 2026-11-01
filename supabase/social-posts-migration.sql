-- Mimimi social posts and drafts
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  post_type text not null check (post_type in ('simple','advanced')),
  title text,
  content text not null default '',
  cover_url text,
  media_url text,
  media_type text,
  audio_url text,
  background_color text not null default '#FFFFFF',
  background_image_url text,
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_feed_idx on public.social_posts(is_draft, created_at desc);
create index if not exists social_posts_author_drafts_idx on public.social_posts(author_id, is_draft, updated_at desc);
alter table public.social_posts enable row level security;
drop policy if exists "Published posts are visible to signed in users" on public.social_posts;
create policy "Published posts are visible to signed in users" on public.social_posts for select to authenticated using (not is_draft or author_id = auth.uid());
drop policy if exists "Users create their own posts" on public.social_posts;
create policy "Users create their own posts" on public.social_posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Users update their own posts" on public.social_posts;
create policy "Users update their own posts" on public.social_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "Users delete their own posts" on public.social_posts;
create policy "Users delete their own posts" on public.social_posts for delete to authenticated using (author_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-assets', 'post-assets', true, 52428800, array[
'image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm'
])
on conflict (id) do update set public = true, file_size_limit = 52428800,
allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Post assets are publicly readable" on storage.objects;
create policy "Post assets are publicly readable" on storage.objects for select to public using (bucket_id = 'post-assets');
drop policy if exists "Users upload own post assets" on storage.objects;
create policy "Users upload own post assets" on storage.objects for insert to authenticated with check (bucket_id = 'post-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own post assets" on storage.objects;
create policy "Users update own post assets" on storage.objects for update to authenticated using (bucket_id = 'post-assets' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'post-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own post assets" on storage.objects;
create policy "Users delete own post assets" on storage.objects for delete to authenticated using (bucket_id = 'post-assets' and (storage.foldername(name))[1] = auth.uid()::text);
