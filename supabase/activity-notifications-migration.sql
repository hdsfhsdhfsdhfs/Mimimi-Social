-- Central activity notifications for Mimimi
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('follow','like','comment','post_reply','mural_post','mural_reply')),
  post_id uuid references public.social_posts(id) on delete cascade,
  comment_id uuid references public.social_post_comments(id) on delete cascade,
  mural_entry_id uuid references public.profile_mural_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint user_notifications_not_self check (recipient_id <> actor_id)
);
create index if not exists user_notifications_recipient_date_idx
  on public.user_notifications(recipient_id, created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications" on public.user_notifications
for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "Users mark own notifications read" on public.user_notifications;
create policy "Users mark own notifications read" on public.user_notifications
for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function public.mimimi_notify_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare recipient uuid; actor uuid; action text; post uuid; comment uuid; entry uuid;
begin
  if tg_table_name = 'profile_follows' then
    actor := new.follower_id; recipient := new.following_id; action := 'follow';
  elsif tg_table_name = 'social_post_likes' then
    actor := new.user_id; action := 'like'; post := new.post_id;
    select author_id into recipient from public.social_posts where id = post;
  elsif tg_table_name = 'social_post_comments' then
    actor := new.author_id; action := 'comment'; post := new.post_id; comment := new.id;
    select author_id into recipient from public.social_posts where id = post;
  elsif tg_table_name = 'social_post_comment_replies' then
    actor := new.author_id; action := 'post_reply'; comment := new.comment_id;
    select c.author_id, c.post_id into recipient, post
      from public.social_post_comments c where c.id = comment;
  elsif tg_table_name = 'profile_mural_entries' then
    actor := new.author_id; recipient := new.profile_id; action := 'mural_post'; entry := new.id;
  elsif tg_table_name = 'profile_mural_replies' then
    actor := new.author_id; entry := new.entry_id; action := 'mural_reply';
    select e.profile_id into recipient from public.profile_mural_entries e where e.id = entry;
  end if;
  if recipient is not null and actor is not null and recipient <> actor then
    insert into public.user_notifications(recipient_id,actor_id,action_type,post_id,comment_id,mural_entry_id)
    values(recipient,actor,action,post,comment,entry);
  end if;
  return new;
end;
$$;

drop trigger if exists mimimi_notify_follow on public.profile_follows;
create trigger mimimi_notify_follow after insert on public.profile_follows
for each row execute function public.mimimi_notify_activity();
drop trigger if exists mimimi_notify_like on public.social_post_likes;
create trigger mimimi_notify_like after insert on public.social_post_likes
for each row execute function public.mimimi_notify_activity();
drop trigger if exists mimimi_notify_comment on public.social_post_comments;
create trigger mimimi_notify_comment after insert on public.social_post_comments
for each row execute function public.mimimi_notify_activity();
drop trigger if exists mimimi_notify_post_reply on public.social_post_comment_replies;
create trigger mimimi_notify_post_reply after insert on public.social_post_comment_replies
for each row execute function public.mimimi_notify_activity();
drop trigger if exists mimimi_notify_mural_post on public.profile_mural_entries;
create trigger mimimi_notify_mural_post after insert on public.profile_mural_entries
for each row execute function public.mimimi_notify_activity();
drop trigger if exists mimimi_notify_mural_reply on public.profile_mural_replies;
create trigger mimimi_notify_mural_reply after insert on public.profile_mural_replies
for each row execute function public.mimimi_notify_activity();
