-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — v4: User Lookup, bans, and XP on approve
-- Run once in the Supabase SQL Editor AFTER v3, and BEFORE deploying the
-- matching code. Safe to re-run. Confirm the "destructive operations" prompt
-- (it's the DROP POLICY / DROP TRIGGER lines; no data is deleted).
--
--   1. reviews.stats_credited — whether a review has already counted toward
--      the reviewer's XP and review count. Existing reviews are marked
--      credited, so nobody gets retroactive XP.
--   2. Approving a held review grants the 25 XP it would have earned if it had
--      published automatically (once only — edited reviews can't earn twice).
--      Reject / remove / restore keep the reviewer's review count accurate.
--      XP is never taken back.
--   3. Bans: profiles.banned_at / banned_reason / banned_by. A banned user
--      can't post new reviews or edit existing ones. Users can't unban
--      themselves.
--   4. Admin functions for User Lookup: search, detail, ban/unban.
--      Emails and full names are shown to super admins only.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Columns ──────────────────────────────────────────────────────────────

-- Added with default TRUE so every existing review is marked credited (no
-- retroactive XP), then the default flips to FALSE for new reviews. On a
-- re-run the column already exists, so nothing is re-marked.
alter table public.reviews
  add column if not exists stats_credited boolean not null default true;
alter table public.reviews
  alter column stats_credited set default false;

alter table public.profiles
  add column if not exists banned_at     timestamptz,
  add column if not exists banned_reason text,
  add column if not exists banned_by     uuid references auth.users(id);


-- ── 2. Ban helpers + enforcement ────────────────────────────────────────────

create or replace function public.is_user_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id::text = p_user_id::text and banned_at is not null
  );
$$;

revoke all on function public.is_user_banned(uuid) from public, anon;
grant execute on function public.is_user_banned(uuid) to authenticated;

-- New reviews: own user ID only, and not while banned.
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (auth.uid()::text = user_id and not public.is_user_banned(auth.uid()));

-- Review update guard (from v3) + ban check + stats_credited is admin-only.
create or replace function public.guard_review_user_update()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Banned users may still delete their own reviews, but not edit them.
  if public.is_user_banned(auth.uid())
     and not (old.deleted_at is null and new.deleted_at is not null) then
    raise exception 'Your account can no longer post or edit reviews'
      using errcode = '42501';
  end if;

  if old.deleted_at is not null then
    raise exception 'This review has been removed and can no longer be changed'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.rink_id is distinct from old.rink_id
     or new.source  is distinct from old.source then
    raise exception 'Reviews cannot be moved to another user, rink or source'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and new.status <> 'pending' then
    raise exception 'Only moderators can publish or reject reviews'
      using errcode = '42501';
  end if;

  if new.stats_credited is distinct from old.stats_credited then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Profiles: users can edit their own profile, but never their ban fields.
create or replace function public.guard_profile_ban_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.banned_at     is distinct from old.banned_at
       or new.banned_reason is distinct from old.banned_reason
       or new.banned_by     is distinct from old.banned_by) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_ban_fields on public.profiles;
create trigger guard_profile_ban_fields
  before update on public.profiles
  for each row
  execute function public.guard_profile_ban_fields();


-- ── 3. Moderation actions — now with XP on approve + accurate counts ────────
-- Review count rule: a reviewer's total_reviews counts their credited reviews
-- that aren't removed. XP is only ever added (on approve), never taken back.

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
  v_review     public.reviews%rowtype;
  v_xp_awarded int := 0;
  v_count_delta int := 0;
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
    update public.reviews
      set status = 'published', stats_credited = true
      where id = v_review.id;
    if not v_review.stats_credited then
      v_xp_awarded := 25;
      v_count_delta := 1;
    end if;

  elsif p_action = 'reject' then
    if v_review.deleted_at is not null or v_review.status <> 'pending' then
      raise exception 'Only pending reviews can be rejected';
    end if;
    update public.reviews set deleted_at = now() where id = v_review.id;
    if v_review.stats_credited then v_count_delta := -1; end if;

  elsif p_action = 'remove' then
    if v_review.deleted_at is not null or v_review.status <> 'published' then
      raise exception 'Only live (published) reviews can be removed';
    end if;
    update public.reviews set deleted_at = now() where id = v_review.id;
    if v_review.stats_credited then v_count_delta := -1; end if;

  elsif p_action = 'restore' then
    if v_review.deleted_at is null then
      raise exception 'Review is not removed';
    end if;
    update public.reviews
      set deleted_at = null,
          status = case when status = 'rejected' then 'pending' else status end
      where id = v_review.id;
    if v_review.stats_credited then v_count_delta := 1; end if;

  else
    raise exception 'Unknown action: %', p_action;
  end if;

  if v_review.user_id is not null and (v_xp_awarded <> 0 or v_count_delta <> 0) then
    update public.profiles
      set xp            = coalesce(xp, 0) + v_xp_awarded,
          total_reviews = greatest(coalesce(total_reviews, 0) + v_count_delta, 0)
      where id::text = v_review.user_id;
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
      'user_id',         v_review.user_id,
      'xp_awarded',      v_xp_awarded
    )
  );

  return jsonb_build_object('ok', true, 'review_id', v_review.id::text, 'action', p_action, 'xp_awarded', v_xp_awarded);
