-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — v7: Moderators can write blog drafts
-- Run once in the Supabase SQL Editor (production: rinkrater) AFTER v6,
-- BEFORE deploying the matching code. Safe to re-run. Confirm the
-- "destructive operations" prompt (DROP POLICY lines only — no data changes).
--
-- Who can do what with blog posts:
--   Super Admin — everything: write, publish, schedule, unpublish, remove,
--                 restore.
--   Moderator   — read every post in HQ; create drafts; edit drafts that
--                 aren't removed. Can't publish, schedule, remove or restore,
--                 and can't touch a post once it's live or scheduled.
--   Everyone    — unchanged: sees live posts only.
--
-- How it's enforced: a moderator's write is only accepted when the post
-- they're changing is a draft (USING) AND the saved result is still a
-- draft that isn't removed (WITH CHECK). The app hides the controls too,
-- but this is the actual lock.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Posts ────────────────────────────────────────────────────────────────

drop policy if exists "posts_admin_read_all" on public.posts;
create policy "posts_admin_read_all"
  on public.posts for select
  to authenticated
  using (public.has_admin_role(array['super_admin', 'moderator']));

drop policy if exists "posts_admin_insert" on public.posts;
create policy "posts_admin_insert"
  on public.posts for insert
  to authenticated
  with check (
    public.has_admin_role(array['super_admin'])
    or (
      public.has_admin_role(array['moderator'])
      and status = 'draft'
      and deleted_at is null
    )
  );

drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update"
  on public.posts for update
  to authenticated
  using (
    public.has_admin_role(array['super_admin'])
    or (
      public.has_admin_role(array['moderator'])
      and status = 'draft'
      and deleted_at is null
    )
  )
  with check (
    public.has_admin_role(array['super_admin'])
    or (
      public.has_admin_role(array['moderator'])
      and status = 'draft'
      and deleted_at is null
    )
  );


-- ── 2. Blog images: moderators can upload for their drafts ──────────────────

drop policy if exists "blog_images_admin_write" on storage.objects;
create policy "blog_images_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-images' and public.has_admin_role(array['super_admin', 'moderator']));

drop policy if exists "blog_images_admin_update" on storage.objects;
create policy "blog_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'blog-images' and public.has_admin_role(array['super_admin', 'moderator']));


-- ── 3. Verification — this is the result the editor shows ───────────────────
-- Expect: post_policies = 4, moderator_rules = 3, image_policies = 3.

select
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'posts')                         as post_policies,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'posts'
       and (qual ilike '%moderator%' or with_check ilike '%moderator%'))           as moderator_rules,
  (select count(*) from pg_policies
     where schemaname = 'storage' and policyname like 'blog_images_%')             as image_policies;
