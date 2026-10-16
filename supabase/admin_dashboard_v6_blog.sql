-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — v6: Blog
-- Run once in the Supabase SQL Editor BEFORE deploying the matching code.
-- Safe to re-run. Confirm the "destructive operations" prompt (DROP POLICY /
-- DROP TRIGGER lines only — no data is deleted).
--
--   1. posts table. Drafts, scheduled and published posts, written in the
--      Admin Dashboard by super admins. The public only ever sees posts that
--      are published, whose publish time has arrived, and that aren't removed.
--      Removing a post is a soft delete (deleted_at) — nothing is hard-deleted.
--   2. Audit trail: every add / edit / publish / remove / restore is logged.
--   3. blog-images storage bucket (public read, super-admin write).
--   4. Verification.
--
-- Scheduling needs no cron: a post saved as "published" with a future
-- published_at stays hidden until that moment, then the read rule lets it
-- through. The public pages refresh every few minutes.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Posts table ──────────────────────────────────────────────────────────

create table if not exists public.posts (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique
                         check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  title                text not null check (length(trim(title)) > 0),
  excerpt              text not null default '',          -- search/meta description
  body_html            text not null default '',
  cover_image_url      text not null default '',
  cover_image_alt      text not null default '',
  rink_ids             text[] not null default '{}',     -- rinks.id is text
  status               text not null default 'draft'
                         check (status in ('draft', 'published')),
  published_at         timestamptz,                       -- future = scheduled
  source               text not null default 'blog'
                         check (source in ('blog', 'instagram')),
  instagram_permalink  text not null default '',
  author_id            uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint posts_published_needs_date
    check (status = 'draft' or published_at is not null)
);

create index if not exists posts_public_feed_idx
  on public.posts (published_at desc)
  where status = 'published' and deleted_at is null;

create index if not exists posts_rink_ids_idx
  on public.posts using gin (rink_ids);

alter table public.posts enable row level security;

-- Two read rules (not one OR'd rule): signed-out visitors can't call the
-- admin role check, so they get a rule that never needs it.
drop policy if exists "posts_public_read_live" on public.posts;
create policy "posts_public_read_live"
  on public.posts for select
  to public
  using (status = 'published' and published_at <= now() and deleted_at is null);

drop policy if exists "posts_admin_read_all" on public.posts;
create policy "posts_admin_read_all"
  on public.posts for select
  to authenticated
  using (public.has_admin_role(array['super_admin']));

drop policy if exists "posts_admin_insert" on public.posts;
create policy "posts_admin_insert"
  on public.posts for insert
  to authenticated
  with check (public.has_admin_role(array['super_admin']));

drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update"
  on public.posts for update
  to authenticated
  using (public.has_admin_role(array['super_admin']))
  with check (public.has_admin_role(array['super_admin']));

-- No delete policy on purpose: posts are removed with deleted_at, never
-- hard-deleted, so the audit trail always has something to point at.

grant select on public.posts to anon, authenticated;
grant insert, update on public.posts to authenticated;


-- ── 2. updated_at + audit trail ─────────────────────────────────────────────

create or replace function public.posts_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' then
    v_action := 'post_add';
  elsif old.deleted_at is null and new.deleted_at is not null then
    v_action := 'post_remove';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'post_restore';
  elsif old.status = 'draft' and new.status = 'published' then
    v_action := 'post_publish';
  elsif old.status = 'published' and new.status = 'draft' then
    v_action := 'post_unpublish';
  else
    v_action := 'post_edit';
  end if;

  if auth.uid() is not null then
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (
      auth.uid(),
      v_action,
      'post',
      new.id::text,
      jsonb_build_object('title', new.title, 'slug', new.slug,
                         'status', new.status, 'published_at', new.published_at)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists posts_audit on public.posts;
create trigger posts_audit
  before insert or update on public.posts
  for each row
  execute function public.posts_audit();


-- ── 3. Image storage ────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "blog_images_public_read" on storage.objects;
create policy "blog_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'blog-images');

drop policy if exists "blog_images_admin_write" on storage.objects;
create policy "blog_images_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-images' and public.has_admin_role(array['super_admin']));

drop policy if exists "blog_images_admin_update" on storage.objects;
create policy "blog_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'blog-images' and public.has_admin_role(array['super_admin']));


-- ── 4. Verification — this is the result the editor shows ───────────────────
-- Expect: posts_table = 1, image_bucket = 1, audit_trigger = 1, policies = 4.

select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'posts')              as posts_table,
  (select count(*) from storage.buckets where id = 'blog-images')          as image_bucket,
  (select count(*) from pg_trigger where tgname = 'posts_audit')           as audit_trigger,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'posts')                  as policies;
