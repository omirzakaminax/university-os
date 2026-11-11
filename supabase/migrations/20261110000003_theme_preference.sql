-- University OS — migration 3: per-user theme preference (light | dark | system)
alter table public.user_preferences
  add column theme text not null default 'system' check (theme in ('light', 'dark', 'system'));
