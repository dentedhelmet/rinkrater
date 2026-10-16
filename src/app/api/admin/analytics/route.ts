export const maxDuration = 20

import { NextRequest, NextResponse } from 'next/server'
import { JWT } from 'google-auth-library'
import { requireAdmin } from '@/lib/requireAdmin'

// ─── Google Analytics 4 for the admin dashboard ──────────────────────────────
//
// GET /api/admin/analytics?scope=summary  → last 14 days: visitors, sessions, page views
// GET /api/admin/analytics?scope=live     → right now: active visitors, per-minute, top pages, devices
//
// Reads GA through a Google service account. Required environment variables
// (server-only — none of these may be NEXT_PUBLIC_):
//   GA_PROPERTY_ID              numeric GA4 property ID (not the G-… measurement ID)
//   GA_SERVICE_ACCOUNT_EMAIL    e.g. rinkrater-dashboard@<project>.iam.gserviceaccount.com
//   GA_SERVICE_ACCOUNT_KEY      the private_key value from the JSON key file
// Optional:
//   GA_TIMEZONE                 defaults to America/New_York (match the GA property)
//
// Admin-only: every request is checked against admin_roles first.

const GA_API = 'https://analyticsdata.googleapis.com/v1beta'
const SUMMARY_CACHE_MS = 5 * 60_000
const LIVE_CACHE_MS = 20_000

const cache = new Map<string, { expires: number; body: unknown }>()
let jwtClient: JWT | null = null

function gaConfig() {
  const propertyId = process.env.GA_PROPERTY_ID?.trim()
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL?.trim()
  // Hosting panels often store the key on one line with literal \n sequences.
  const key = process.env.GA_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n').trim()
  const timeZone = process.env.GA_TIMEZONE?.trim() || 'America/New_York'
  if (!propertyId || !email || !key) return null
  return { propertyId, email, key, timeZone }
}

async function gaRequest(propertyId: string, method: 'runReport' | 'runRealtimeReport', body: object) {
  const config = gaConfig()!
  if (!jwtClient) {
    jwtClient = new JWT({
      email: config.email,
      key: config.key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
  }
  const { token } = await jwtClient.getAccessToken()
  const res = await fetch(`${GA_API}/properties/${propertyId}:${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) {
    const message = json?.error?.message || `GA request failed (${res.status})`
    throw Object.assign(new Error(message), { status: res.status })
  }
  return json as GaReport
}

interface GaReport {
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[]
  totals?: { metricValues?: { value: string }[] }[]
}

const num = (v: string | undefined) => Number(v ?? 0) || 0

// Last 14 calendar days (oldest first) as YYYY-MM-DD in the property's time zone.
function last14Days(timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    days.push(fmt.format(new Date(Date.now() - i * 86_400_000)))
  }
  return days
}

async function buildSummary(propertyId: string, timeZone: string) {
  const report = await gaRequest(propertyId, 'runReport', {
    dateRanges: [{ startDate: '13daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
    metricAggregations: ['TOTAL'],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  })

  const byDay = new Map<string, { users: number; sessions: number; views: number }>()
  for (const row of report.rows ?? []) {
    const raw = row.dimensionValues?.[0]?.value ?? '' // YYYYMMDD
    const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    byDay.set(day, {
      users:    num(row.metricValues?.[0]?.value),
      sessions: num(row.metricValues?.[1]?.value),
      views:    num(row.metricValues?.[2]?.value),
    })
  }

  const days = last14Days(timeZone).map((day) => ({ day, ...(byDay.get(day) ?? { users: 0, sessions: 0, views: 0 }) }))
  const totalsRow = report.totals?.[0]?.metricValues

  return {
    configured: true,
    days,
    totals: {
      // Unique visitors across the whole range (not the sum of daily counts).
      users:    num(totalsRow?.[0]?.value),
      sessions: num(totalsRow?.[1]?.value),
      views:    num(totalsRow?.[2]?.value),
    },
  }
}

async function buildLive(propertyId: string) {
  const [total, perMinute, pages, devices] = await Promise.all([
    gaRequest(propertyId, 'runRealtimeReport', {
      metrics: [{ name: 'activeUsers' }],
    }),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }],
    }),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 5,
    }),
    gaRequest(propertyId, 'runRealtimeReport', {
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  // 30 one-minute buckets, oldest → newest, for the live sparkline.
  const minuteMap = new Map<number, number>()
  for (const row of perMinute.rows ?? []) {
    minuteMap.set(num(row.dimensionValues?.[0]?.value), num(row.metricValues?.[0]?.value))
  }
  const minutes = Array.from({ length: 30 }, (_, i) => {
    const minutesAgo = 29 - i
    return { minutesAgo, users: minuteMap.get(minutesAgo) ?? 0 }
  })

  return {
    configured: true,
    activeNow: num(total.rows?.[0]?.metricValues?.[0]?.value),
    minutes,
    topPages: (pages.rows ?? []).map((row) => ({
      page:  row.dimensionValues?.[0]?.value || '(untitled)',
      users: num(row.metricValues?.[0]?.value),
    })),
    devices: (devices.rows ?? []).map((row) => ({
      device: row.dimensionValues?.[0]?.value || 'other',
      users:  num(row.metricValues?.[0]?.value),
    })),
    fetchedAt: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req)
  if (!check.ok) return check.response

  const config = gaConfig()
  if (!config) {
    return NextResponse.json({ configured: false })
  }

  const scope = req.nextUrl.searchParams.get('scope') === 'live' ? 'live' : 'summary'
  const cacheKey = scope
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.body)
  }

  try {
    const body = scope === 'live'
      ? await buildLive(config.propertyId)
      : await buildSummary(config.propertyId, config.timeZone)
    cache.set(cacheKey, { expires: Date.now() + (scope === 'live' ? LIVE_CACHE_MS : SUMMARY_CACHE_MS), body })
    return NextResponse.json(body)
  } catch (err) {
    const status = (err as { status?: number }).status
    console.error(`GA ${scope} report failed:`, err)
    const hint =
      status === 403 ? 'Google said no access — add the service account email as a Viewer on the GA property.'
      : status === 404 ? 'GA property not found — check GA_PROPERTY_ID (the numeric ID, not G-…).'
      : 'Google Analytics did not respond. Try again in a minute.'
    return NextResponse.json({ configured: true, error: hint }, { status: 502 })
  }
}
