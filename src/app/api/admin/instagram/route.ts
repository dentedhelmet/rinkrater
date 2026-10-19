export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireAdmin'
import { slugifyTitle } from '@/lib/blog'
import { draftFromCaption } from '@/lib/instagramCaption'

// ─── Instagram → blog drafts (Super Admins only) ────────────────────────────
//
// GET  /api/admin/instagram                       → connection status
// POST /api/admin/instagram { action: 'connect', token }  → save an access token
// POST /api/admin/instagram { action: 'import' }          → pull new posts in as drafts
//
// Uses the Instagram API with Instagram Login (graph.instagram.com). The
// token comes from the Meta app dashboard ("Generate token" next to the
// Rink Rater Instagram account) and lasts 60 days; each import refreshes it,
// so as long as you import at least once every couple of months it never
// expires.
//
// Every database read and write runs as the signed-in admin, so the same
// database rules that protect HQ apply here too.

const GRAPH = 'https://graph.instagram.com'
const API_VERSION = 'v25.0'
const DAY_MS = 86_400_000
const MAX_IMPORT = 12
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

interface Connection {
  access_token:   string
  ig_user_id:     string
  username:       string
  expires_at:     string | null
  connected_at:   string
  refreshed_at:   string
  last_import_at: string | null
}

interface IgMedia {
  id:             string
  caption?:       string
  media_type:     'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?:     string
  thumbnail_url?: string
  permalink:      string
  timestamp:      string
  children?:      { data: { media_type: string; media_url?: string; thumbnail_url?: string }[] }
}

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

function userClient(req: NextRequest): SupabaseClient {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() ?? ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
}

/** Calls graph.instagram.com and turns Meta's error shape into a readable message. */
async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('/refresh') ? `${GRAPH}${path}` : `${GRAPH}/${API_VERSION}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, { cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    const msg: string = body?.error?.message ?? `Instagram returned ${res.status}`
    const code: number | undefined = body?.error?.code
    const err = new Error(code === 190 ? 'The Instagram token has expired or was revoked. Generate a new one and reconnect.' : msg)
    throw err
  }
  return body as T
}

async function loadConnection(db: SupabaseClient): Promise<Connection | null> {
  const { data, error } = await db
    .from('instagram_connection')
    .select('access_token, ig_user_id, username, expires_at, connected_at, refreshed_at, last_import_at')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      throw new Error('The Instagram tables don’t exist yet — run the v8 SQL migration first.')
    }
    throw new Error(error.message)
  }
  return (data as Connection | null) ?? null
}

/** Refreshes the token if it's at least a day old (Instagram's minimum). */
async function freshToken(db: SupabaseClient, conn: Connection): Promise<string> {
  if (Date.now() - new Date(conn.refreshed_at).getTime() < DAY_MS) return conn.access_token
  try {
    const r = await graph<{ access_token: string; expires_in: number }>('/refresh_access_token', {
      grant_type: 'ig_refresh_token',
      access_token: conn.access_token,
    })
    const now = new Date()
    await db.from('instagram_connection').update({
      access_token: r.access_token,
      refreshed_at: now.toISOString(),
      expires_at:   new Date(now.getTime() + r.expires_in * 1000).toISOString(),
    }).eq('id', 1)
    return r.access_token
  } catch (e) {
    // A failed refresh isn't fatal while the old token still works.
    if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now()) throw e
    console.error('instagram token refresh failed:', e)
    return conn.access_token
  }
}

function status(conn: Connection | null) {
  if (!conn) return { connected: false }
  const daysLeft = conn.expires_at
    ? Math.max(0, Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / DAY_MS))
    : null
  return {
    connected:      true,
    username:       conn.username,
    expires_at:     conn.expires_at,
    days_left:      daysLeft,
    last_import_at: conn.last_import_at,
  }
}

// ─── GET: status ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req, ['super_admin'])
  if (!check.ok) return check.response
  try {
    return NextResponse.json(status(await loadConnection(userClient(req))))
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not load the Instagram connection.', 500)
  }
}

// ─── POST: connect or import ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const check = await requireAdmin(req, ['super_admin'])
  if (!check.ok) return check.response

  const body = await req.json().catch(() => ({}))
  const db = userClient(req)

  try {
    if (body.action === 'connect') return await connect(db, String(body.token ?? '').trim())
    if (body.action === 'import') return await importPosts(db)
    return fail('Unknown action.')
  } catch (e) {
    console.error('instagram route failed:', e)
    return fail(e instanceof Error ? e.message : 'Something went wrong.', 500)
  }
}

async function connect(db: SupabaseClient, token: string) {
  if (token.length < 20) return fail('Paste the full access token from the Meta app dashboard.')

  const me = await graph<{ user_id?: string; id?: string; username: string; account_type?: string }>('/me', {
    fields: 'user_id,username,account_type',
    access_token: token,
  })

  // Try to refresh right away to learn the exact expiry. Brand-new tokens
  // can't be refreshed for 24 hours, so fall back to Instagram's 60 days.
  let accessToken = token
  let expiresAt = new Date(Date.now() + 60 * DAY_MS)
  try {
    const r = await graph<{ access_token: string; expires_in: number }>('/refresh_access_token', {
      grant_type: 'ig_refresh_token',
      access_token: token,
    })
    accessToken = r.access_token
    expiresAt = new Date(Date.now() + r.expires_in * 1000)
  } catch { /* too new to refresh — fine */ }

  const now = new Date().toISOString()
  const { error } = await db.from('instagram_connection').upsert({
    id:           1,
    access_token: accessToken,
    ig_user_id:   String(me.user_id ?? me.id ?? ''),
    username:     me.username,
    expires_at:   expiresAt.toISOString(),
    connected_at: now,
    refreshed_at: now,
  })
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return fail('The Instagram tables don’t exist yet — run the v8 SQL migration first.', 500)
    }
    return fail(error.message, 500)
  }

  return NextResponse.json(status(await loadConnection(db)))
}

/** Picks the best still image for a post: the photo, a video's cover, or a carousel's first slide. */
function imageFor(m: IgMedia): string | null {
  if (m.media_type === 'IMAGE') return m.media_url ?? null
  if (m.media_type === 'VIDEO') return m.thumbnail_url ?? null
  const first = m.children?.data?.[0]
  if (!first) return m.media_url ?? null
  return first.media_type === 'VIDEO' ? first.thumbnail_url ?? null : first.media_url ?? null
}

/** Copies the image into our own storage — Instagram's image links expire. */
async function copyImage(db: SupabaseClient, mediaId: string, src: string): Promise<string> {
  const res = await fetch(src, { cache: 'no-store' })
  if (!res.ok) throw new Error(`image download failed (${res.status})`)
  const type = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
  const ext = IMAGE_EXT[type]
  if (!ext) throw new Error(`unsupported image type ${type}`)
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('image larger than 5 MB')

  const path = `instagram/${mediaId}.${ext}`
  const { error } = await db.storage.from('blog-images').upload(path, bytes, {
    contentType: type,
    cacheControl: '31536000',
    upsert: true,
  })
  if (error) throw new Error(error.message)
  return db.storage.from('blog-images').getPublicUrl(path).data.publicUrl
}

/** A slug that isn't taken yet: "rink-owner-vs-parents", then "-2", "-3"… */
async function uniqueSlug(db: SupabaseClient, title: string, mediaId: string): Promise<string> {
  const base = slugifyTitle(title) || `instagram-${mediaId.slice(-8)}`
  const { data } = await db.from('posts').select('slug').like('slug', `${base}%`)
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug))
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${mediaId.slice(-8)}`
}

