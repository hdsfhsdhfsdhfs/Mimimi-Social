create table if not exists public.profile_mural_replies (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null references public.profile_mural_entries(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 content text not null check (char_length(trim(content)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists profile_mural_replies_entry_created_idx on public.profile_mural_replies(entry_id, created_at asc);
alter table public.profile_mural_replies enable row level security;
drop policy if exists "Mural replies visible to authenticated users" on public.profile_mural_replies;
create policy "Mural replies visible to authenticated users" on public.profile_mural_replies for select to authenticated using (exists (select 1 from public.profile_mural_entries e where e.id = entry_id));
drop policy if exists "Reply on public profile murals" on public.profile_mural_replies;
create policy "Reply on public profile murals" on public.profile_mural_replies for insert to authenticated with check (
 author_id = auth.uid() and exists (
  select 1 from public.profile_mural_entries e join public.profiles p on p.auth_user_id = e.profile_id
  where e.id = entry_id and (coalesce(p.mural_is_private,false) = false or p.auth_user_id = auth.uid())
 )
);
drop policy if exists "Authors or profile owners delete mural replies" on public.profile_mural_replies;
create policy "Authors or profile owners delete mural replies" on public.profile_mural_replies for delete to authenticated using (
 author_id = auth.uid() or exists (select 1 from public.profile_mural_entries e where e.id = entry_id and e.profile_id = auth.uid())
);