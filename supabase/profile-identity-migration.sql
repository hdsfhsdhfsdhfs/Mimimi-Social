-- Mimimi profile identity migration: preserve existing bigint profile IDs.
alter table public.profiles
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists bio text not null default '',
  add column if not exists background_url text,
  add column if not exists is_official boolean not null default false,
  add column if not exists role_label text,
  add column if not exists role_description text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_auth_user_id_unique
  on public.profiles(auth_user_id)
  where auth_user_id is not null;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = auth_user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create or replace function public.protect_profile_staff_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.is_official := old.is_official;
    new.role_label := old.role_label;
    new.role_description := old.role_description;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_staff_fields on public.profiles;
create trigger protect_profile_staff_fields
before update on public.profiles
for each row execute function public.protect_profile_staff_fields();

-- Link the support account to its existing profile, or create one if needed.
insert into public.profiles (auth_user_id, username, display_name, is_official, role_label, role_description)
select u.id, 'mimimi', 'Mimimi', true, 'Bunny',
       'Conta oficial e desenvolvedora do aplicativo Mimimi.'
from auth.users u
where lower(u.email) = lower('support.mimimi@gmail.com')
on conflict (auth_user_id) where auth_user_id is not null
do update set
  is_official = true,
  role_label = 'Bunny',
  role_description = 'Conta oficial e desenvolvedora do aplicativo Mimimi.',
  display_name = coalesce(nullif(public.profiles.display_name, ''), 'Mimimi'),
  updated_at = now();