end;
$$;


-- ── 4a. User search ─────────────────────────────────────────────────────────
-- Empty query → newest sign-ups. Otherwise matches alias or exact user ID;
-- super admins can also match by email or full name.

create or replace function public.admin_search_users(
  p_query text default '',
  p_limit int  default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_super boolean := public.has_admin_role(array['super_admin']);
  v_q     text    := trim(coalesce(p_query, ''));
  v_rows  jsonb;
begin
  if not public.has_admin_role(array['super_admin', 'moderator']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_data order by sort_ts desc nulls last, sort_alias), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id',            p.id::text,
        'alias',         p.alias,
        'initials',      p.initials,
        'avatar_url',    p.avatar_url,
        'xp',            p.xp,
        'total_reviews', p.total_reviews,
        'created_at',    p.created_at,
        'banned_at',     p.banned_at,
        'email',         case when v_super then u.email else null end,
        'is_admin',      exists (select 1 from public.admin_roles ar where ar.user_id::text = p.id::text)
      ) as row_data,
      case when v_q = '' then p.created_at else null end as sort_ts,
      lower(coalesce(p.alias, '')) as sort_alias
    from public.profiles p
    left join auth.users u on u.id::text = p.id::text
    where v_q = ''
       or p.alias ilike '%' || v_q || '%'
       or p.id::text = v_q
       or (v_super and (u.email ilike '%' || v_q || '%' or p.full_name ilike '%' || v_q || '%'))
    order by sort_ts desc nulls last, sort_alias
    limit greatest(least(p_limit, 100), 1)
  ) page;

  return v_rows;
end;
$$;


-- ── 4b. User detail ─────────────────────────────────────────────────────────

create or replace function public.admin_get_user(p_user_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_super   boolean := public.has_admin_role(array['super_admin']);
  v_profile jsonb;
begin
  if not public.has_admin_role(array['super_admin', 'moderator']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id',               p.id::text,
    'alias',            p.alias,
    'initials',         p.initials,
    'avatar_url',       p.avatar_url,
    'full_name',        case when v_super then p.full_name else null end,
    'email',            case when v_super then u.email else null end,
    'state',            p.state,
    'country',          p.country,
    'player_type',      p.player_type,
    'xp',               p.xp,
    'streak',           p.streak,
    'total_reviews',    p.total_reviews,
    'last_review_date', p.last_review_date,
    'created_at',       p.created_at,
    'last_sign_in_at',  u.last_sign_in_at,
    'banned_at',        p.banned_at,
    'banned_reason',    p.banned_reason,
    'banned_by_alias',  (select bp.alias from public.profiles bp where bp.id::text = p.banned_by::text),
    'admin_role',       (select ar.role from public.admin_roles ar where ar.user_id::text = p.id::text)
  )
  into v_profile
  from public.profiles p
  left join auth.users u on u.id::text = p.id::text
  where p.id::text = p_user_id;

  if v_profile is null then
    raise exception 'User not found';
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'counts', (
      select jsonb_build_object(
        'live',    count(*) filter (where deleted_at is null and status = 'published'),
        'pending', count(*) filter (where deleted_at is null and status = 'pending'),
        'removed', count(*) filter (where deleted_at is not null)
      )
      from public.reviews where user_id = p_user_id
    ),
    'reviews', (
      select coalesce(jsonb_agg(r_row order by r_date desc), '[]'::jsonb)
      from (
        select
          jsonb_build_object(
            'id',                r.id::text,
            'rink_id',           r.rink_id,
            'rink_name',         r.rink_name,
            'category',          r.category,
            'comment',           r.comment,
            'status',            r.status,
            'deleted_at',        r.deleted_at,
            'review_date',       r.review_date,
            'moderation_reason', r.moderation_reason
          ) as r_row,
          r.review_date as r_date
        from public.reviews r
        where r.user_id = p_user_id
        order by r.review_date desc
        limit 100
      ) rv
    ),
    'history', (
      select coalesce(jsonb_agg(h_row order by h_at desc), '[]'::jsonb)
      from (
        select
          jsonb_build_object(
            'action',      a.action,
            'target_type', a.target_type,
            'note',        a.details ->> 'note',
            'at',          a.created_at,
            'by',          (select ap.alias from public.profiles ap where ap.id::text = a.admin_id::text)
          ) as h_row,
          a.created_at as h_at
        from public.admin_audit_log a
        where (a.target_type = 'user' and a.target_id = p_user_id)
           or (a.target_type = 'review' and a.details ->> 'user_id' = p_user_id)
        order by a.created_at desc
        limit 50
      ) hv
    )
  );
