-- Limita a alteração do @ para uma vez a cada dois meses.
alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create or replace function public.enforce_username_change_cooldown()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null
       and old.username_changed_at > now() - interval '2 months' then
      raise exception 'USERNAME_CHANGE_COOLDOWN'
        using errcode = 'P0001';
    end if;

    new.username_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_username_change_cooldown on public.profiles;

create trigger profiles_username_change_cooldown
before update of username on public.profiles
for each row
execute function public.enforce_username_change_cooldown();
