-- Chat privado do Mimimi
create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid not null references auth.users(id) on delete cascade,
  participant_two uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint direct_conversations_distinct_users check (participant_one <> participant_two),
  constraint direct_conversations_pair_unique unique (participant_one, participant_two)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "Participants can view their conversations" on public.direct_conversations;
create policy "Participants can view their conversations"
on public.direct_conversations for select to authenticated
using (auth.uid() = participant_one or auth.uid() = participant_two);

drop policy if exists "Participants can view messages" on public.direct_messages;
create policy "Participants can view messages"
on public.direct_messages for select to authenticated
using (exists (
  select 1 from public.direct_conversations c
  where c.id = conversation_id
    and auth.uid() in (c.participant_one, c.participant_two)
));

drop policy if exists "Participants can send messages" on public.direct_messages;
create policy "Participants can send messages"
on public.direct_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.direct_conversations c
    where c.id = conversation_id
      and auth.uid() in (c.participant_one, c.participant_two)
  )
);

create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  first_user uuid;
  second_user uuid;
  conversation uuid;
begin
  if me is null then
    raise exception 'Você precisa entrar na sua conta.';
  end if;
  if other_user_id is null or other_user_id = me then
    raise exception 'Escolha outra pessoa para iniciar uma conversa.';
  end if;
  if not exists (select 1 from public.profiles where auth_user_id = other_user_id) then
    raise exception 'Este perfil não foi encontrado.';
  end if;

  first_user := least(me, other_user_id);
  second_user := greatest(me, other_user_id);

  insert into public.direct_conversations (participant_one, participant_two)
  values (first_user, second_user)
  on conflict (participant_one, participant_two) do nothing;

  select id into conversation
  from public.direct_conversations
  where participant_one = first_user and participant_two = second_user;

  return conversation;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

grant select on public.direct_conversations to authenticated;
grant select, insert on public.direct_messages to authenticated;
