-- Curtidas, comentários e controles de comentários das publicações Mimimi
alter table public.social_posts
  add column if not exists comments_enabled boolean not null default true;

create table if not exists public.social_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists social_post_likes_post_idx on public.social_post_likes(post_id);

create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists social_post_comments_post_idx on public.social_post_comments(post_id, created_at asc);

alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;

drop policy if exists "Likes visible to signed in users" on public.social_post_likes;
create policy "Likes visible to signed in users" on public.social_post_likes
for select to authenticated using (true);

drop policy if exists "Users like posts once" on public.social_post_likes;
create policy "Users like posts once" on public.social_post_likes
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.social_posts p where p.id = post_id and p.is_draft = false)
);

drop policy if exists "Users remove own likes" on public.social_post_likes;
create policy "Users remove own likes" on public.social_post_likes
for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Comments visible to signed in users" on public.social_post_comments;
create policy "Comments visible to signed in users" on public.social_post_comments
for select to authenticated using (
  exists (select 1 from public.social_posts p where p.id = post_id and p.is_draft = false)
);

drop policy if exists "Users comment when enabled" on public.social_post_comments;
create policy "Users comment when enabled" on public.social_post_comments
for insert to authenticated with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.social_posts p
    where p.id = post_id and p.is_draft = false and p.comments_enabled = true
  )
);

drop policy if exists "Authors delete own comments" on public.social_post_comments;
create policy "Authors delete own comments" on public.social_post_comments
for delete to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid())
);

drop policy if exists "Post owner pins comments" on public.social_post_comments;
create policy "Post owner pins comments" on public.social_post_comments
for update to authenticated using (
  exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid())
) with check (
  exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid())
);

-- Garante que somente o autor da publicação possa alterar comments_enabled.
drop policy if exists "Users update their own posts" on public.social_posts;
create policy "Users update their own posts" on public.social_posts
for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
