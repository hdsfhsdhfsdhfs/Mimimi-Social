-- Mimimi official account and staff role setup
alter table public.profiles
  add column if not exists is_official boolean not null default false,
  add column if not exists role_label text,
  add column if not exists role_description text;

-- Protect official/staff fields from changes made through normal user sessions.
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

-- Mark only the account registered with this exact email as the official Mimimi account.
update public.profiles p
set is_official = true,
    role_label = 'Bunny',
    role_description = 'Conta oficial e desenvolvedora do aplicativo Mimimi.'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('support.mimimi@gmail.com');
