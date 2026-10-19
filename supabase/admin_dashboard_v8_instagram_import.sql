-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — v8: Import Instagram posts as blog drafts
-- Run once in the Supabase SQL Editor (production: rinkrater) AFTER v7,
-- BEFORE deploying the matching code. Safe to re-run. Confirm the
-- "destructive operations" prompt (DROP POLICY / DROP TRIGGER lines only —
-- no data is deleted).
--
--   1. posts.instagram_id — remembers which Instagram post a draft came from,
--      so the same post is never imported twice (even after it's removed).
--   2. instagram_connection — a single row holding the Instagram access
--      token. Super admins only: moderators and the public can't read it.
--   3. Audit trail for connecting / replacing the token.
--   4. Verification.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Link posts to their Instagram original ───────────────────────────────

alter table public.posts add column if not exists instagram_id text;

create unique index if not exists posts_instagram_id_key
  on public.posts (instagram_id)
  where instagram_id is not null;


-- ── 2. The Instagram connection (one row) ──────────────────────────────────

create table if not exists public.instagram_connection (
  id              int primary key default 1 check (id = 1),
  access_token    text not null,
  ig_user_id      text not null default '',
  username        text not null default '',
  expires_at      timestamptz,
  connected_at    timestamptz not null default now(),   -- last time a token was pasted in
  refreshed_at    timestamptz not null default now(),   -- last automatic token refresh
  last_import_at  timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.instagram_connection enable row level security;

drop policy if exists "instagram_connection_super_admin_read" on public.instagram_connection;
create policy "instagram_connection_super_admin_read"
  on public.instagram_connection for select
  to authenticated
  using (public.has_admin_role(array['super_admin']));

drop policy if exists "instagram_connection_super_admin_insert" on public.instagram_connection;
create policy "instagram_connection_super_admin_insert"
  on public.instagram_connection for insert
  to authenticated
  with check (public.has_admin_role(array['super_admin']));

drop policy if exists "instagram_connection_super_admin_update" on public.instagram_connection;
create policy "instagram_connection_super_admin_update"
  on public.instagram_connection for update
  to authenticated
  using (public.has_admin_role(array['super_admin']))
  with check (public.has_admin_role(array['super_admin']));

revoke all on public.instagram_connection from anon;
grant select, insert, update on public.instagram_connection to authenticated;


-- ── 3. Audit: log when the account is connected or changed ─────────────────
-- Token refreshes during imports aren't logged (they happen automatically);
-- connecting a new account or pasting a new token is.

create or replace function public.instagram_connection_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if auth.uid() is not null
     and (tg_op = 'INSERT' or old.connected_at is distinct from new.connected_at) then
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (auth.uid(), 'instagram_connect', 'instagram', new.ig_user_id,
            jsonb_build_object('username', new.username));
  end if;

  return new;
end;
$$;

drop trigger if exists instagram_connection_audit on public.instagram_connection;
create trigger instagram_connection_audit
  before insert or update on public.instagram_connection
  for each row
  execute function public.instagram_connection_audit();


-- ── 4. Verification — this is the result the editor shows ───────────────────
-- Expect: instagram_id_column = 1, connection_table = 1, connection_policies = 3.

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'posts'
       and column_name = 'instagram_id')                                     as instagram_id_column,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'instagram_connection')  as connection_table,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'instagram_connection')     as connection_policies;
