-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — v3: lock down the reviews table + fix rink_stats counts
-- Run once in the Supabase SQL Editor AFTER v2. Safe to re-run.
-- The editor will warn about "destructive operations" — that's the DROP lines
-- below (old rules and the rink_stats view being rebuilt). No review data is
-- deleted or changed. Confirm and run the WHOLE file.
--
--   1. Reads:   public sees only live reviews; reviewers see their own.
--   2. Inserts: a user can only insert reviews under their own user ID.
--   3. Updates: users can edit/delete their own reviews, but can't publish
--               them, undelete them, or move them to another user or rink.
--   4. rink_stats: counts only live reviews (was counting pending ones).
--   5. Verification — the result shown at the end.
--
-- Admin functions are unaffected: they run as the table owner.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Read rules ───────────────────────────────────────────────────────────

drop policy if exists "Public read access to reviews" on public.reviews;
drop policy if exists "reviews_public_read_live"      on public.reviews;
drop policy if exists "reviews_owner_read_own"        on public.reviews;

create policy "reviews_public_read_live"
  on public.reviews for select
  to public
  using (status = 'published' and deleted_at is null);

create policy "reviews_owner_read_own"
  on public.reviews for select
  to authenticated
  using (auth.uid()::text = user_id);


-- ── 2. Insert rule: own user ID only ────────────────────────────────────────

drop policy if exists "Authenticated users can insert reviews" on public.reviews;
drop policy if exists "reviews_insert_own"                     on public.reviews;

create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (auth.uid()::text = user_id);


-- ── 3. Update guard ─────────────────────────────────────────────────────────
-- The existing "Users can update own reviews" rule decides WHICH rows a user
-- may update (their own). This trigger decides WHAT they may change, so the
-- only status change a reviewer can make is back to 'pending' (editing), and
-- the only delete change is soft-deleting. Admin functions, server jobs and
-- the dashboard run as other roles and skip these checks.

create or replace function public.guard_review_user_update()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
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

  return new;
end;
$$;

drop trigger if exists guard_review_user_update on public.reviews;
create trigger guard_review_user_update
  before update on public.reviews
  for each row
  execute function public.guard_review_user_update();


-- ── 4. rink_stats — count live reviews only ─────────────────────────────────
-- Same definition as before plus "status = 'published'". Rebuilt inside one
-- transaction so rink pages and search never see it missing. Read access and
-- the unique index (needed for concurrent refreshes) are restored.

begin;

drop materialized view if exists public.rink_stats;

create materialized view public.rink_stats as
select
  r.rink_id,
  rk.name as rink_name,
  rk.city,
  rk.state,
  rk.phone,
  rk.website,
  count(*) as total_reviews,
  count(distinct r.user_id) filter (where r.source = 'rinkrater') as rr_unique_reviewers,
  count(*) filter (where r.source = 'rinkrater')      as rr_review_count,
  count(*) filter (where r.source = 'ftloh')          as ftloh_review_count,
  count(*) filter (where r.source = 'user_submitted') as new_review_count,
  max(r.review_date) as most_recent_review,
  array_agg(distinct r.category) as categories_covered,
  case
    when count(distinct r.user_id) filter (where r.source = 'rinkrater') >= 10 then 'TRUSTED'
    when count(distinct r.user_id) filter (where r.source = 'rinkrater') >= 4  then 'ESTABLISHED'
    when count(distinct r.user_id) filter (where r.source = 'rinkrater') >= 2  then 'EMERGING'
    when count(*) > 0 then 'SINGLE_VOICE'
    else 'NO_DATA'
  end as confidence_tier
from public.reviews r
join public.rinks rk on rk.id = r.rink_id
where r.deleted_at is null
  and r.status = 'published'
group by r.rink_id, rk.name, rk.city, rk.state, rk.phone, rk.website
with data;

create unique index rink_stats_rink_id_idx on public.rink_stats using btree (rink_id);

grant select on public.rink_stats to anon, authenticated, service_role;

commit;


-- ── 5. Verification — this is the result the editor shows ───────────────────
-- Expect: rls_enabled = true, hidden_from_public = 0, old_rules_left = 0,
-- new_rules = 3, update_guard = 1, rink_stats_rows > 0.

begin;
set local role anon;
select
  (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass)                as rls_enabled,
  (select count(*) from public.reviews where status <> 'published' or deleted_at is not null) as hidden_from_public,
  (select count(*) from public.reviews)                                                       as live_visible,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'reviews'
     and policyname in ('Public read access to reviews', 'Authenticated users can insert reviews')) as old_rules_left,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'reviews'
     and policyname in ('reviews_public_read_live', 'reviews_owner_read_own', 'reviews_insert_own')) as new_rules,
  (select count(*) from pg_trigger where tgname = 'guard_review_user_update')                 as update_guard,
  (select count(*) from public.rink_stats)                                                    as rink_stats_rows;
rollback;