async function importPosts(db: SupabaseClient) {
  const conn = await loadConnection(db)
  if (!conn) return fail('Connect Instagram first.')

  const token = await freshToken(db, conn)

  const media = await graph<{ data: IgMedia[] }>('/me/media', {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}',
    limit: '25',
    access_token: token,
  })

  const posts = media.data ?? []
  const ids = posts.map((m) => m.id)

  // Skip anything already imported — including drafts that were later removed.
  const { data: existing, error: existingError } = ids.length
    ? await db.from('posts').select('instagram_id').in('instagram_id', ids)
    : { data: [], error: null }
  if (existingError) {
    if (/instagram_id/i.test(existingError.message)) {
      return fail('The posts table is missing instagram_id — run the v8 SQL migration first.', 500)
    }
    return fail(existingError.message, 500)
  }
  const seen = new Set((existing ?? []).map((r: { instagram_id: string }) => r.instagram_id))

  // Oldest first, so drafts appear in the order they were posted.
  const fresh = posts.filter((m) => !seen.has(m.id)).slice(0, MAX_IMPORT).reverse()

  const imported: { title: string; slug: string }[] = []
  const problems: string[] = []

  for (const m of fresh) {
    const draft = draftFromCaption(m.caption, m.timestamp)

    let cover = ''
    const src = imageFor(m)
    if (src) {
      try {
        cover = await copyImage(db, m.id, src)
      } catch (e) {
        problems.push(`“${draft.title}”: image not copied (${e instanceof Error ? e.message : 'unknown error'})`)
      }
    }

    const slug = await uniqueSlug(db, draft.title, m.id)
    const { error } = await db.from('posts').insert({
      slug,
      title:               draft.title,
      excerpt:             draft.excerpt,
      body_html:           draft.bodyHtml,
      cover_image_url:     cover,
      cover_image_alt:     '',            // you describe the image before saving
      rink_ids:            [],
      status:              'draft',
      published_at:        null,
      source:              'instagram',
      instagram_id:        m.id,
      instagram_permalink: m.permalink,
    })

    if (error) {
      // 23505 = already imported by someone else a moment ago.
      if (error.code !== '23505') problems.push(`“${draft.title}”: ${error.message}`)
      continue
    }
    imported.push({ title: draft.title, slug })
  }

  await db.from('instagram_connection').update({ last_import_at: new Date().toISOString() }).eq('id', 1)

  return NextResponse.json({
    imported,
    skipped: posts.length - fresh.length,
    problems,
    connection: status(await loadConnection(db)),
  })
}
