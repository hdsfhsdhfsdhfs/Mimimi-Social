-- Mimimi profile mural: public viewing, owner-controlled posting privacy
-- Run in Supabase SQL Editor. Safe to run more than once.

alter table public.profiles
  add column if not exists mural_is_private boolean not null default false;

create table if not exists public.profile_mural_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profile_mural_entries_content_or_media check (
    length(trim(content)) > 0 or media_url is not null
  )
);

create index if not exists profile_mural_entries_profile_date_idx
  on public.profile_mural_entries(profile_id, is_pinned desc, created_at desc);

alter table public.profile_mural_entries enable row level security;

drop policy if exists "Mural entries are visible to everyone signed in" on public.profile_mural_entries;
create policy "Mural entries are visible to everyone signed in"
  on public.profile_mural_entries for select to authenticated using (true);

drop policy if exists "Users can write on open murals" on public.profile_mural_entries;
create policy "Users can write on open murals"
  on public.profile_mural_entries for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles p
      where p.auth_user_id = profile_id
        and (p.mural_is_private = false or p.auth_user_id = auth.uid())
    )
  );

drop policy if exists "Mural owner can delete entries" on public.profile_mural_entries;
create policy "Mural owner can delete entries"
  on public.profile_mural_entries for delete to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "Mural owner can pin entries" on public.profile_mural_entries;
create policy "Mural owner can pin entries"
  on public.profile_mural_entries for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Allow images and GIFs in the existing public profile-assets bucket.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 5242880,
    public = true
where id = 'profile-assets';
