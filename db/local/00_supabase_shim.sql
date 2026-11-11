-- LOCAL DEVELOPMENT / TEST ONLY.
--
-- Supabase provides the `auth` schema, the `anon` / `authenticated` / `service_role`
-- roles and `auth.uid()`. This shim recreates the minimal subset the migrations rely on so the
-- exact same SQL (and the same RLS policies) can be exercised against a plain PostgreSQL 15+.
--
-- It also creates the `local_auth` schema used by the built-in LOCAL auth provider
-- (src/server/auth/local-provider.ts). That provider is for development, tests and
-- self-hosting experiments. In a Supabase deployment, none of this file is applied.
--
-- NEVER apply this file to a Supabase project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  -- The application connects with this role. It does NOT bypass RLS; every request
  -- switches to `authenticated` inside a transaction (see src/server/db/client.ts).
  if not exists (select 1 from pg_roles where rolname = 'app_server') then
    create role app_server login password 'app_server' nobypassrls noinherit;
  end if;
end $$;

grant anon, authenticated to app_server;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same definition Supabase ships.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- Built-in local auth tables (credentials, sessions, password resets).
create schema if not exists local_auth;

create table if not exists local_auth.credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists local_auth.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on local_auth.sessions(user_id);

create table if not exists local_auth.password_resets (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Nothing in local_auth is reachable by RLS-subject roles.
revoke all on schema local_auth from public, anon, authenticated;
revoke all on all tables in schema local_auth from public, anon, authenticated;
revoke all on auth.users from anon, authenticated;
