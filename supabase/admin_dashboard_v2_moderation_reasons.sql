-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — Admin Dashboard v2: moderation reasons + saved rejections
-- Run once in the Supabase SQL Editor AFTER admin_dashboard_foundation.sql.
-- Safe to re-run.
--
--   1. reviews.moderation_reason — why the automatic check held or blocked a
--      review, shown on each card in Review Moderation.
--   2. Lets reviews.status be 'rejected', so automatically blocked entries can
--      be saved (already soft-deleted) instead of thrown away.
--   3. Updates admin_list_reviews (returns the reason) and
--      admin_moderate_review (restoring a blocked review sends it to Waiting).
--   4. Ends with a diagnostic — please paste its output back.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. moderation_reason column ─────────────────────────────────────────────

alter table public.reviews
  add column if not exists moderation_reason text;


-- ── 2. Allow status = 'rejected' ────────────────────────────────────────────
-- If a CHECK constraint on reviews.status exists and doesn't already allow
-- 'rejected', replace it with one that allows exactly the three statuses.

do $$
declare
  c record;
  needs_new boolean := false;
  has_any   boolean := false;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'reviews'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    has_any := true;
    if c.def not ilike '%rejected%' then
      execute format('alter table public.reviews drop constraint %I', c.conname);
      needs_new := true;
    end if;
  end loop;

  if needs_new then
    alter table public.reviews
      add constraint reviews_status_check
      check (status in ('published', 'pending', 'rejected'));
  end if;
end;
$$;


-- ── 3a. Review queue — now includes moderation_reason ───────────────────────

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
        'id',                r.id::text,
        'rink_id',           r.rink_id,
        'rink_name',         r.rink_name,
        'rink_city',         r.rink_city,
        'rink_state',        r.rink_state,
        'category',          r.category,
        'comment',           r.comment,
        'user_id',           r.user_id,
        'user_alias',        r.user_alias,
        'review_date',       r.review_date,
        'status',            r.status,
        'deleted_at',        r.deleted_at,
        'moderation_reason', r.moderation_reason,
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


-- ── 3b. Moderation actions — restoring a blocked review sends it to Waiting ─

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
    -- A review the automatic check blocked never went live, so restoring it
    -- puts it in Waiting for a human decision rather than publishing it.
    update public.reviews
      set deleted_at = null,
          status = case when status = 'rejected' then 'pending' else status end
      where id = v_review.id;

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

revoke all on function public.admin_list_reviews(text, int, int)      from public, anon;
revoke all on function public.admin_moderate_review(text, text, text)  from public, anon;
grant execute on function public.admin_list_reviews(text, int, int)    to authenticated;
grant execute on function public.admin_moderate_review(text, text, text) to authenticated;


-- ── 4. Diagnostic — paste this output back to Claude ────────────────────────
-- Checks whether the rink-page stats and Ask TJ's vector search filter out
-- non-published / deleted reviews, and lists the read policies on reviews.

select
  'rink_stats (materialized view)'                       as object,
  pg_get_viewdef('public.rink_stats'::regclass) ilike '%status%'     as filters_status,
  pg_get_viewdef('public.rink_stats'::regclass) ilike '%deleted_at%' as filters_deleted,
  null::text                                             as detail
union all
select
  'search_reviews (Ask TJ vector search)',
  pg_get_functiondef(p.oid) ilike '%status%',
  pg_get_functiondef(p.oid) ilike '%deleted_at%',
  case when p.prosecdef then 'security definer' else 'security invoker' end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'search_reviews'
union all
select
  'policy: ' || policyname,
  null,
  null,
  cmd || ' to ' || array_to_string(roles, ',') || ' using (' || coalesce(qual, 'none') || ')'
from pg_policies
where schemaname = 'public' and tablename = 'reviews'
union all
select
  'status constraint',
  null,
  null,
  pg_get_constraintdef(con.oid)
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
where rel.relname = 'reviews' and con.contype = 'c'
  and pg_get_constraintdef(con.oid) ilike '%status%';