end;
$$;


-- ── 4c. Ban / unban ─────────────────────────────────────────────────────────
-- Moderators can ban regular users; only super admins can ban other admins.
-- Nobody can ban themselves. Optionally soft-removes all their visible reviews.

create or replace function public.admin_set_user_ban(
  p_user_id        text,
  p_ban            boolean,
  p_reason         text    default null,
  p_remove_reviews boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_target_is_admin boolean;
  v_removed         int := 0;
  v_credited        int := 0;
begin
  if not public.has_admin_role(array['super_admin', 'moderator']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_user_id = auth.uid()::text then
    raise exception 'You can''t ban yourself';
  end if;

  if not exists (select 1 from public.profiles where id::text = p_user_id) then
    raise exception 'User not found';
  end if;

  select exists (select 1 from public.admin_roles where user_id::text = p_user_id)
  into v_target_is_admin;

  if v_target_is_admin and not public.has_admin_role(array['super_admin']) then
    raise exception 'Only a super admin can ban another admin';
  end if;

  if p_ban then
    update public.profiles
      set banned_at     = coalesce(banned_at, now()),
          banned_reason = nullif(trim(coalesce(p_reason, '')), ''),
          banned_by     = auth.uid()
      where id::text = p_user_id;

    if p_remove_reviews then
      with removed as (
        update public.reviews
          set deleted_at = now()
          where user_id = p_user_id and deleted_at is null
          returning stats_credited
      )
      select count(*), count(*) filter (where stats_credited)
      into v_removed, v_credited
      from removed;

      if v_credited > 0 then
        update public.profiles
          set total_reviews = greatest(coalesce(total_reviews, 0) - v_credited, 0)
          where id::text = p_user_id;
      end if;
    end if;
  else
    update public.profiles
      set banned_at = null, banned_reason = null, banned_by = null
      where id::text = p_user_id;
  end if;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    case when p_ban then 'ban' else 'unban' end,
    'user',
    p_user_id,
    jsonb_build_object(
      'note',            nullif(trim(coalesce(p_reason, '')), ''),
      'reviews_removed', v_removed
    )
  );

  return jsonb_build_object('ok', true, 'banned', p_ban, 'reviews_removed', v_removed);
end;
$$;


-- ── 5. Permissions ──────────────────────────────────────────────────────────

revoke all on function public.admin_moderate_review(text, text, text)          from public, anon;
revoke all on function public.admin_search_users(text, int)                    from public, anon;
revoke all on function public.admin_get_user(text)                             from public, anon;
revoke all on function public.admin_set_user_ban(text, boolean, text, boolean) from public, anon;

grant execute on function public.admin_moderate_review(text, text, text)          to authenticated;
grant execute on function public.admin_search_users(text, int)                    to authenticated;
grant execute on function public.admin_get_user(text)                             to authenticated;
grant execute on function public.admin_set_user_ban(text, boolean, text, boolean) to authenticated;


-- ── 6. Verification — this is the result the editor shows ───────────────────
-- Expect (first run): credited_existing = all reviews, uncredited = 0, the two triggers = 1
-- each, and banned_users = 0.

select
  (select count(*) from public.reviews where stats_credited)                   as credited_existing,
  (select count(*) from public.reviews where not stats_credited)               as uncredited,
  (select count(*) from pg_trigger where tgname = 'guard_review_user_update')  as review_guard,
  (select count(*) from pg_trigger where tgname = 'guard_profile_ban_fields')  as profile_guard,
  (select count(*) from public.profiles where banned_at is not null)           as banned_users;
