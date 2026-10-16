-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — Admin Dashboard foundation
-- Run once in the Supabase SQL Editor (safe to re-run).
--
-- Creates:
--   • admin_roles        — who is an admin, and which kind
--   • admin_audit_log    — every moderation action, who did it, and why
--   • has_admin_role()   — role check used by policies and functions
--   • my_admin_role()    — lets the signed-in user see their own role
--   • admin_dashboard_stats()  — counts + 14-day activity for the hub
--   • admin_list_reviews()     — review queue (pending / published / removed)
--   • admin_moderate_review()  — approve / reject / remove / restore
--
-- Every admin function checks the caller's role INSIDE the database, so the
-- lock holds even if someone calls these functions directly.
--
-- Legal guardrails baked in:
--   • No function can change a review's text — status and soft-delete only.
--   • Reject and Remove are soft deletes (deleted_at), never hard deletes.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Tables ───────────────────────────────────────────────────────────────

create table if not exists public.admin_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('super_admin', 'moderator', 'partner_manager')),
  granted_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id           bigint generated always as identity primary key,
  admin_id     uuid not null references auth.users(id),
  action       text not null,
  target_type  text not null,
  target_id    text not null,
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);

alter table public.admin_roles     enable row level security;
alter table public.admin_audit_log enable row level security;


-- ── 2. Role check ───────────────────────────────────────────────────────────
-- Pass null to accept any admin role, or a list such as
-- array['super_admin','moderator'] to require one of those.

create or replace function public.has_admin_role(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_roles
    where user_id = auth.uid()
      and (p_roles is null or role = any (p_roles))
  );
$$;

create or replace function public.my_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_roles where user_id = auth.uid();
$$;


-- ── 3. Policies ─────────────────────────────────────────────────────────────
-- admin_roles: a user can read only their own row. No insert/update/delete
-- policies — roles are granted from the SQL editor (or a future Add Admin
-- function), never from the browser.

drop policy if exists "admin_roles_read_own" on public.admin_roles;
create policy "admin_roles_read_own"
  on public.admin_roles for select
  to authenticated
  using (user_id = auth.uid());

-- admin_audit_log: super admins can read it. Rows are written only by the
-- security-definer functions below.

drop policy if exists "admin_audit_log_super_admin_read" on public.admin_audit_log;
create policy "admin_audit_log_super_admin_read"
  on public.admin_audit_log for select
  to authenticated
  using (public.has_admin_role(array['super_admin']));


-- ── 4. Dashboard stats (hub tiles + 14-day activity chart) ──────────────────

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_admin_role(null) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'pending',   (select count(*) from public.reviews where status = 'pending'   and deleted_at is null),
    'published', (select count(*) from public.reviews where status = 'published' and deleted_at is null),
    'removed',   (select count(*) from public.reviews where deleted_at is not null),
    'activity',  (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(c.cnt, 0)) order by d.day), '[]'::jsonb)
      from (
        select (current_date - g)::date as day
        from generate_series(0, 13) as g
      ) d
      left join (
        select review_date::date as day, count(*) as cnt
        from public.reviews
        where deleted_at is null
          and review_date::date >= current_date - 13
        group by review_date::date
      ) c on c.day = d.day
    )
  )
  into v_result;

  return v_result;
end;
$$;


-- ── 5. Review queue ─────────────────────────────────────────────────────────
-- p_status: 'pending' | 'published' | 'removed'
-- Returns { total, rows: [...] }. Pending is oldest-first (work the backlog);
-- the other tabs are newest-first.

