import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/visit — records one new visitor for the Live Visitors ding.
 *
 * Called by VisitBeacon on the first page of each visit. Always answers 204,
 * whether or not the visit was recorded, so the beacon never shows errors and
 * nobody can probe what was filtered.
 *
 * Stored: random visit id, page path, rink id (on rink pages), referring
 * site's host name, device bucket. Never stored: IP, full user agent, user id,
 * query strings.
 */

const BOT_UA =
  /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|curl|wget|python|axios|node-fetch|undici|go-http|java\/|okhttp|postman/i

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HOST = /^[a-z0-9.-]{1,120}$/i

// Light per-IP limit so one script can't flood the dashboard with fake dings.
// In memory only (resets on redeploy) — the IP itself is never stored.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 12
const recent = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits)
    return true
  }
  hits.push(now)
  recent.set(ip, hits)

  // Keep the map from growing forever.
  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(key)
    }
  }
  return false
}

function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}

function fromOurSite(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // same-origin keepalive requests may omit it
  try {
    const host = new URL(origin).hostname
    return host === 'rinkrater.com' || host.endsWith('.rinkrater.com') || host === 'localhost'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 })

  const admin = supabaseAdmin()
  if (!admin) return done

  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || BOT_UA.test(ua)) return done
  if (!fromOurSite(req)) return done

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return done

  let body: { visitId?: unknown; path?: unknown; referrer?: unknown }
  try {
    body = await req.json()
  } catch {
    return done
  }

  const visitId = typeof body.visitId === 'string' ? body.visitId : ''
  const path = typeof body.path === 'string' ? body.path.split('?')[0].split('#')[0] : ''
  if (!UUID.test(visitId)) return done
  if (!path.startsWith('/') || path.length > 300 || path.startsWith('/admin') || path.startsWith('/api')) return done

  let rinkId: string | null = null
  const rinkMatch = path.match(/^\/rink\/([^/]+)/)
  if (rinkMatch) {
    try {
      const id = decodeURIComponent(rinkMatch[1])
      if (id.length <= 100) rinkId = id
    } catch {
      rinkId = null
    }
  }

  let referrerHost: string | null = null
  if (typeof body.referrer === 'string') {
    const host = body.referrer.toLowerCase().replace(/^www\./, '')
    if (HOST.test(host) && host !== 'rinkrater.com' && !host.endsWith('.rinkrater.com')) {
      referrerHost = host
    }
  }

  const { error } = await admin.from('site_visits').upsert(
    {
      visit_id:      visitId,
      path,
      rink_id:       rinkId,
      referrer_host: referrerHost,
      device:        deviceFrom(ua),
    },
    { onConflict: 'visit_id', ignoreDuplicates: true }
  )
  if (error) console.error('site_visits insert failed:', error.message)

  // Now and then, clear out visits older than 90 days.
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { error: cleanupError } = await admin.from('site_visits').delete().lt('created_at', cutoff)
    if (cleanupError) console.error('site_visits cleanup failed:', cleanupError.message)
  }

  return done
}
