-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — Parent Tips ("From the Rink Family")
-- Run once in the Supabase SQL Editor, BEFORE deploying the matching code.
-- Requires the Admin Dashboard migrations (v1–v4) to have run first.
-- Safe to re-run.
--
-- Creates:
--   • parent_tips                     — tips shared by signed-in parents
--   • list_parent_tips()              — public board (approved tips only)
--   • admin_list_parent_tips()        — moderation queue
--   • admin_moderate_parent_tip()     — approve / reject / remove / restore,
--                                       plus feature / unfeature (Instagram)
--
-- Guardrails baked in:
--   • New tips can only be inserted as the signed-in user, as 'pending',
--     and not while banned. Nobody can publish their own tip.
--   • No one can edit a tip's text after it's sent — not the parent, not
--     an admin. Moderation is status and soft-delete only.
--   • Reject and Remove are soft deletes (deleted_at), never hard deletes.
--   • A tip can be featured on Instagram only if the parent opted in.
--   • An approved tip earns 10 XP once. XP is never taken back.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.parent_tips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  category          text not null
                      check (category in ('nutrition', 'workouts', 'skills', 'camps', 'gear', 'rink_life')),
  title             text not null check (char_length(title) between 3 and 80),
  body              text not null check (char_length(body) between 20 and 600),
  instagram_ok      boolean not null default false,
  instagram_handle  text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  status            text not null default 'pending' check (status in ('pending', 'published')),
  deleted_at        timestamptz,
  published_at      timestamptz,
  featured_at       timestamptz,
  xp_credited       boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists parent_tips_public_idx
  on public.parent_tips (status, category, published_at desc)
  where deleted_at is null;

create index if not exists parent_tips_user_idx
  on public.parent_tips (user_id, created_at desc);

alter table public.parent_tips enable row level security;


-- ── 2. Policies ─────────────────────────────────────────────────────────────
-- Reads: a parent can see their own tips (any status). The public board reads
-- through list_parent_tips() below, which returns approved tips and the
-- author's Rink Rater name only — never user IDs or Instagram consent data.
--
-- Inserts: own user ID, pending, untouched moderation fields, not banned.
--
-- No update or delete policies: tips can't be edited or deleted from the
-- browser. All changes go through admin_moderate_parent_tip().

drop policy if exists "parent_tips_read_own" on public.parent_tips;
create policy "parent_tips_read_own"
  on public.parent_tips for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "parent_tips_insert_own" on public.parent_tips;
create policy "parent_tips_insert_own"
  on public.parent_tips for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and deleted_at is null
    and published_at is null
    and featured_at is null
    and xp_credited = false
    and not public.is_user_banned(auth.uid())
  );


-- ── 3. Public board ─────────────────────────────────────────────────────────
-- p_category: null for all, or one of the category keys.
-- Returns { total, rows: [...] }, newest approved first.

create or replace function public.list_parent_tips(
  p_category  text default null,
  p_limit     int  default 24,
  p_offset    int  default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_rows  jsonb;
begin
  select count(*) into v_total
  from public.parent_tips t
  where t.status = 'published'
    and t.deleted_at is null
    and (p_category is null or t.category = p_category);

  select coalesce(jsonb_agg(row_data order by sort_at desc, sort_id), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id',           t.id,
        'category',     t.category,
        'title',        t.title,
        'body',         t.body,
        'author',       coalesce(p.alias, 'A hockey parent'),
        'published_at', t.published_at
      ) as row_data,
      coalesce(t.published_at, t.created_at) as sort_at,
      t.id as sort_id
    from public.parent_tips t
    left join public.profiles p on p.id::text = t.user_id::text
    where t.status = 'published'
      and t.deleted_at is null
      and (p_category is null or t.category = p_category)
    order by sort_at desc, sort_id
    limit greatest(least(p_limit, 60), 1)
    offset greatest(p_offset, 0)
  ) page;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;


-- ── 4. Admin queue ──────────────────────────────────────────────────────────
-- p_status: 'pending' | 'published' | 'removed'
-- p_instagram_only: true = only tips whose parent said OK to feature.

create or replace function public.admin_list_parent_tips(
  p_status          text    default 'pending',
  p_instagram_only  boolean default false,
  p_limit           int     default 25,
  p_offset          int     default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_rows  jsonb;
begin
  if not public.has_admin_role(array['super_admin', 'moderator']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'published', 'removed') then
    raise exception 'Unknown status filter: %', p_status;
  end if;

  select count(*) into v_total
  from public.parent_tips t
  where (case p_status
           when 'removed' then t.deleted_at is not null
           else t.deleted_at is null and t.status = p_status
         end)
    and (not p_instagram_only or t.instagram_ok);

  select coalesce(jsonb_agg(row_data order by sort_key, sort_id), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id',               t.id,
        'category',         t.category,
        'title',            t.title,
        'body',             t.body,
        'user_id',          t.user_id,
        'author',           p.alias,
        'instagram_ok',     t.instagram_ok,
        'instagram_handle', t.instagram_handle,
        'status',           t.status,
        'created_at',       t.created_at,
        'published_at',     t.published_at,
        'featured_at',      t.featured_at,
        'deleted_at',       t.deleted_at,
        'author_live_tips', (
          select count(*) from public.parent_tips t2
          where t2.user_id = t.user_id and t2.status = 'published' and t2.deleted_at is null
        ),
        'last_action', (
          select jsonb_build_object('action', a.action, 'note', a.details ->> 'note', 'at', a.created_at)
          from public.admin_audit_log a
          where a.target_type = 'parent_tip' and a.target_id = t.id::text
          order by a.created_at desc
          limit 1
        )
      ) as row_data,
      -- Waiting: oldest first (work the backlog). Others: newest first.
      case when p_status = 'pending'
           then extract(epoch from t.created_at)
           else -extract(epoch from coalesce(t.deleted_at, t.published_at, t.created_at))
      end as sort_key,
      t.id as sort_id
    from public.parent_tips t
    left join public.profiles p on p.id::text = t.user_id::text
    where (case p_status
             when 'removed' then t.deleted_at is not null
             else t.deleted_at is null and t.status = p_status
           end)
      and (not p_instagram_only or t.instagram_ok)
    order by sort_key, sort_id
    limit greatest(least(p_limit, 100), 1)
    offset greatest(p_offset, 0)
  ) page;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;