create or replace function public.admin_list_reviews(
  p_status  text default 'pending',
  p_limit   int  default 25,
  p_offset  int  default 0
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
  from public.reviews r
  where case p_status
          when 'removed' then r.deleted_at is not null
          else r.deleted_at is null and r.status = p_status
        end;

  select coalesce(jsonb_agg(row_data order by sort_key_date, sort_key_id), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id',          r.id::text,
        'rink_id',     r.rink_id,
        'rink_name',   r.rink_name,
        'rink_city',   r.rink_city,
        'rink_state',  r.rink_state,
        'category',    r.category,
        'comment',     r.comment,
        'user_id',     r.user_id,
        'user_alias',  r.user_alias,
        'review_date', r.review_date,
        'status',      r.status,
        'deleted_at',  r.deleted_at,
        'reviewer_published_count', (
          select count(*) from public.reviews r2
          where r2.user_id = r.user_id
            and r2.status = 'published'
            and r2.deleted_at is null
        ),
        'last_action', (
          select jsonb_build_object('action', a.action, 'note', a.details ->> 'note', 'at', a.created_at)
          from public.admin_audit_log a
          where a.target_type = 'review' and a.target_id = r.id::text
          order by a.created_at desc
          limit 1
        )
      ) as row_data,
      -- Pending: oldest first. Others: newest first (negate via epoch).
      case when p_status = 'pending'
           then extract(epoch from r.review_date::timestamp)
           else -extract(epoch from coalesce(r.deleted_at, r.review_date::timestamptz))
      end as sort_key_date,
      r.id::text as sort_key_id
    from public.reviews r
    where case p_status
            when 'removed' then r.deleted_at is not null
            else r.deleted_at is null and r.status = p_status
          end
    order by sort_key_date, sort_key_id
    limit greatest(least(p_limit, 100), 1)
    offset greatest(p_offset, 0)
  ) page;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;


-- ── 6. Moderation actions ───────────────────────────────────────────────────
-- p_action:
--   'approve' — pending  → published
--   'reject'  — pending  → soft-deleted (hidden; stays in the audit trail)
--   'remove'  — published → soft-deleted
--   'restore' — soft-deleted → back to its previous visible state
-- The review's text is never touched.
-- XP and review counts are intentionally NOT changed here yet (see notes).

create or replace function public.admin_moderate_review(
  p_review_id text,
  p_action    text,
  p_note      text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_review public.reviews%rowtype;
begin
  if not public.has_admin_role(array['super_admin', 'moderator']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_review
  from public.reviews
  where id::text = p_review_id
  for update;

  if not found then
    raise exception 'Review not found';
  end if;

  if p_action = 'approve' then
    if v_review.deleted_at is not null or v_review.status <> 'pending' then
      raise exception 'Only pending reviews can be approved';
    end if;
    update public.reviews set status = 'published' where id = v_review.id;

  elsif p_action = 'reject' then
    if v_review.deleted_at is not null or v_review.status <> 'pending' then
      raise exception 'Only pending reviews can be rejected';
    end if;
    update public.reviews set deleted_at = now() where id = v_review.id;

  elsif p_action = 'remove' then
    if v_review.deleted_at is not null or v_review.status <> 'published' then
      raise exception 'Only live (published) reviews can be removed';
    end if;
    update public.reviews set deleted_at = now() where id = v_review.id;

  elsif p_action = 'restore' then
    if v_review.deleted_at is null then
      raise exception 'Review is not removed';
    end if;
    update public.reviews set deleted_at = null where id = v_review.id;

  else
    raise exception 'Unknown action: %', p_action;
  end if;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    p_action,
    'review',
    v_review.id::text,
    jsonb_build_object(
      'note',            nullif(trim(coalesce(p_note, '')), ''),
      'previous_status', v_review.status,
      'was_deleted',     v_review.deleted_at is not null,
      'rink_id',         v_review.rink_id,
      'user_id',         v_review.user_id
    )
  );

  return jsonb_build_object('ok', true, 'review_id', v_review.id::text, 'action', p_action);
end;
$$;


-- ── 7. Execute permissions ──────────────────────────────────────────────────
-- Signed-out visitors can't call any of these; signed-in non-admins get
-- "Not authorized" from the role check inside each function.

revoke all on function public.has_admin_role(text[])                 from public, anon;
revoke all on function public.my_admin_role()                        from public, anon;
revoke all on function public.admin_dashboard_stats()                from public, anon;
revoke all on function public.admin_list_reviews(text, int, int)     from public, anon;
revoke all on function public.admin_moderate_review(text, text, text) from public, anon;

grant execute on function public.has_admin_role(text[])                 to authenticated;
grant execute on function public.my_admin_role()                        to authenticated;
grant execute on function public.admin_dashboard_stats()                to authenticated;
grant execute on function public.admin_list_reviews(text, int, int)     to authenticated;
grant execute on function public.admin_moderate_review(text, text, text) to authenticated;


-- ── 8. Seed the first super admin ───────────────────────────────────────────

insert into public.admin_roles (user_id, role)
select id, 'super_admin'
from auth.users
where email = 'senan@rinkrater.com'
on conflict (user_id) do nothing;

-- Sanity check — should return one row with role = super_admin:
select u.email, ar.role, ar.created_at
from public.admin_roles ar
join auth.users u on u.id = ar.user_id;
