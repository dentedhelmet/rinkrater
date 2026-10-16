-- ═══════════════════════════════════════════════════════════════════════════
-- Rink Rater — v5: Partners + Admin Team
-- Run once in the Supabase SQL Editor BEFORE deploying the matching code.
-- Safe to re-run. Confirm the "destructive operations" prompt (DROP POLICY /
-- DROP TRIGGER lines only — no data is deleted).
--
--   1. partners table, seeded with today's two partners (MHR, FTLOH).
--      Public sees active partners; super admins + partner managers edit.
--      Every change is written to the admin audit log.
--   2. partner-logos storage bucket for logo uploads (public read, admin write).
--   3. Admin Team functions: list admins, grant/change a role by email,
--      revoke a role. Super admins only, with lock-out guards.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Partners table ───────────────────────────────────────────────────────

create table if not exists public.partners (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  logo_url     text not null default '',
  blurb        text not null default '',
  facts        text[] not null default '{}',
  href         text not null default '',
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  is_featured  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.partners enable row level security;

-- Two read rules (not one OR'd rule): signed-out visitors can't call the
-- admin role check, so they get a rule that never needs it.
drop policy if exists "partners_public_read_active" on public.partners;
create policy "partners_public_read_active"
  on public.partners for select
  to public
  using (is_active);

drop policy if exists "partners_admin_read_all" on public.partners;
create policy "partners_admin_read_all"
  on public.partners for select
  to authenticated
  using (public.has_admin_role(array['super_admin', 'partner_manager']));

drop policy if exists "partners_admin_insert" on public.partners;
create policy "partners_admin_insert"
  on public.partners for insert
  to authenticated
  with check (public.has_admin_role(array['super_admin', 'partner_manager']));

drop policy if exists "partners_admin_update" on public.partners;
create policy "partners_admin_update"
  on public.partners for update
  to authenticated
  using (public.has_admin_role(array['super_admin', 'partner_manager']))
  with check (public.has_admin_role(array['super_admin', 'partner_manager']));

drop policy if exists "partners_admin_delete" on public.partners;
create policy "partners_admin_delete"
  on public.partners for delete
  to authenticated
  using (public.has_admin_role(array['super_admin', 'partner_manager']));

grant select on public.partners to anon, authenticated;
grant insert, update, delete on public.partners to authenticated;

-- Keep updated_at fresh and log every change to the audit trail.
create or replace function public.partners_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if auth.uid() is not null then
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (
      auth.uid(),
      case tg_op when 'INSERT' then 'partner_add' when 'UPDATE' then 'partner_edit' else 'partner_delete' end,
      'partner',
      coalesce(new.id, old.id)::text,
      jsonb_build_object('name', coalesce(new.name, old.name))
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists partners_audit on public.partners;
create trigger partners_audit
  before insert or update or delete on public.partners
  for each row
  execute function public.partners_audit();

-- Seed today's partners once (skipped if the table already has rows).
insert into public.partners (name, logo_url, blurb, facts, href, sort_order)
select * from (values
  (
    'My Hockey Rankings',
    '/partners/mhr.v5.logo-full-bg.png',
    $$My Hockey Rankings uses a data-driven rating system — built from goal differential and strength of schedule — to rank youth hockey teams across thousands of clubs and leagues nationwide. What started as a simple way to help teams find evenly matched opponents has grown into one of youth hockey's most trusted ranking resources, free to families thanks to sponsor support and a dedicated volunteer network.$$,
    array['Since 2003', '2,900+ Clubs Tracked', '29,000+ Teams Ranked'],
    'https://myhockeyrankings.com',
    1
  ),
  (
    'For The Love Of Hockey',
    '/partners/FTLOH_Logo_1.png',
    $$For The Love Of Hockey is a hockey lifestyle and apparel brand built by and for hockey families — sideline hoodies, rink totes, and gear that says "hockey mom" or "hockey dad" without saying a word. They call themselves hockey's second rink family, backed by a coach-review tool and rewards program built specifically for youth hockey communities.$$,
    array['Riverside, CT', 'Hockey Lifestyle Apparel', 'Coach Review Program'],
    'https://fortheloveofhockey11.com',
    2
  )
) as seed(name, logo_url, blurb, facts, href, sort_order)
where not exists (select 1 from public.partners);


-- ── 2. Logo storage ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-logos', 'partner-logos', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "partner_logos_public_read" on storage.objects;
create policy "partner_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'partner-logos');

drop policy if exists "partner_logos_admin_write" on storage.objects;
create policy "partner_logos_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'partner-logos' and public.has_admin_role(array['super_admin', 'partner_manager']));

drop policy if exists "partner_logos_admin_update" on storage.objects;
create policy "partner_logos_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'partner-logos' and public.has_admin_role(array['super_admin', 'partner_manager']));

drop policy if exists "partner_logos_admin_delete" on storage.objects;
create policy "partner_logos_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'partner-logos' and public.has_admin_role(array['super_admin', 'partner_manager']));


-- ── 3a. Admin Team: list ────────────────────────────────────────────────────

create or replace function public.admin_list_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_admin_role(array['super_admin']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(row_data order by role_rank, created_at), '[]'::jsonb)
    from (
      select
        jsonb_build_object(
          'user_id',         ar.user_id::text,
          'role',            ar.role,
          'created_at',      ar.created_at,
          'email',           u.email,
          'alias',           p.alias,
          'initials',        p.initials,
          'avatar_url',      p.avatar_url,
          'last_sign_in_at', u.last_sign_in_at,
          'granted_by',      (select gp.alias from public.profiles gp where gp.id::text = ar.granted_by::text)
        ) as row_data,
        case ar.role when 'super_admin' then 0 when 'moderator' then 1 else 2 end as role_rank,
        ar.created_at
      from public.admin_roles ar
      join auth.users u on u.id = ar.user_id
      left join public.profiles p on p.id::text = ar.user_id::text
    ) t
  );
end;
$$;


-- ── 3b. Admin Team: grant or change a role ──────────────────────────────────
-- The person must already have a Rink Rater account (they sign up first).

create or replace function public.admin_grant_role(p_email text, p_role text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_previous text;
begin
  if not public.has_admin_role(array['super_admin']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_role not in ('super_admin', 'moderator', 'partner_manager') then
    raise exception 'Unknown role: %', p_role;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'No Rink Rater account uses that email yet. Ask them to sign up first, then add them.';
  end if;

  if v_user_id = auth.uid() then
    raise exception 'You can''t change your own role.';
  end if;

  if exists (select 1 from public.profiles where id::text = v_user_id::text and banned_at is not null) then
    raise exception 'That account is banned. Unban it in User Lookup first.';
  end if;

  select role into v_previous from public.admin_roles where user_id = v_user_id;

  insert into public.admin_roles (user_id, role, granted_by)
  values (v_user_id, p_role, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role, granted_by = excluded.granted_by;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    case when v_previous is null then 'admin_grant' else 'admin_role_change' end,
    'user',
    v_user_id::text,
    jsonb_build_object('role', p_role, 'previous_role', v_previous)
  );

  return jsonb_build_object('ok', true, 'user_id', v_user_id::text, 'role', p_role, 'previous_role', v_previous);
end;
$$;


-- ── 3c. Admin Team: revoke ──────────────────────────────────────────────────
-- Removes admin access only — their regular account keeps working.

create or replace function public.admin_revoke_role(p_user_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.has_admin_role(array['super_admin']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_user_id = auth.uid()::text then
    raise exception 'You can''t remove your own admin access.';
  end if;

  select role into v_role from public.admin_roles where user_id::text = p_user_id;
  if v_role is null then
    raise exception 'That user isn''t an admin.';
  end if;

  if v_role = 'super_admin'
     and (select count(*) from public.admin_roles where role = 'super_admin') <= 1 then
    raise exception 'You can''t remove the last super admin.';
  end if;

  delete from public.admin_roles where user_id::text = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'admin_revoke', 'user', p_user_id, jsonb_build_object('previous_role', v_role));

  return jsonb_build_object('ok', true);
end;
$$;


-- ── 4. Permissions ──────────────────────────────────────────────────────────

revoke all on function public.admin_list_admins()           from public, anon;
revoke all on function public.admin_grant_role(text, text)  from public, anon;
revoke all on function public.admin_revoke_role(text)       from public, anon;
grant execute on function public.admin_list_admins()          to authenticated;
grant execute on function public.admin_grant_role(text, text) to authenticated;
grant execute on function public.admin_revoke_role(text)      to authenticated;


-- ── 5. Verification — this is the result the editor shows ───────────────────
-- Expect: partners = 2 (first run), logo_bucket = 1, admins = 1 or more.

select
  (select count(*) from public.partners)                                      as partners,
  (select count(*) from storage.buckets where id = 'partner-logos')            as logo_bucket,
  (select count(*) from public.admin_roles)                                    as admins,
  (select count(*) from pg_trigger where tgname = 'partners_audit')            as audit_trigger;