-- ── 5. Moderation actions ───────────────────────────────────────────────────
-- p_action:
--   'approve'    — pending   → published (10 XP, first time only)
--   'reject'     — pending   → soft-deleted
--   'remove'     — published → soft-deleted
--   'restore'    — soft-deleted → back where it was
--   'feature'    — mark a live, opted-in tip as featured on Instagram
--   'unfeature'  — clear that mark
-- The tip's text is never touched.

create or replace function public.admin_moderate_parent_tip(
  p_tip_id  uuid,
  p_action  text,
  p_note    text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tip         public.parent_tips%rowtype;
  v_xp_awarded  int := 0;
begin
  if not public.has_admin_role(array['super_admin', 'moderator']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_tip
  from public.parent_tips
  where id = p_tip_id
  for update;

  if not found then
    raise exception 'Tip not found';
  end if;

  if p_action = 'approve' then
    if v_tip.deleted_at is not null or v_tip.status <> 'pending' then
      raise exception 'Only waiting tips can be approved';
    end if;
    update public.parent_tips
      set status = 'published',
          published_at = coalesce(published_at, now()),
          xp_credited = true
      where id = v_tip.id;
    if not v_tip.xp_credited then
      v_xp_awarded := 10;
    end if;

  elsif p_action = 'reject' then
    if v_tip.deleted_at is not null or v_tip.status <> 'pending' then
      raise exception 'Only waiting tips can be rejected';
    end if;
    update public.parent_tips set deleted_at = now() where id = v_tip.id;

  elsif p_action = 'remove' then
    if v_tip.deleted_at is not null or v_tip.status <> 'published' then
      raise exception 'Only live tips can be removed';
    end if;
    update public.parent_tips set deleted_at = now() where id = v_tip.id;

  elsif p_action = 'restore' then
    if v_tip.deleted_at is null then
      raise exception 'Tip is not removed';
    end if;
    update public.parent_tips set deleted_at = null where id = v_tip.id;

  elsif p_action = 'feature' then
    if v_tip.deleted_at is not null or v_tip.status <> 'published' then
      raise exception 'Only live tips can be featured';
    end if;
    if not v_tip.instagram_ok then
      raise exception 'This parent did not give permission to feature their tip';
    end if;
    update public.parent_tips set featured_at = coalesce(featured_at, now()) where id = v_tip.id;

  elsif p_action = 'unfeature' then
    update public.parent_tips set featured_at = null where id = v_tip.id;

  else
    raise exception 'Unknown action: %', p_action;
  end if;

  if v_xp_awarded <> 0 and v_tip.user_id is not null then
    update public.profiles
      set xp = coalesce(xp, 0) + v_xp_awarded
      where id::text = v_tip.user_id::text;
  end if;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    p_action,
    'parent_tip',
    v_tip.id::text,
    jsonb_build_object(
      'note',            nullif(trim(coalesce(p_note, '')), ''),
      'previous_status', v_tip.status,
      'was_deleted',     v_tip.deleted_at is not null,
      'category',        v_tip.category,
      'user_id',         v_tip.user_id,
      'xp_awarded',      v_xp_awarded
    )
  );

  return jsonb_build_object('ok', true, 'tip_id', v_tip.id, 'action', p_action, 'xp_awarded', v_xp_awarded);
end;
$$;


-- ── 6. Execute permissions ──────────────────────────────────────────────────

revoke all on function public.list_parent_tips(text, int, int)                    from public;
revoke all on function public.admin_list_parent_tips(text, boolean, int, int)    from public, anon;
revoke all on function public.admin_moderate_parent_tip(uuid, text, text)        from public, anon;

grant execute on function public.list_parent_tips(text, int, int)                 to anon, authenticated;
grant execute on function public.admin_list_parent_tips(text, boolean, int, int) to authenticated;
grant execute on function public.admin_moderate_parent_tip(uuid, text, text)     to authenticated;

grant select, insert on public.parent_tips to authenticated;


-- ── 7. Sanity check ─────────────────────────────────────────────────────────
-- Expect: the table exists with RLS on, 2 policies, and 3 functions.

select
  (select relrowsecurity from pg_class where oid = 'public.parent_tips'::regclass) as rls_enabled,
  (select count(*) from pg_policies where tablename = 'parent_tips')               as policies,
  (select count(*) from pg_proc where proname in
     ('list_parent_tips', 'admin_list_parent_tips', 'admin_moderate_parent_tip')) as functions;
