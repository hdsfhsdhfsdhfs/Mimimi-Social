-- Respostas encadeadas aos comentários das publicações Mimimi
create table if not exists public.social_post_comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.social_post_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists social_post_comment_replies_comment_idx
  on public.social_post_comment_replies(comment_id, created_at asc);

alter table public.social_post_comment_replies enable row level security;

drop policy if exists "Replies visible on published posts" on public.social_post_comment_replies;
create policy "Replies visible on published posts" on public.social_post_comment_replies
for select to authenticated using (
  exists (
    select 1
    from public.social_post_comments c
    join public.social_posts p on p.id = c.post_id
    where c.id = comment_id and p.is_draft = false
  )
);

drop policy if exists "Users reply when comments enabled" on public.social_post_comment_replies;
create policy "Users reply when comments enabled" on public.social_post_comment_replies
for insert to authenticated with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.social_post_comments c
    join public.social_posts p on p.id = c.post_id
    where c.id = comment_id and p.is_draft = false and p.comments_enabled = true
  )
);

drop policy if exists "Authors or post owners delete replies" on public.social_post_comment_replies;
create policy "Authors or post owners delete replies" on public.social_post_comment_replies
for delete to authenticated using (
  author_id = auth.uid()
  or exists (
    select 1
    from public.social_post_comments c
    join public.social_posts p on p.id = c.post_id
    where c.id = comment_id and p.author_id = auth.uid()
  )
);
