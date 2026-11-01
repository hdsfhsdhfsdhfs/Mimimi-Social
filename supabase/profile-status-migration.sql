alter table public.profiles
  add column if not exists status_mode text not null default 'online',
  add column if not exists status_emoji text;

alter table public.profiles
  drop constraint if exists profiles_status_mode_check;

alter table public.profiles
  add constraint profiles_status_mode_check
  check (status_mode in ('online','offline','emoji'));

alter table public.profiles
  drop constraint if exists profiles_status_emoji_length_check;

alter table public.profiles
  add constraint profiles_status_emoji_length_check
  check (status_emoji is null or char_length(status_emoji) <= 8);
